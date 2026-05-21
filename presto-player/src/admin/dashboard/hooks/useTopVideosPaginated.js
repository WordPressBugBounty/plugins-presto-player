import { useState, useEffect } from "@wordpress/element";
import apiFetch from "@wordpress/api-fetch";
import { addQueryArgs } from "@wordpress/url";
import { transformMediaItem } from "../utils/transformers";

/**
 * Paginated fetch of /analytics/top-videos with X-WP-Total /
 * X-WP-TotalPages support. Caller controls scope via `userId` (filter)
 * and `dateParams` ({ start, end } ISO datetime strings) — the hook
 * deliberately does no date defaulting so each consumer (Analytics
 * "all-time" vs User Detail "last 30 days") keeps its own policy.
 *
 * Page automatically resets to 1 when the scope changes (userId or
 * date range), since the previous page index may not exist in the new
 * result set.
 *
 * @param {Object}                           options
 * @param {number|string|null}               [options.userId]
 * @param {{start: string, end: string}}     options.dateParams
 * @param {number}                           [options.perPage=10]
 * @param {boolean}                          [options.enabled=true]
 *
 * @returns {{
 *   topMedia: Array,
 *   isLoading: boolean,
 *   error: ?string,
 *   page: number,
 *   setPage: Function,
 *   pagination: { totalItems: number, totalPages: number },
 *   perPage: number,
 * }}
 */
const useTopVideosPaginated = ({
  userId,
  dateParams,
  perPage = 10,
  enabled = true,
} = {}) => {
  const [topMedia, setTopMedia] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    totalItems: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const start = dateParams?.start || "";
  const end = dateParams?.end || "";
  const userKey = userId ?? "";

  // Reset to page 1 when scope changes — a previous page index may not
  // exist in the new result set.
  useEffect(() => {
    setPage(1);
  }, [userKey, start, end]);

  useEffect(() => {
    if (!enabled || !start || !end) {
      setIsLoading(false);
      return undefined;
    }

    const controller = new AbortController();

    (async () => {
      try {
        setIsLoading(true);
        const args = { start, end, page, per_page: perPage };
        if (userKey !== "") {
          args.user_id = userKey;
        }
        const response = await apiFetch({
          path: addQueryArgs(window.prestoPlayer.api.analyticsTopVideos, args),
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

        setTopMedia((json || []).map(transformMediaItem));
        setPagination({ totalItems, totalPages });
        setError(null);
      } catch (err) {
        if (err.name === "AbortError") return;
        setError(err.message || "Failed to load top videos");
        setTopMedia([]);
        setPagination({ totalItems: 0, totalPages: 0 });
      } finally {
        setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [enabled, userKey, start, end, page, perPage]);

  return {
    topMedia,
    isLoading,
    error,
    page,
    setPage,
    pagination,
    perPage,
  };
};

export default useTopVideosPaginated;
