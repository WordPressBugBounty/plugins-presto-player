import { useState, useEffect, useCallback, useMemo, useRef } from "@wordpress/element";
import apiFetch from "@wordpress/api-fetch";
import { addQueryArgs } from "@wordpress/url";
import {
  getLastNDays,
  humanSeconds,
  toAnalyticsDate,
  DEFAULT_ANALYTICS_DAYS,
} from "../utils";
import useTopVideosPaginated from "./useTopVideosPaginated";

const { __ } = wp.i18n;

const TOP_MEDIA_PER_PAGE = 10;

/**
 * Hook to fetch analytics data for a single user.
 *
 * Owns user metadata + stats. Delegates the paginated Top Media table
 * to `useTopVideosPaginated` (the same hook the Analytics page uses,
 * with `userId` set so the server-side filter applies).
 *
 * Fetches:
 *  - User metadata (name, email, avatar) via WP REST API
 *  - Total / average / total watch time stats
 *  - Current page of top media (paginated; default last-30-days range
 *    when no explicit range is set)
 */
const useUserDetail = (userId) => {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    totalViews: 0,
    avgWatchTime: "0s",
    totalWatchTime: "0s",
  });
  const [dateRange, setDateRange] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const statsAbortRef = useRef(null);

  // The user detail page mirrors the Analytics page's default scope:
  // last 7 days when no explicit range is set, matching the picker default.
  const dateParams = useMemo(() => {
    const range =
      dateRange?.from && dateRange?.to
        ? dateRange
        : getLastNDays(DEFAULT_ANALYTICS_DAYS);
    return {
      start: toAnalyticsDate(range.from),
      end: toAnalyticsDate(range.to),
    };
  }, [dateRange]);

  const {
    topMedia,
    page: mediaPage,
    setPage: setMediaPage,
    pagination: mediaPagination,
    perPage: mediaPerPage,
  } = useTopVideosPaginated({
    userId,
    dateParams,
    perPage: TOP_MEDIA_PER_PAGE,
    enabled: !!userId,
  });

  // Stats + user metadata fetch. Page changes don't trigger this — only
  // userId or date changes do.
  useEffect(() => {
    if (!userId) return undefined;

    statsAbortRef.current?.abort();
    statsAbortRef.current = new AbortController();
    const { signal } = statsAbortRef.current;

    (async () => {
      try {
        setIsLoading(true);
        setError(null);

        const userResponse = await apiFetch({
          path: `/wp/v2/users/${userId}?context=edit`,
          signal,
        });

        setUser({
          id: userResponse.id,
          name: userResponse.name || `User #${userId}`,
          email: userResponse.email || "",
          avatarUrl:
            userResponse.avatar_urls?.["96"] ||
            userResponse.avatar_urls?.["48"] ||
            null,
          profileUrl: `${window.location.origin}/wp-admin/user-edit.php?user_id=${userResponse.id}`,
        });

        try {
          const [totalViewsRes, avgWatchTimeRes, totalWatchTimeRes] =
            await Promise.all([
              apiFetch({
                path: addQueryArgs(
                  `/presto-player/v1/analytics/user/${userId}/total-views`,
                  dateParams
                ),
                signal,
              }),
              apiFetch({
                path: addQueryArgs(
                  `/presto-player/v1/analytics/user/${userId}/average-watchtime`,
                  dateParams
                ),
                signal,
              }),
              apiFetch({
                path: addQueryArgs(
                  `/presto-player/v1/analytics/user/${userId}/total-watchtime`,
                  dateParams
                ),
                signal,
              }),
            ]);

          const viewCount = parseInt(totalViewsRes?.view) || 0;
          setStats({
            totalViews: viewCount,
            avgWatchTime: viewCount
              ? humanSeconds(parseFloat(avgWatchTimeRes?.view) || 0)
              : "0s",
            totalWatchTime: viewCount
              ? humanSeconds(parseFloat(totalWatchTimeRes?.view) || 0)
              : "0s",
          });
        } catch (analyticsErr) {
          if (analyticsErr.name !== "AbortError") {
            console.warn(
              "Analytics data unavailable, using defaults:",
              analyticsErr
            );
            setStats({
              totalViews: 0,
              avgWatchTime: "0s",
              totalWatchTime: "0s",
            });
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          if (
            err.code === "rest_user_invalid_id" ||
            err.code === "rest_no_route"
          ) {
            setError(__("User not found", "presto-player"));
          } else {
            setError(
              err.message ||
                __("Failed to load user details", "presto-player")
            );
          }
          console.error("Error fetching user detail:", err);
        }
      } finally {
        setIsLoading(false);
      }
    })();

    return () => statsAbortRef.current?.abort();
  }, [userId, dateParams]);

  // Public refetch hook for the date-range picker. The shared media hook
  // resets its own page on dateParams change; we just push the new range
  // into local state.
  const refetch = useCallback((startDate, endDate) => {
    if (startDate && endDate) {
      setDateRange({ from: startDate, to: endDate });
    } else {
      setDateRange(null);
    }
  }, []);

  return {
    user,
    stats,
    topMedia,
    mediaPage,
    setMediaPage,
    mediaPagination,
    mediaPerPage,
    isLoading,
    error,
    refetch,
  };
};

export default useUserDetail;
