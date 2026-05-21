import { useState, useEffect, useRef } from "react";
import apiFetch from "@wordpress/api-fetch";
import { addQueryArgs } from "@wordpress/url";
import { __ } from "@wordpress/i18n";
import { decodeHTMLEntities } from "../utils/formatters";

// Upper bound on the page walker. With per_page=100 this caps any single
// fetchMedia call at 5,000 items — large enough to cover realistic libraries,
// small enough to prevent a runaway loop from a misbehaving REST endpoint.
const MAX_MEDIA_PAGES = 50;

interface MediaTag {
  id: number;
  name: string;
  slug: string;
}

interface MediaItem {
  id: number;
  title: string; // Post title
  post_date: string; // Date
  status: string;
  poster_image?: string; // Poster image URL (16:9 aspect ratio)
  tags?: MediaTag[]; // Media Tags (pp_video_tag taxonomy)
  shortcode?: string; // Shortcode format: [presto_player id={id}]
  post_name?: string; // Post slug
  post_password?: string; // Post password
  author?: {
    id: number;
    name: string;
  };
  group?: {
    id: number;
    name: string;
  };
  [key: string]: any;
}

interface UseMediaReturn {
  media: MediaItem[];
  setMedia: React.Dispatch<React.SetStateAction<MediaItem[]>>;
  loading: boolean;
  sortField: string;
  sortOrder: "asc" | "desc";
  handleSort: (field: string) => void;
  fetchMedia: () => Promise<void>;
}

interface WordPressPost {
  id: number;
  title?: string | { rendered?: string; raw?: string };
  content?: { rendered?: string; raw?: string };
  date: string;
  modified?: string;
  status: string;
  author: number;
  pp_video_tag?: number[];
  details?: {
    poster?: string;
    [key: string]: any;
  };
  _embedded?: {
    author?: Array<{ id: number; name: string }>;
    "wp:featuredmedia"?: Array<{ source_url: string }>;
    "https://api.w.org/term"?: Array<{
      pp_video_tag?: Array<{
        id: number;
        name: string;
        slug: string;
      }>;
      [key: string]: any;
    }>;
  };
  [key: string]: any;
}

// ============================================================================
// UTILITY FUNCTIONS - Pure functions for data extraction and transformation
// ============================================================================

/**
 * Strip WP's protected_title_format / private_title_format prefix from a title.
 *
 * `get_the_title()` prepends "Protected: " / "Private: " (or their translations)
 * for password-protected / private posts, and that prefix flows through to
 * `title.rendered`. Strip it once at the boundary so the row title is clean
 * and round-tripping through the post-settings dialog doesn't compound the
 * prefix on every save. PostSettings does the same strip on the dialog side.
 */
const stripWpTitlePrefix = (title: string): string => {
  const protectedPrefix = __("Protected: %s").replace("%s", "");
  const privatePrefix = __("Private: %s").replace("%s", "");
  if (protectedPrefix && title.startsWith(protectedPrefix)) {
    return title.slice(protectedPrefix.length);
  }
  if (privatePrefix && title.startsWith(privatePrefix)) {
    return title.slice(privatePrefix.length);
  }
  return title;
};

/**
 * Extract a display-ready title from a WordPress post object.
 *
 * Picks `post_title` (raw, custom post-type style), then `title.rendered` /
 * `title.raw` (standard REST shape). Decodes HTML entities and strips WP's
 * "Protected: " / "Private: " prefix so the consumer can render via JSX
 * without further massaging. Returns "Media #{id}" when no title is present.
 *
 * @param post - WordPress post object
 * @param postId - Post ID for fallback title generation
 * @returns Display-ready title
 */
const extractTitleFromPost = (post: WordPressPost, postId: number): string => {
  let raw = "";

  if ((post as any).post_title) {
    raw = (post as any).post_title;
  } else if (post.title) {
    if (typeof post.title === "string") {
      raw = post.title;
    } else if (post.title.rendered) {
      raw = post.title.rendered;
    } else if (post.title.raw) {
      raw = post.title.raw;
    }
  }

  if (!raw) {
    return `Media #${postId}`;
  }

  return stripWpTitlePrefix(decodeHTMLEntities(raw));
};

/**
 * Normalize a tag object to MediaTag format
 *
 * @param tag - Raw tag object from API
 * @returns Normalized MediaTag object
 */
const normalizeTag = (tag: {
  id: number;
  name: string;
  slug?: string;
}): MediaTag => {
  return {
    id: tag.id,
    name: tag.name,
    slug: tag.slug || tag.name.toLowerCase().replace(/\s+/g, "-"),
  };
};

/**
 * Extract tags from WordPress post embedded terms
 *
 * WordPress REST API embeds taxonomy terms in a nested structure:
 * _embedded["https://api.w.org/term"] = [
 *   { pp_video_tag: [{ id, name, slug }, ...] },
 *   { other_taxonomy: [...] }
 * ]
 *
 * @param post - WordPress post object
 * @returns Array of extracted MediaTag objects
 */
const extractTagsFromPost = (post: WordPressPost): MediaTag[] => {
  const tags: MediaTag[] = [];
  const embeddedTerms = post._embedded?.["https://api.w.org/term"];

  if (!embeddedTerms || !Array.isArray(embeddedTerms)) {
    return tags;
  }

  // Iterate through embedded term groups (each group represents a taxonomy)
  for (const termGroup of embeddedTerms) {
    if (termGroup && typeof termGroup === "object") {
      // Check if this term group contains pp_video_tag taxonomy terms
      if (
        termGroup["pp_video_tag"] &&
        Array.isArray(termGroup["pp_video_tag"])
      ) {
        // Extract each tag and normalize the data structure
        termGroup["pp_video_tag"].forEach((tag: any) => {
          if (tag && tag.id && tag.name) {
            tags.push(normalizeTag(tag));
          }
        });
      }
    }
  }

  return tags;
};

/**
 * Check if a post has embedded tags available
 *
 * @param post - WordPress post object
 * @returns True if embedded tags are available
 */
const hasEmbeddedTags = (post: WordPressPost): boolean => {
  return (
    post._embedded?.["https://api.w.org/term"]?.some(
      (termGroup: any) => termGroup?.pp_video_tag?.length > 0
    ) ?? false
  );
};

/**
 * Extract poster image URL from WordPress post
 *
 * Poster images can come from two sources (checked in priority order):
 * 1. Custom details.poster field (plugin-specific, highest priority)
 * 2. WordPress featured media (standard WP REST API embedded media)
 *
 * @param post - WordPress post object
 * @returns Poster image URL or undefined
 */
const extractPosterImageFromPost = (
  post: WordPressPost
): string | undefined => {
  // Priority 1: Custom poster field (plugin-specific)
  if (post.details?.poster) {
    return post.details.poster;
  }

  // Priority 2: WordPress featured media (standard REST API)
  if (post._embedded?.["wp:featuredmedia"]?.[0]?.source_url) {
    return post._embedded["wp:featuredmedia"][0].source_url;
  }

  return undefined;
};

/**
 * Extract author information from WordPress post
 *
 * @param post - WordPress post object
 * @returns Author object with id and name, or undefined
 */
const extractAuthorFromPost = (
  post: WordPressPost
): { id: number; name: string } | undefined => {
  const authorInfo = post._embedded?.author?.[0];
  if (authorInfo && authorInfo.id && authorInfo.name) {
    return {
      id: authorInfo.id,
      name: authorInfo.name,
    };
  }
  return undefined;
};

/**
 * Fetch all pages of posts from WordPress REST API
 *
 * Handles pagination automatically by fetching all pages until no more data is available.
 *
 * @param endpoint - REST API endpoint path
 * @param perPage - Number of items per page (default: 100)
 * @returns Array of all posts from all pages
 */
const fetchAllPages = async (
  endpoint: string,
  perPage: number = 100,
  signal?: AbortSignal
): Promise<WordPressPost[]> => {
  const allPosts: WordPressPost[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= MAX_MEDIA_PAGES) {
    const response = await apiFetch({
      path: addQueryArgs(endpoint, {
        per_page: perPage,
        page: page,
        _embed: 1,
        // Explicitly include trashed items along with other standard statuses.
        // WordPress treats "any" as all statuses EXCEPT "trash", so we list
        // the statuses we care about here to ensure trashed posts are loaded
        // and can be filtered in the Media Hub UI.
        status: "publish,draft,pending,private,future,trash",
      }),
      signal,
    });

    if (Array.isArray(response)) {
      allPosts.push(...response);

      // If we received fewer items than requested, we've reached the last page
      if (response.length < perPage) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      // Response is not an array, stop pagination
      hasMore = false;
    }
  }

  return allPosts;
};

/**
 * Identify posts that need tag fetching
 *
 * Returns a map of post IDs to their tag ID arrays for posts that have tag IDs
 * but no embedded tag objects.
 *
 * @param posts - Array of WordPress posts
 * @returns Map of post ID to array of tag IDs that need fetching
 */
const identifyPostsNeedingTags = (
  posts: WordPressPost[]
): Map<number, number[]> => {
  const postsNeedingTags = new Map<number, number[]>();

  posts.forEach((post) => {
    if (
      post.pp_video_tag &&
      Array.isArray(post.pp_video_tag) &&
      post.pp_video_tag.length > 0 &&
      !hasEmbeddedTags(post)
    ) {
      postsNeedingTags.set(post.id, post.pp_video_tag);
    }
  });

  return postsNeedingTags;
};

/**
 * Collect all unique tag IDs from posts needing tags
 *
 * @param postsNeedingTags - Map of post ID to tag ID arrays
 * @returns Array of unique tag IDs
 */
const collectUniqueTagIds = (
  postsNeedingTags: Map<number, number[]>
): number[] => {
  const allTagIds: number[] = [];
  postsNeedingTags.forEach((tagIds) => {
    allTagIds.push(...tagIds);
  });
  return [...new Set(allTagIds)];
};

/**
 * Fetch tag details for tag IDs (batch fetch)
 *
 * This function optimizes tag fetching by batching all tag IDs into a single
 * API request instead of making individual requests per tag.
 *
 * @param tagIds - Array of unique tag IDs to fetch
 * @returns Map of tag ID to MediaTag object for efficient lookups
 */
const fetchTagDetailsBatch = async (
  tagIds: number[],
  signal?: AbortSignal
): Promise<Map<number, MediaTag>> => {
  if (!tagIds || tagIds.length === 0) {
    return new Map();
  }

  const tagMap = new Map<number, MediaTag>();

  try {
    const tags = await apiFetch({
      path: addQueryArgs("/wp/v2/pp_video_tag", {
        include: tagIds.join(","),
        per_page: 100,
      }),
      signal,
    });

    if (Array.isArray(tags)) {
      tags.forEach((tag: any) => {
        if (tag && tag.id && tag.name) {
          tagMap.set(tag.id, normalizeTag(tag));
        }
      });
    }
  } catch (error: any) {
    // Aborts are expected on unmount or refetch — don't surface as errors.
    if (error?.name === "AbortError" || signal?.aborted) {
      return tagMap;
    }
    console.error("Error fetching tag details:", error);
  }

  return tagMap;
};

/**
 * Assign tags to media items based on fetched tag map
 *
 * @param mediaItems - Array of media items to update
 * @param postsNeedingTags - Map of post ID to tag ID arrays
 * @param tagMap - Map of tag ID to MediaTag object
 */
const assignTagsToMediaItems = (
  mediaItems: MediaItem[],
  postsNeedingTags: Map<number, number[]>,
  tagMap: Map<number, MediaTag>
): void => {
  postsNeedingTags.forEach((tagIds, postId) => {
    const mediaItem = mediaItems.find((item) => item.id === postId);
    if (mediaItem) {
      const tags = tagIds
        .map((tagId) => tagMap.get(tagId))
        .filter((tag): tag is MediaTag => tag !== undefined);

      if (tags.length > 0) {
        mediaItem.tags = tags;
      }
    }
  });
};

/**
 * Transform WordPress post to MediaItem format
 *
 * @param post - WordPress post object
 * @returns Transformed MediaItem object
 */
const transformPostToMediaItem = (post: WordPressPost): MediaItem => {
  const tags = extractTagsFromPost(post);

  return {
    id: post.id,
    title: extractTitleFromPost(post, post.id),
    post_date: post.date || post.modified || "",
    status: post.status || "publish",
    poster_image: extractPosterImageFromPost(post),
    tags: tags.length > 0 ? tags : undefined,
    shortcode: `[presto_player id=${post.id}]`,
    post_name: post.slug || "",
    post_password: post.password || "",
    author: extractAuthorFromPost(post),
    link: post.link || "",
  };
};

// ============================================================================
// SORTING STATE
// ============================================================================
//
// Sort application lives in the consumer (MediaHub) so filtering happens
// before sorting and the comparators run on the smaller filtered set. The
// hook only owns the sort *state* so column-header arrows have a single
// source of truth.

// ============================================================================
// MAIN HOOK
// ============================================================================

const useMedia = (): UseMediaReturn => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sortField, setSortField] = useState<string>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetch all media items from WordPress REST API
   *
   * This function implements a two-pass strategy to efficiently fetch and transform
   * media items with their associated tags:
   *
   * Pass 1: Fetch all posts with embedded data (tags, authors, featured media)
   * Pass 2: Batch-fetch any missing tag details for posts that only have tag IDs
   *
   * This approach minimizes API calls while ensuring all data is available.
   */
  const fetchMedia = async (): Promise<void> => {
    // Cancel any in-flight fetch before starting a new one.
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    try {
      setLoading(true);

      // Pass 1: Fetch all posts with pagination
      const allPosts = await fetchAllPages(
        "/wp/v2/presto-videos",
        100,
        signal
      );

      // Pass 2: Transform posts to media items
      const transformedMedia = allPosts.map(transformPostToMediaItem);

      // Pass 3: Fetch and assign missing tags
      const postsNeedingTags = identifyPostsNeedingTags(allPosts);

      if (postsNeedingTags.size > 0) {
        const uniqueTagIds = collectUniqueTagIds(postsNeedingTags);
        const tagMap = await fetchTagDetailsBatch(uniqueTagIds, signal);
        assignTagsToMediaItems(transformedMedia, postsNeedingTags, tagMap);
      }

      if (signal.aborted) {
        return;
      }

      // Update state with transformed media items
      setMedia(transformedMedia);
      setLoading(false);
    } catch (error: any) {
      // Aborts are expected on unmount or refetch — don't surface as errors.
      if (error?.name === "AbortError" || signal.aborted) {
        return;
      }
      /**
       * ERROR HANDLING
       *
       * If any error occurs during fetching or transformation, we:
       * 1. Log the error for debugging
       * 2. Set loading to false to allow UI to update
       * 3. Set media to empty array to prevent UI crashes from undefined/null data
       *
       * This ensures the component remains functional even if the API fails.
       */
      console.error("Error fetching media:", error);
      setLoading(false);
      setMedia([]);
    }
  };

  useEffect(() => {
    fetchMedia();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  /**
   * Handle sort field and order changes
   *
   * This function implements a toggle behavior for sorting:
   * - If clicking the same field: toggle between asc/desc
   * - If clicking a different field: set new field with default order
   *   - Date fields default to descending (newest first)
   *   - Other fields default to ascending (A-Z, 0-9)
   *
   * @param field - The field name to sort by (e.g., "title", "date")
   */
  const handleSort = (field: string): void => {
    if (sortField === field) {
      // Same field clicked: toggle sort order (asc ↔ desc)
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      // Different field clicked: set new field with default order
      setSortField(field);
      // Date fields default to descending (newest first), others to ascending
      setSortOrder(field === "date" ? "desc" : "asc");
    }
  };

  return {
    media,
    setMedia,
    loading,
    sortField,
    sortOrder,
    handleSort,
    fetchMedia,
  };
};

export default useMedia;
