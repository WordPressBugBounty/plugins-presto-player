import { useState, useEffect, useCallback, useRef } from "@wordpress/element";
import apiFetch from "@wordpress/api-fetch";
import {
  formatHMS,
  getLastNDays,
  toAnalyticsDate,
  DEFAULT_ANALYTICS_DAYS,
} from "../utils";

/**
 * Hook to fetch analytics data for a single media item.
 *
 * Fetches:
 *  - Media metadata (title, poster, shortcode) via the custom Presto Player API
 *  - Optionally enriches with WP REST API data if post_id is available
 *  - Unique views for the media item
 *  - Average watch time for the media item
 *  - Audience retention data (watch-time distribution over video duration)
 *
 * All analytics endpoints accept optional start/end date query params.
 */
const useMediaDetail = (mediaId) => {
  const [media, setMedia] = useState(null);
  const [stats, setStats] = useState({
    uniqueViews: 0,
    avgWatchTime: "00:00:00",
    retentionData: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const fetchDetail = useCallback(
    async (startDate, endDate) => {
      if (!mediaId) return;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        setIsLoading(true);
        setError(null);

        // Default to last 7 days when no range was supplied so the
        // detail page mirrors the Analytics page's default scope.
        const range =
          startDate && endDate
            ? { from: startDate, to: endDate }
            : getLastNDays(DEFAULT_ANALYTICS_DAYS);
        const dateQueryArgs = {
          start: toAnalyticsDate(range.from),
          end: toAnalyticsDate(range.to),
        };

        // Fetch video metadata from custom Presto Player API (uses custom table ID)
        const videoResponse = await apiFetch({
          path: `/presto-player/v1/videos/${mediaId}`,
          signal: abortControllerRef.current.signal,
        });

        let title = videoResponse.title || `Media #${mediaId}`;
        let poster = null;
        let src = videoResponse.src || "";
        let provider = videoResponse.type || "";
        let preset = {};
        let branding = {};
        let blockAttributes = {};
        let tracks = [];
        const postId = videoResponse.post_id;

        // Use the list endpoint with `include` instead of fetching the post
        // by ID directly: when the post no longer exists (orphaned video row),
        // this returns 200 OK with an empty array instead of logging a 404 to
        // the network panel on every detail-page load.
        if (postId) {
          try {
            const wpResponse = await apiFetch({
              path: `/wp/v2/presto-videos?include=${postId}&_embed=1`,
              signal: abortControllerRef.current.signal,
            });
            const wpPost = Array.isArray(wpResponse) ? wpResponse[0] : null;

            if (wpPost) {
              if (wpPost.post_title) {
                title = wpPost.post_title;
              } else if (typeof wpPost.title === "string") {
                title = wpPost.title;
              } else if (wpPost.title?.rendered) {
                title = wpPost.title.rendered;
              }

              poster =
                wpPost.details?.poster ||
                wpPost._embedded?.["wp:featuredmedia"]?.[0]?.source_url ||
                null;
              provider = wpPost.details?.provider || provider;
              preset = wpPost.details?.preset || {};
              branding = wpPost.details?.branding || {};
              blockAttributes = wpPost.details?.blockAttributes || {};
              tracks = wpPost.details?.tracks || [];
            }
          } catch (wpErr) {
            if (wpErr.name !== "AbortError") {
              console.warn(
                "WP post data unavailable, using basic video data:",
                wpErr
              );
            }
          }
        }

        setMedia({
          id: videoResponse.id,
          title,
          poster,
          src,
          provider,
          preset,
          branding,
          blockAttributes,
          tracks,
          shortcode: postId
            ? `[presto_player id=${postId}]`
            : `[presto_player id=${videoResponse.id}]`,
        });

        // Fetch all analytics data in parallel for this specific media
        try {
          const [viewsRes, avgWatchTimeRes, timelineRes] = await Promise.all([
            apiFetch({
              path: wp.url.addQueryArgs(
                `/presto-player/v1/analytics/video/${mediaId}/views`,
                dateQueryArgs
              ),
              signal: abortControllerRef.current.signal,
            }),
            apiFetch({
              path: wp.url.addQueryArgs(
                `/presto-player/v1/analytics/video/${mediaId}/average-watchtime`,
                dateQueryArgs
              ),
              signal: abortControllerRef.current.signal,
            }),
            apiFetch({
              path: wp.url.addQueryArgs(
                `/presto-player/v1/analytics/video/${mediaId}/timeline`,
                dateQueryArgs
              ),
              signal: abortControllerRef.current.signal,
            }),
          ]);

          const viewCount = parseInt(viewsRes) || 0;
          const avgFormatted = formatHMS(parseFloat(avgWatchTimeRes) || 0);

          const retentionData = Array.isArray(timelineRes) ? timelineRes : [];

          setStats({
            uniqueViews: viewCount,
            avgWatchTime: avgFormatted,
            retentionData,
          });
        } catch (analyticsErr) {
          // Analytics may not be available (free version), use mock fallback
          if (analyticsErr.name !== "AbortError") {
            console.warn(
              "Analytics data unavailable, using defaults:",
              analyticsErr
            );
            setStats({
              uniqueViews: 0,
              avgWatchTime: "00:00:00",
              retentionData: [],
            });
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load media details");
          console.error("Error fetching media detail:", err);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [mediaId]
  );

  useEffect(() => {
    fetchDetail();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchDetail]);

  return { media, stats, isLoading, error, refetch: fetchDetail };
};

export default useMediaDetail;
