/**
 * Utility functions for formatting text, HTML, and time values
 */

/**
 * Decodes HTML entities in text
 * Useful for rendering WordPress content that may contain encoded entities
 *
 * @param {string} text - The text containing HTML entities
 * @returns {string} The decoded text
 *
 * @example
 * decodeHTMLEntities("John&#039;s Video") // Returns: "John's Video"
 * decodeHTMLEntities("Sales &amp; Marketing") // Returns: "Sales & Marketing"
 */
export const decodeHTMLEntities = (text) => {
  if (!text) return "";
  const textArea = document.createElement("textarea");
  textArea.innerHTML = text;
  return textArea.value;
};

/**
 * Converts seconds to a human-readable format
 *
 * @param {number} seconds - The number of seconds to format
 * @returns {string} The formatted time string (e.g., "2h 30m 15s")
 *
 * @example
 * humanSeconds(0) // Returns: "0s"
 * humanSeconds(65) // Returns: "1m 5s"
 * humanSeconds(3665) // Returns: "1h 1m 5s"
 */
/**
 * Formats seconds as HH:MM:SS
 *
 * @param {number} seconds - The number of seconds to format
 * @returns {string} Formatted time string (e.g., "01:30:05")
 */
export const formatHMS = (seconds) => {
  const s = Math.round(seconds) || 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
};

export const humanSeconds = (seconds) => {
  if (!seconds || seconds === 0) {
    return "0s";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
};

/**
 * Compact single-unit version of humanSeconds for chart axes / tight UI.
 *
 * Stays in seconds up to 90s (so a sub-minute Y-axis reads "0s, 30s, 60s, 90s"
 * rather than mixing "45s, 1m") and similarly defers to minutes up to 90m.
 *
 * @param {number} seconds
 * @returns {string} e.g. "6s", "60s", "2m", "1h"
 */
export const humanSecondsCompact = (seconds) => {
  const s = Math.round(Number(seconds) || 0);
  if (s < 90) return `${s}s`;
  if (s < 90 * 60) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
};

/**
 * Formats chart data for display in LineChart components
 * Handles sorting, date formatting, and value transformations
 *
 * @param {Array} chartData - Array of chart data objects
 * @param {string} dataKey - The key to extract the value from each data object
 * @param {boolean} isWatchTime - Whether to convert seconds to minutes
 * @param {Function} formatDate - Date formatting function
 * @param {number} divisor - Number to divide values by (default: 60 for watch time)
 * @param {number} decimalPlaces - Number of decimal places for watch time (default: 2)
 * @returns {Array} Formatted chart data with 'month' and 'count' properties
 *
 * @example
 * formatChartData(data, 'total', false, format) // For views
 * formatChartData(data, 'total', true, format) // For watch time (converts seconds to minutes)
 */
export const formatChartData = (
  chartData,
  dataKey,
  isWatchTime = false,
  formatDate,
  divisor = 60,
  decimalPlaces = 2
) => {
  if (!chartData || chartData.length === 0) {
    return [];
  }

  const sortedChartData = [...chartData].sort(
    (a, b) => new Date(a.date_time) - new Date(b.date_time)
  );

  return sortedChartData.map((data) => {
    const value = parseInt(data[dataKey], 10) || 0;
    return {
      month: formatDate(new Date(data.date_time), "MMM dd, yyyy"),
      count: isWatchTime
        ? parseFloat((value / divisor).toFixed(decimalPlaces))
        : value,
    };
  });
};

/**
 * Fill missing days in a formatted chart series with zero entries so the
 * chart line touches y=0 across gaps instead of interpolating between the
 * non-zero days surrounding them.
 *
 * @param {Array}    points    Output of formatChartData (each item has `{ month, count }`).
 * @param {Object}   range     `{ from: Date, to: Date }` — inclusive day bounds.
 * @param {Function} formatDate Same date formatter used by formatChartData.
 * @returns {Array} Continuous daily series across the range.
 */
export const padDailyPoints = (points, range, formatDate) => {
  if (!range?.from || !range?.to || !formatDate) return points;

  const byDay = new Map((points || []).map((p) => [p.month, p.count]));
  const result = [];
  const cursor = new Date(range.from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(range.to);
  end.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    const key = formatDate(cursor, "MMM dd, yyyy");
    result.push({ month: key, count: byDay.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
};
