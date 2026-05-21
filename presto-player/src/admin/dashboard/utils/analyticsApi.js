import wpApiFetch from "@wordpress/api-fetch";

/**
 * IMPORTANT — never call `.toISOString()` on user-picked dates here, and
 * never pass a bare "yyyy-MM-dd" date string. Always run user-picked dates
 * through `toAnalyticsDate()` from `./dateUtils` first. The REST endpoints
 * declare every start/end arg as `format: date-time` and reject anything
 * else with 400; `.toISOString()` also silently shifts midnight-local back
 * to the previous UTC day, masking today's records for users east of UTC.
 */

/**
 * Fetches views analytics data for a given date range.
 *
 * @param {string} start - ISO date string for range start
 * @param {string} end   - ISO date string for range end
 * @param {Object} [options] - Optional apiFetch options (e.g. { signal })
 * @returns {Promise<{ total: number, chartData: Array }>}
 */
export const fetchViews = async (start, end, options = {}) => {
  const response = await wpApiFetch({
    path: wp.url.addQueryArgs(window.prestoPlayer.api.analyticsViews, {
      start,
      end,
    }),
    parse: false,
    ...options,
  });

  const chartData = await response.json();
  const total = parseInt(response.headers?.get("X-WP-Total"), 10) || 0;

  return { total, chartData: chartData || [] };
};

/**
 * Fetches watch-time analytics data for a given date range.
 *
 * @param {string} start - ISO date string for range start
 * @param {string} end   - ISO date string for range end
 * @param {Object} [options] - Optional apiFetch options (e.g. { signal })
 * @returns {Promise<{ total: number, chartData: Array, average: number }>}
 */
export const fetchWatchTime = async (start, end, options = {}) => {
  const response = await wpApiFetch({
    path: wp.url.addQueryArgs(window.prestoPlayer.api.analyticsWatchTime, {
      start,
      end,
    }),
    parse: false,
    ...options,
  });

  const responseData = await response.json();
  const chartData = responseData?.data || [];
  // Watch-time endpoint doesn't provide X-WP-Total header (unlike views),
  // so total must be computed client-side.
  const total = chartData.reduce(
    (sum, item) => sum + (parseInt(item.total, 10) || 0),
    0
  );
  const average = parseFloat(responseData?.average) || 0;

  return { total, chartData, average };
};
