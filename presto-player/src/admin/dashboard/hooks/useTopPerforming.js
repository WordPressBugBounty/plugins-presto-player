import { useState, useEffect, useMemo } from "@wordpress/element";
import apiFetch from "@wordpress/api-fetch";
import { addQueryArgs } from "@wordpress/url";
import { transformUserItem } from "../utils/transformers";
import { ALL_TIME_START, toAnalyticsDate } from "../utils";
import useTopVideosPaginated from "./useTopVideosPaginated";

/**
 * Hook to fetch top performing media and users with server-side pagination.
 *
 * Pass `selectedDates` (the same shape exposed by `useEngagementChartData`)
 * to keep the tables in sync with the chart's date filter. When
 * `selectedDates` is null/empty, the hook falls back to all-time so the
 * Dashboard tab and free-version surfaces keep their existing snapshot
 * behaviour.
 *
 * Both media and users are paginated via the same X-WP-Total /
 * X-WP-TotalPages convention exposed by the analytics REST controller.
 * Each card owns its own fetch lifecycle and abort controller so the two
 * tables can re-paginate independently without cancelling one another.
 *
 * @param {Object}   options
 * @param {number}   [options.mediaPerPage=10]
 * @param {number}   [options.usersPerPage=5]
 * @param {{from: ?Date, to: ?Date}} [options.selectedDates]
 */
const useTopPerforming = ({
  mediaPerPage = 10,
  usersPerPage = 5,
  selectedDates,
} = {}) => {
  const isPremium = !!window?.prestoPlayer?.isPremium;

  const dateParams = useMemo(() => {
    const from = selectedDates?.from;
    const to = selectedDates?.to;
    return {
      start: from ? toAnalyticsDate(from) : ALL_TIME_START,
      end: toAnalyticsDate(to || from || new Date()),
    };
  }, [selectedDates?.from, selectedDates?.to]);

  // --- Media (delegated to the shared paginated hook) ---
  const {
    topMedia,
    isLoading: isLoadingMedia,
    error: mediaError,
    page: mediaPage,
    setPage: setMediaPage,
    pagination: mediaPagination,
  } = useTopVideosPaginated({
    dateParams,
    perPage: mediaPerPage,
    enabled: isPremium,
  });

  // --- Users (kept inline; no equivalent shared hook yet) ---
  const [topUsers, setTopUsers] = useState([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPagination, setUsersPagination] = useState({
    totalItems: 0,
    totalPages: 0,
  });
  const [usersError, setUsersError] = useState(null);
  const [hasLoadedUsers, setHasLoadedUsers] = useState(!isPremium);

  useEffect(() => {
    setUsersPage(1);
  }, [dateParams.start, dateParams.end]);

  useEffect(() => {
    if (!isPremium) {
      setTopUsers([]);
      setHasLoadedUsers(true);
      return undefined;
    }

    const controller = new AbortController();

    (async () => {
      try {
        const response = await apiFetch({
          path: addQueryArgs(window.prestoPlayer.api.analyticsTopUsers, {
            ...dateParams,
            per_page: usersPerPage,
            page: usersPage,
          }),
          parse: false,
          signal: controller.signal,
        });
        const totalItems = parseInt(
          response.headers.get("X-WP-Total") || "0",
          10
        );
        const totalPages = parseInt(
          response.headers.get("X-WP-TotalPages") || "0",
          10
        );
        const json = await response.json();

        setTopUsers((json || []).map(transformUserItem));
        setUsersPagination({ totalItems, totalPages });
        setUsersError(null);
      } catch (err) {
        if (err.name === "AbortError") return;
        setUsersError(err.message || "An error occurred");
        console.error("Error fetching top performing users:", err);
        setTopUsers([]);
      } finally {
        setHasLoadedUsers(true);
      }
    })();

    return () => controller.abort();
  }, [isPremium, dateParams, usersPage, usersPerPage]);

  const data = {
    topMedia,
    topUsers,
  };

  const isLoading = isPremium && (isLoadingMedia || !hasLoadedUsers);
  const error = mediaError || usersError;

  return {
    data,
    isLoading,
    error,
    mediaPage,
    setMediaPage,
    mediaPagination,
    usersPage,
    setUsersPage,
    usersPagination,
  };
};

export default useTopPerforming;
