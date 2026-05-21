import React, { useState, useRef, useMemo, useEffect } from "react";
const { __, _n, sprintf } = wp.i18n;
import {
  Container,
  Table,
  DropdownMenu,
  Pagination,
  Button,
  Tooltip,
  toast,
} from "@bsf/force-ui";
import apiFetch from "@wordpress/api-fetch";
import {
  ChevronsUpDown,
  FolderArchive,
  Files,
  Trash,
  ArchiveRestore,
  Trash2,
  CheckCheck,
  Plus,
  Info,
} from "lucide-react";
import useMedia from "../hooks/useMedia.ts";
import {
  MediaRow,
  BulkActions,
  PostSettings,
  Filters,
  ConfirmPopup,
} from "../components/MediaHub";
import {
  statusOptions as filterStatusOptions,
  getBadge,
  formatPublishDate,
} from "../components/Emails/Utils";
import PageHeader from "../components/PageHeader";
import MediaHubPageSkeleton from "../components/Skeletons/MediaHubPageSkeleton";
import NoFound from "../components/NoFound";
import mediaHubEmptyState from "../../../../img/media-hub-empty-state.svg";

const POSTS_PER_PAGE = 10;
const EDITED_MEDIA_KEY = 'presto_edited_media_id';
// Stable empty-tags reference. `selectedMediaForSettings.tags || []` would
// create a fresh array on every parent render when the item has no tags,
// which invalidates PostSettings' reset effect and clobbers the user's
// in-progress edits each time the parent re-renders (e.g. after save).
const EMPTY_MEDIA_TAGS = [];

// sessionStorage can throw in private browsing, sandboxed iframes, or when
// site data is disabled — fail silently so the dashboard keeps working.
const editedMediaSession = {
  get: () => {
    try {
      return window.sessionStorage.getItem( EDITED_MEDIA_KEY );
    } catch ( err ) {
      return null;
    }
  },
  set: ( value ) => {
    try {
      window.sessionStorage.setItem( EDITED_MEDIA_KEY, value );
    } catch ( err ) {
      // ignore
    }
  },
  remove: () => {
    try {
      window.sessionStorage.removeItem( EDITED_MEDIA_KEY );
    } catch ( err ) {
      // ignore
    }
  },
};

const MediaHub = () => {
  const {
    media: rawMedia,
    setMedia,
    loading,
    sortField,
    sortOrder,
    handleSort,
    fetchMedia,
  } = useMedia();

  const [selected, setSelected] = useState([]);
  const [showSettingsPopup, setShowSettingsPopup] = useState(false);
  const [selectedMediaForSettings, setSelectedMediaForSettings] =
    useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = useRef(null);
  const [showFilter, setShowFilter] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [postCount, setPostCount] = useState(POSTS_PER_PAGE);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedTag, setSelectedTag] = useState("");
  const [openActionPopup, setOpenActionPopup] = useState(false);

  const handleCheckboxChange = (checked, value) => {
    if (checked) {
      setSelected([...selected, value.id]);
    } else {
      setSelected(selected.filter((item) => item !== value.id));
    }
  };

  const toggleSelectAll = (checked) => {
    if (checked) {
      setSelected(filteredAndSortedMedia.map((item) => item.id));
    } else {
      setSelected([]);
    }
  };

  const onEditClick = (e, media_id) => {
    if (e.metaKey || e.ctrlKey) {
      return;
    }
    e.preventDefault();

    editedMediaSession.set( media_id );
    const editUrl = `post.php?post=${media_id}&action=edit`;
    window.open(editUrl, "_self");
  };

  const handleOpenSettings = (event, mediaData) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedMediaForSettings(mediaData);
    setShowSettingsPopup(true);
  };

  const handleSettingsSuccess = (wpPost, { passwordTouched, tagOptions } = {}) => {
    if (!selectedMediaForSettings || !wpPost) return;

    // Resolve tag objects from the combined pool of availableTagsList + tagOptions
    // (tagOptions includes any tags the user created during the dialog session).
    let resolvedTags = null;
    if (wpPost.pp_video_tag && Array.isArray(wpPost.pp_video_tag) && wpPost.pp_video_tag.length > 0) {
      const allKnownTags = new Map();
      availableTagsList.forEach((t) => allKnownTags.set(t.id, t));
      if (tagOptions) {
        tagOptions.forEach((t) => {
          if (typeof t.id === "number") {
            allKnownTags.set(t.id, t);
          }
        });
      }
      resolvedTags = wpPost.pp_video_tag
        .map((id) => allKnownTags.get(id))
        .filter(Boolean)
        .map((t) => ({ id: t.id, name: t.name, slug: t.slug || "" }));
    }

    setMedia((prevMedia) =>
      prevMedia.map((post) => {
        if (post.id !== selectedMediaForSettings.id) return post;

        const newTitle =
          typeof wpPost.title === "object"
            ? wpPost.title.rendered || wpPost.title.raw || post.title
            : wpPost.title || post.title;

        return {
          ...post,
          title: newTitle,
          status: wpPost.status || post.status,
          post_date: wpPost.date || post.post_date,
          post_name: wpPost.slug || post.post_name,
          // Only update password if the user modified it — WP REST API
          // never returns the real password value, so wpPost.password is always "".
          post_password: passwordTouched ? (wpPost.password || "") : post.post_password,
          tags: resolvedTags !== null ? resolvedTags : post.tags,
        };
      })
    );
  };

  const actionMenus = [
    {
      label: __("Duplicate", "presto-player"),
      value: "duplicate",
      icon: <Files width="15" height="15" />,
    },
    {
      label: __("Save as Draft", "presto-player"),
      value: "draft",
      icon: <FolderArchive width="15" height="15" />,
    },
    {
      label: __("Mark as Publish", "presto-player"),
      value: "publish",
      icon: <CheckCheck width="15" height="15" />,
    },
    {
      label: __("Move to Trash", "presto-player"),
      value: "trash",
      icon: <Trash width="15" height="15" />,
    },
    {
      label: __("Delete Permanently", "presto-player"),
      value: "delete",
      icon: <Trash2 width="15" height="15" />,
    },
    {
      label: __("Restore", "presto-player"),
      value: "restore",
      icon: <ArchiveRestore width="15" height="15" />,
    },
  ];

  const defaultPopupState = {
    title: __("Are you sure?", "presto-player"),
    description: __("Are you sure you want to proceed?", "presto-player"),
    confirmText: __("Confirm", "presto-player"),
    cancelText: __("Cancel", "presto-player"),
    confirmCallback: () => {},
    cancelCallback: () => {},
  };
  const [actionPopupData, setActionPopupData] = useState(defaultPopupState);

  const performOperation = (mediaId, mediaAction) => {
    const formData = new window.FormData();
    formData.append("media_id", mediaId);

    apiFetch({
      path: "/presto-player/v1/duplicate-media",
      method: "POST",
      body: formData,
    })
      .then((response) => {
        if (response.success) {
          setMedia((prevMedia) => {
            if (mediaAction === "duplicate") {
              // Find the index of the original media
              const originalIndex = prevMedia.findIndex(
                (mediaItem) => mediaItem.id === mediaId
              );
              if (originalIndex !== -1) {
                // Insert the duplicated media right after the original
                const newData = [...prevMedia];
                newData.splice(originalIndex + 1, 0, response?.data?.media);
                return newData;
              }
              // Fallback: append to end if original not found
              return [...prevMedia, response?.data?.media];
            }
            return prevMedia;
          });
          setOpenActionPopup(false);
          toast.success(response?.data?.message);
        }
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  };

  const handleMenuActions = (mediaId, mediaAction) => {
    const actionWisePopupData = {
      duplicate: {
        title: __("Duplicate?", "presto-player"),
        description: __(
          "Are you sure you want to duplicate this media?",
          "presto-player"
        ),
        confirmText: __("Duplicate", "presto-player"),
        confirmCallback: () => {
          performOperation(mediaId, mediaAction);
        },
        cancelCallback: () => {
          setOpenActionPopup(false);
        },
      },
      draft: {
        title: __("Save as Draft?", "presto-player"),
        description: __(
          "Are you sure you want to mark this media as a draft?",
          "presto-player"
        ),
        confirmText: __("Save as Draft", "presto-player"),
        confirmCallback: () => {
          apiFetch({
            path: `/wp/v2/presto-videos/${mediaId}`,
            method: "POST",
            data: { status: "draft" },
          })
            .then(() => {
              setMedia((prevMedia) =>
                prevMedia.map((item) =>
                  item.id === mediaId ? { ...item, status: "draft" } : item
                )
              );
              setOpenActionPopup(false);
              toast.success(__("Successfully drafted.", "presto-player"));
            })
            .catch((error) => {
              console.error("Error updating media status:", error);
              toast.error(__("Failed to draft.", "presto-player"));
            });
        },
        cancelCallback: () => {
          setOpenActionPopup(false);
        },
      },
      publish: {
        title: __("Publish?", "presto-player"),
        description: __(
          "Are you sure you want to publish this media?",
          "presto-player"
        ),
        confirmText: __("Publish", "presto-player"),
        confirmCallback: () => {
          apiFetch({
            path: `/wp/v2/presto-videos/${mediaId}`,
            method: "POST",
            data: { status: "publish" },
          })
            .then(() => {
              setMedia((prevMedia) =>
                prevMedia.map((item) =>
                  item.id === mediaId ? { ...item, status: "publish" } : item
                )
              );
              setOpenActionPopup(false);
              toast.success(__("Successfully published.", "presto-player"));
            })
            .catch((error) => {
              console.error("Error updating media status:", error);
              toast.error(__("Failed to publish.", "presto-player"));
            });
        },
        cancelCallback: () => {
          setOpenActionPopup(false);
        },
      },
      trash: {
        title: __("Move to Trash?", "presto-player"),
        description: __(
          "Are you sure you want to move this media to the trash?",
          "presto-player"
        ),
        confirmText: __("Move to Trash", "presto-player"),
        destructive: true,
        confirmCallback: () => {
          // Native DELETE without ?force=true = wp_trash_post.
          apiFetch({
            path: `/wp/v2/presto-videos/${mediaId}`,
            method: "DELETE",
          })
            .then(() => {
              setMedia((prevMedia) =>
                prevMedia.map((item) =>
                  item.id === mediaId ? { ...item, status: "trash" } : item
                )
              );
              setOpenActionPopup(false);
              toast.success(__("Successfully trashed.", "presto-player"));
            })
            .catch((error) => {
              console.error("Error trashing media:", error);
              toast.error(__("Failed to trash.", "presto-player"));
            });
        },
        cancelCallback: () => {
          setOpenActionPopup(false);
        },
      },
      delete: {
        title: __("Delete?", "presto-player"),
        description: __(
          "This will permanently delete this media. It cannot be recovered. To remove it temporarily instead, use Trash.",
          "presto-player"
        ),
        confirmText: __("Delete", "presto-player"),
        destructive: true,
        confirmCallback: () => {
          // Native DELETE with ?force=true = wp_delete_post (permanent).
          apiFetch({
            path: `/wp/v2/presto-videos/${mediaId}?force=true`,
            method: "DELETE",
          })
            .then(() => {
              setMedia((prevMedia) =>
                prevMedia.filter((item) => item.id !== mediaId)
              );
              setOpenActionPopup(false);
              toast.success(
                __("Media deleted successfully.", "presto-player")
              );
            })
            .catch((error) => {
              console.error("Error deleting media:", error);
              toast.error(__("Failed to delete media.", "presto-player"));
            });
        },
        cancelCallback: () => {
          setOpenActionPopup(false);
        },
      },
      restore: {
        title: __("Restore?", "presto-player"),
        description: __(
          "Are you sure you want to restore this media?",
          "presto-player"
        ),
        confirmText: __("Restore", "presto-player"),
        confirmCallback: () => {
          // Restore = set status to draft via native PUT.
          apiFetch({
            path: `/wp/v2/presto-videos/${mediaId}`,
            method: "POST",
            data: { status: "draft" },
          })
            .then(() => {
              setMedia((prevMedia) =>
                prevMedia.map((item) =>
                  item.id === mediaId ? { ...item, status: "draft" } : item
                )
              );
              setOpenActionPopup(false);
              toast.success(__("Successfully restored.", "presto-player"));
            })
            .catch((error) => {
              console.error("Error restoring media:", error);
              toast.error(__("Failed to restore.", "presto-player"));
            });
        },
        cancelCallback: () => {
          setOpenActionPopup(false);
        },
      },
    };

    setActionPopupData(actionWisePopupData[mediaAction]);
    setOpenActionPopup(true);
  };

  const renderActionMenu = (mediaItem) => {
    let actions = actionMenus.filter(
      (item) => item.value !== mediaItem?.status
    );

    if (mediaItem?.status === "trash") {
      actions = actionMenus.filter(
        (item) => item.value === "restore" || item.value === "delete"
      );
    } else {
      actions = actions.filter(
        (item) => item.value !== "restore" && item.value !== "delete"
      );
    }

    return actions.map((action) => (
      <DropdownMenu.Item
        key={action.value}
        onClick={() => handleMenuActions(mediaItem.id, action.value)}
        className="text-sm"
      >
        <div className="flex items-center gap-2">
          {action.icon}
          {action.label}
        </div>
      </DropdownMenu.Item>
    ));
  };

  const handleBulkDelete = (selectedIds) => {
    if (!selectedIds || selectedIds.length === 0) {
      return Promise.resolve();
    }

    // Delete each item via native WP REST API.
    const deletePromises = selectedIds.map((mediaId) => {
      return apiFetch({
        path: `/wp/v2/presto-videos/${mediaId}?force=true`,
        method: "DELETE",
      })
        .then(() => {
          return { success: true, mediaId };
        })
        .catch((error) => {
          console.error(`Error deleting media ${mediaId}:`, error);
          return { success: false, mediaId };
        });
    });

    return Promise.all(deletePromises).then((results) => {
      const successfulIds = results
        .filter((r) => r && r.success)
        .map((r) => r.mediaId);
      const successCount = successfulIds.length;
      const failedCount = results.length - successCount;

      // Update local state to remove successfully deleted items
      setMedia((prevMedia) => {
        return prevMedia.filter((item) => !successfulIds.includes(item.id));
      });

      setSelected([]);

      if (successCount > 0) {
        toast.success(
          sprintf(
            /* translators: %d: number of media items deleted */
            _n(
              "%d media item deleted successfully.",
              "%d media items deleted successfully.",
              successCount,
              "presto-player"
            ),
            successCount
          )
        );
      }
      if (failedCount > 0) {
        toast.error(
          sprintf(
            /* translators: %d: number of media items that failed to delete */
            _n(
              "Failed to delete %d media item.",
              "Failed to delete %d media items.",
              failedCount,
              "presto-player"
            ),
            failedCount
          )
        );
      }
    });
  };

  const handleBulkTrash = (selectedIds) => {
    if (!selectedIds || selectedIds.length === 0) {
      return Promise.resolve();
    }

    // Native DELETE without ?force=true = wp_trash_post (soft delete).
    const trashPromises = selectedIds.map((mediaId) =>
      apiFetch({
        path: `/wp/v2/presto-videos/${mediaId}`,
        method: "DELETE",
      })
        .then(() => ({ success: true, mediaId }))
        .catch((error) => {
          console.error(`Error trashing media ${mediaId}:`, error);
          return { success: false, mediaId };
        })
    );

    return Promise.all(trashPromises).then((results) => {
      const successfulIds = results
        .filter((r) => r && r.success)
        .map((r) => r.mediaId);
      const successCount = successfulIds.length;
      const failedCount = results.length - successCount;

      setMedia((prevMedia) =>
        prevMedia.map((item) =>
          successfulIds.includes(item.id) ? { ...item, status: "trash" } : item
        )
      );
      setSelected([]);

      if (successCount > 0) {
        toast.success(
          sprintf(
            /* translators: %d: number of media items moved to trash */
            _n(
              "%d media item moved to trash.",
              "%d media items moved to trash.",
              successCount,
              "presto-player"
            ),
            successCount
          )
        );
      }
      if (failedCount > 0) {
        toast.error(
          sprintf(
            /* translators: %d: number of media items that failed to move to trash */
            _n(
              "Failed to trash %d media item.",
              "Failed to trash %d media items.",
              failedCount,
              "presto-player"
            ),
            failedCount
          )
        );
      }
    });
  };

  const handleBulkStatusChange = (selectedIds, status) => {
    if (!selectedIds || selectedIds.length === 0) return;

    const promises = selectedIds.map((mediaId) =>
      apiFetch({
        path: `/wp/v2/presto-videos/${mediaId}`,
        method: "POST",
        data: { status },
      })
        .then(() => ({ success: true, mediaId }))
        .catch(() => ({ success: false, mediaId }))
    );

    Promise.all(promises).then((results) => {
      const successfulIds = results.filter((r) => r.success).map((r) => r.mediaId);
      const failedCount = results.length - successfulIds.length;

      setMedia((prev) =>
        prev.map((item) =>
          successfulIds.includes(item.id) ? { ...item, status } : item
        )
      );
      setSelected([]);

      if (successfulIds.length > 0) {
        toast.success(
          sprintf(
            /* translators: 1: number of items updated, 2: new status (e.g. "publish") */
            _n(
              "%1$d item updated to %2$s.",
              "%1$d items updated to %2$s.",
              successfulIds.length,
              "presto-player"
            ),
            successfulIds.length,
            status
          )
        );
      }
      if (failedCount > 0) {
        toast.error(
          sprintf(
            /* translators: %d: number of items that failed to update */
            _n(
              "Failed to update %d item.",
              "Failed to update %d items.",
              failedCount,
              "presto-player"
            ),
            failedCount
          )
        );
      }
    });
  };

  const handleBulkCancel = () => {
    setSelected([]);
  };

  const handleSearchResult = (value) => {
    setSearchTerm(value);
  };

  const onAddNewClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const newPostUrl = `post-new.php?post_type=pp_video_block`;
    window.open(newPostUrl, "_self");
  };

  const availableTagsList = useMemo(() => {
    if (!rawMedia) return [];
    const tagMap = new Map();
    rawMedia.forEach((item) => {
      if (item.tags) {
        item.tags.forEach((tag) => {
          if (tag.id && tag.name) {
            tagMap.set(tag.id, tag);
          }
        });
      }
    });
    return Array.from(tagMap.values());
  }, [rawMedia]);

  const tagOptions = useMemo(
    () => [
      { id: "", name: __("All Tags", "presto-player") },
      ...availableTagsList,
    ],
    [availableTagsList]
  );

  const handleClearFilters = () => {
    setSelectedStatus("all");
    setSelectedTag("");
    setCurrentPage(1);
    setPostCount(POSTS_PER_PAGE);
  };

  useEffect(() => {
    if (![10, 25, 50, 75, 100].includes(postCount)) {
      setPostCount(10);
    }
  }, [postCount]);

  // Reset to page 1 and clear selection when filters change.
  useEffect(() => {
    setCurrentPage(1);
    setSelected([]);
  }, [searchTerm, selectedStatus, selectedTag]);

  const filteredAndSortedMedia = useMemo(() => {
    const filtered = rawMedia?.filter((item) => {
      const matchesSearch = searchTerm
        ? item.title.toLowerCase().includes(searchTerm.toLowerCase())
        : true;

      const matchesStatus =
        selectedStatus === "all" || item.status === selectedStatus;

      const matchesTag = selectedTag
        ? item.tags?.some((tag) => parseInt(tag.id) === parseInt(selectedTag))
        : true;

      return matchesSearch && matchesStatus && matchesTag;
    });

    if (!filtered || filtered?.length === 0) {
      return [];
    }

    // Sorting Logic — Unicode-aware icon detection so accented and non-Latin
    // titles (École, 東京, Über) stay in the alphanumeric bucket; only true
    // emoji/punctuation/symbol leads sort into the "icons" pile.
    const sorted = [...filtered]?.sort((a, b) => {
      if (sortField === "title") {
        const isAIcon = /^[^\p{L}\p{N}]/u.test(a.title);
        const isBIcon = /^[^\p{L}\p{N}]/u.test(b.title);

        if (sortOrder === "asc") {
          if (isAIcon && !isBIcon) {
            return 1;
          }
          if (!isAIcon && isBIcon) {
            return -1;
          }
          return a.title.localeCompare(b.title);
        }
        if (isAIcon && !isBIcon) {
          return -1;
        }
        if (!isAIcon && isBIcon) {
          return 1;
        }
        return b.title.localeCompare(a.title);
      }

      const dateA = new Date(a.post_date).getTime();
      const dateB = new Date(b.post_date).getTime();

      if (sortOrder === "asc") {
        return dateA - dateB;
      }
      return dateB - dateA;
    });

    return sorted;
  }, [rawMedia, searchTerm, selectedStatus, selectedTag, sortOrder, sortField]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * postCount;
    return filteredAndSortedMedia?.slice(startIndex, startIndex + postCount);
  }, [filteredAndSortedMedia, currentPage, postCount]);

  useEffect( () => {
    const editedId = editedMediaSession.get();
    if ( ! editedId || ! filteredAndSortedMedia?.length ) return;

    const itemIndex = filteredAndSortedMedia.findIndex( ( item ) => String( item.id ) === editedId );
    if ( itemIndex === -1 ) {
      editedMediaSession.remove();
      return;
    }

    const targetPage = Math.ceil( ( itemIndex + 1 ) / postCount );
    if ( targetPage !== currentPage ) {
      setCurrentPage( targetPage );
      return;
    }

    setTimeout( () => {
      const el = document.querySelector( `[data-id="${ editedId }"]` );
      if ( el ) {
        el.scrollIntoView( { behavior: 'smooth', block: 'center' } );
        el.classList.add( 'bg-brand-background-hover-100', 'transition-all', 'duration-300' );
        setTimeout( () => {
          el.classList.remove( 'bg-brand-background-hover-100' );
          setTimeout( () => el.classList.remove( 'transition-all', 'duration-300' ), 300 );
        }, 1300 );
      }
      editedMediaSession.remove();
    }, 200 );
  }, [ filteredAndSortedMedia, currentPage ] );

  const renderPagination = () => {
    const totalPages = Math.ceil(filteredAndSortedMedia?.length / postCount);
    if (totalPages <= 1) {
      return null;
    }

    const pages = [];

    const renderPageItem = (i) => (
      <Pagination.Item
        key={i}
        isActive={i === currentPage}
        onClick={() => setCurrentPage(i)}
      >
        {i}
      </Pagination.Item>
    );

    const showEllipsis = (key) => <Pagination.Ellipsis key={key} />;

    // Always show first page
    pages.push(renderPageItem(1));

    // Show left-side ellipsis if currentPage > 3
    if (currentPage > 3) {
      pages.push(showEllipsis("left-ellipsis"));
    }

    // Show middle pages (currentPage - 1, currentPage, currentPage + 1)
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      pages.push(renderPageItem(i));
    }

    // Show right-side ellipsis if currentPage < totalPages - 2
    if (currentPage < totalPages - 2) {
      pages.push(showEllipsis("right-ellipsis"));
    }

    // Always show last page if totalPages > 1
    if (totalPages > 1) {
      pages.push(renderPageItem(totalPages));
    }

    return (
      <>
        <Pagination.Previous
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
        />
        {pages}
        <Pagination.Next
          onClick={() =>
            setCurrentPage((prev) => Math.min(prev + 1, totalPages))
          }
          disabled={currentPage === totalPages}
        />
      </>
    );
  };

  const containerClassName = "p-8";

  const startIndex = (currentPage - 1) * postCount + 1; // eslint-disable-line no-mixed-operators
  const endIndex = Math.min(currentPage * postCount, filteredAndSortedMedia?.length || 0);

  if (!loading && rawMedia?.length === 0) {
    return (
      <Container
        className={`${containerClassName} flex-1 items-center justify-start pt-16`}
        direction="column"
      >
        <NoFound
          icon={
            <img
              src={mediaHubEmptyState}
              width={70}
              height={53}
              alt=""
            />
          }
          title={__("Your media will be displayed here.", "presto-player")}
          description={__(
            'Click the "Add Media" button to create a new Media Hub item',
            "presto-player"
          )}
          buttonText={__("Add Media", "presto-player")}
          buttonIcon={<Plus aria-label="icon" role="img" />}
          onButtonClick={onAddNewClick}
        />
      </Container>
    );
  }

  return (
    <>
      {selectedMediaForSettings && (
        <PostSettings
          open={showSettingsPopup}
          onClose={() => {
            setShowSettingsPopup(false);
            setSelectedMediaForSettings(null);
          }}
          onSuccess={handleSettingsSuccess}
          mediaId={selectedMediaForSettings.id}
          initialTitle={selectedMediaForSettings.title || ""}
          initialStatus={selectedMediaForSettings.status || "publish"}
          initialSlug={selectedMediaForSettings.post_name || ""}
          initialDate={selectedMediaForSettings.post_date || ""}
          initialPassword={selectedMediaForSettings.post_password || ""}
          initialTags={selectedMediaForSettings.tags || EMPTY_MEDIA_TAGS}
          availableTags={availableTagsList}
        />
      )}

      {loading ? (
        <MediaHubPageSkeleton />
      ) : (
        <Container className={containerClassName} gap="md" direction="column">
          <PageHeader
            title={__("Media Hub", "presto-player")}
            showFilter={showFilter}
            setShowFilter={setShowFilter}
            showFilterWhen={rawMedia?.length > 0}
            searchPlaceholder={__("Search media…", "presto-player")}
            searchValue={searchTerm}
            onSearchChange={(value) => handleSearchResult(value)}
            searchInputRef={searchInputRef}
            primaryButtonText={__("New Media", "presto-player")}
            onPrimaryClick={onAddNewClick}
          />

          <Container gap="lg" direction="column">
            <BulkActions
              selected={selected}
              onTrash={(selectedIds) => {
                setActionPopupData({
                  title: __("Move Selected to Trash?", "presto-player"),
                  description: sprintf(
                    /* translators: %d: number of selected items being moved to trash */
                    _n(
                      "Are you sure you want to move %d item to the trash?",
                      "Are you sure you want to move %d items to the trash?",
                      selectedIds.length,
                      "presto-player"
                    ),
                    selectedIds.length
                  ),
                  confirmText: __("Move to Trash", "presto-player"),
                  destructive: true,
                  confirmCallback: () => handleBulkTrash(selectedIds),
                  cancelCallback: () => {
                    setOpenActionPopup(false);
                  },
                });
                setOpenActionPopup(true);
              }}
              onDelete={(selectedIds) => {
                setActionPopupData({
                  title: __("Delete Selected Items?", "presto-player"),
                  description: sprintf(
                    /* translators: %d: number of selected items being permanently deleted */
                    _n(
                      "This will permanently delete %d item. It cannot be recovered. To remove it temporarily instead, use Trash.",
                      "This will permanently delete %d items. They cannot be recovered. To remove them temporarily instead, use Trash.",
                      selectedIds.length,
                      "presto-player"
                    ),
                    selectedIds.length
                  ),
                  confirmText: __("Delete", "presto-player"),
                  destructive: true,
                  confirmCallback: () => handleBulkDelete(selectedIds),
                  cancelCallback: () => {
                    setOpenActionPopup(false);
                  },
                });
                setOpenActionPopup(true);
              }}
              onStatusChange={handleBulkStatusChange}
              onCancel={handleBulkCancel}
            />
            {rawMedia?.length > 0 && (
              <div className="gap-0">
                {showFilter && (
                  <Filters
                    postCount={postCount}
                    setPostCount={setPostCount}
                    perPageLabel={__("Posts", "presto-player")}
                    selects={[
                      { options: filterStatusOptions, value: selectedStatus, onChange: setSelectedStatus },
                      {
                        options: tagOptions.map((t) => ({ value: t.id, label: t.name })),
                        value: selectedTag,
                        onChange: setSelectedTag,
                      },
                    ]}
                    onClear={handleClearFilters}
                  />
                )}
                <Table checkboxSelection={true}>
                  <Table.Head
                    selected={selected.length > 0 && selected.length === filteredAndSortedMedia.length}
                    onChangeSelection={toggleSelectAll}
                    indeterminate={
                      selected.length > 0 && selected.length < filteredAndSortedMedia.length
                    }
                    className="bg-background-primary items-center"
                  >
                    <Table.HeadCell
                      onClick={() => handleSort("title")}
                      style={{ width: "300px" }}
                      className="cursor-pointer items-center gap-2 text-text-secondary"
                    >
                      {__("Media", "presto-player")}
                      <ChevronsUpDown
                        width="15"
                        height="15"
                        className={`text-icon-secondary align-middle ml-2${sortField === "title" && sortOrder === "asc" ? " rotate-180" : ""}`}
                      />
                    </Table.HeadCell>

                    <Table.HeadCell
                      style={{ width: "100px" }}
                      className="text-text-secondary items-center"
                    >
                      {__("Status", "presto-player")}
                    </Table.HeadCell>

                    <Table.HeadCell
                      style={{ width: "260px" }}
                      className="text-text-secondary"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {__("Tags", "presto-player")}
                        <Tooltip
                          content={__(
                            "Tags help organize and filter your media library.",
                            "presto-player"
                          )}
                          arrow
                          placement="top"
                        >
                          <Info className="size-3.5 text-icon-secondary cursor-help shrink-0" />
                        </Tooltip>
                      </span>
                    </Table.HeadCell>

                    <Table.HeadCell
                      style={{ width: "220px" }}
                      className="text-text-secondary"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {__("Shortcode", "presto-player")}
                        <Tooltip
                          content={__(
                            "Copy the shortcode to embed this media in any post, page, or widget.",
                            "presto-player"
                          )}
                          arrow
                          placement="top"
                        >
                          <Info className="size-3.5 text-icon-secondary cursor-help shrink-0" />
                        </Tooltip>
                      </span>
                    </Table.HeadCell>

                    <Table.HeadCell
                      onClick={() => handleSort("date")}
                      style={{ width: "180px" }}
                      className="cursor-pointer items-center gap-2 text-text-secondary"
                    >
                      {__("Published on", "presto-player")}
                      <ChevronsUpDown
                        width="15"
                        height="15"
                        className={`text-icon-secondary align-middle ml-2${sortField === "date" && sortOrder === "asc" ? " rotate-180" : ""}`}
                      />
                    </Table.HeadCell>

                    <Table.HeadCell
                      style={{ width: "140px" }}
                      className="items-center justify-center"
                    >
                      <span className="sr-only">Actions</span>
                    </Table.HeadCell>
                  </Table.Head>

                  <Table.Body>
                    {paginatedData && paginatedData.length > 0 ? (
                      paginatedData.map((item) => (
                        <MediaRow
                          key={item.id}
                          item={item}
                          selected={selected.includes(item.id)}
                          onChangeSelection={handleCheckboxChange}
                          onEditClick={onEditClick}
                          renderActionMenu={renderActionMenu}
                          getBadge={getBadge}
                          formatPublishDate={formatPublishDate}
                          handleOpenSettings={handleOpenSettings}
                        />
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="7"
                          className="px-6 py-8 text-center text-sm text-text-secondary"
                        >
                          {__("No media found.", "presto-player")}
                        </td>
                      </tr>
                    )}
                  </Table.Body>

                  {paginatedData?.length > 0 && (
                    <Table.Footer className="bg-background-primary">
                      <div className="flex items-center justify-between w-full">
                        <span className="text-sm font-normal leading-5 text-text-secondary">
                          {`${startIndex}–${endIndex} ${__(
                            "of",
                            "presto-player"
                          )} ${filteredAndSortedMedia?.length || 0} ${__(
                            "items",
                            "presto-player"
                          )}`}
                        </span>
                        <Pagination className="w-fit">
                          <Pagination.Content>
                            {renderPagination()}
                          </Pagination.Content>
                        </Pagination>
                      </div>
                    </Table.Footer>
                  )}
                </Table>
              </div>
            )}
          </Container>
        </Container>
      )}

      <ConfirmPopup
        openConfirmPopup={openActionPopup}
        setOpenConfirmPopup={setOpenActionPopup}
        title={actionPopupData?.title || ""}
        description={actionPopupData?.description || ""}
        confirmText={actionPopupData?.confirmText || ""}
        cancelText={
          actionPopupData?.cancelText || __("Cancel", "presto-player")
        }
        confirmCallback={actionPopupData?.confirmCallback}
        cancelCallback={actionPopupData?.cancelCallback}
        destructive={actionPopupData?.destructive || false}
      />
    </>
  );
};

export default MediaHub;
