import { format as format_date, startOfDay, subDays, subMonths } from "date-fns";

const { __ } = wp.i18n;

/** Shared start date for "all time" analytics queries */
export const ALL_TIME_START = "2020-01-01T00:00:00.000Z";

/**
 * Day count used as the dashboard's default analytics window. Centralised
 * here so every surface (picker, mount-fetch, detail-page fallbacks) stays
 * in sync if the default ever shifts again.
 */
export const DEFAULT_ANALYTICS_DAYS = 90;

/**
 * All-time range used as the dashboard's default analytics window.
 *
 * `from` is the fixed sentinel ALL_TIME_START — byte-identical to what
 * `useTopPerforming.js` already sends, so the wire payload is unchanged
 * for surfaces that previously fell back to all-time.
 *
 * `to` is today's start-of-day so it lines up with `getLastNDays(N).to`
 * and the per-day boundaries Force UI's preset matcher expects.
 *
 * @returns {{ from: Date, to: Date }}
 */
export const getAllTimeRange = () => ({
  from: new Date(ALL_TIME_START),
  to: startOfDay(new Date()),
});

/**
 * Custom preset list passed to Force UI's `<DatePicker variant="presets">`.
 *
 * Force UI's built-in presets do not include "All Time", and supplying
 * a `presets` prop fully overrides the built-in list — so once we want
 * "All Time" available we must declare every preset we wish to expose.
 *
 * Order here is the order rendered in the dropdown.
 *
 * @returns {{ label: string, range: { from: Date, to: Date } }[]}
 */
export const getAnalyticsPresets = () => {
  const today = startOfDay(new Date());
  return [
    {
      label: __("All Time", "presto-player"),
      range: getAllTimeRange(),
    },
    {
      label: __("Last 7 days", "presto-player"),
      range: { from: startOfDay(subDays(today, 6)), to: today },
    },
    {
      label: __("Last 30 days", "presto-player"),
      range: { from: startOfDay(subDays(today, 29)), to: today },
    },
    {
      label: __("Last 90 days", "presto-player"),
      range: { from: startOfDay(subDays(today, 89)), to: today },
    },
    {
      label: __("Last 12 months", "presto-player"),
      range: { from: startOfDay(subMonths(today, 12)), to: today },
    },
  ];
};

/**
 * Formats a date using date-fns with error handling
 *
 * @param {Date|string|number} date - The date to format
 * @param {string} dateFormat - The format string (default: "yyyy-MM-dd")
 * @returns {string} The formatted date or error message
 *
 * @example
 * format(new Date(), "MMM dd, yyyy") // Returns: "Jan 21, 2026"
 * format("invalid", "yyyy-MM-dd") // Returns: "No Date"
 */
export const format = (date, dateFormat = "yyyy-MM-dd") => {
  try {
    if (!date || isNaN(new Date(date).getTime())) {
      throw new Error(__("Invalid Date", "presto-player"));
    }
    return format_date(new Date(date), dateFormat);
  } catch (error) {
    return __("No Date", "presto-player");
  }
};

/**
 * Formats X-axis labels for charts. The year is intentionally omitted —
 * the tooltip surfaces the full "MMM dd, yyyy" date on hover, so adding
 * it to every tick just steals horizontal space and forces Recharts to
 * truncate labels.
 *
 * @param {string} tickItem - The tick item to format
 * @returns {string} The formatted date string
 */
export const formatXAxis = (tickItem) => {
  return format(new Date(tickItem), "MMM dd");
};

/**
 * Format a Date as the calendar-day-anchored ISO datetime the analytics REST
 * endpoints expect: "yyyy-MM-ddT00:00:00.000Z" — the user's local calendar
 * day, re-anchored at UTC midnight.
 *
 * Use this for both the `start` and `end` query args. The backend
 * (`Visit.php`) discards the time-of-day and rebuilds 00:00:00 / 23:59:59
 * windows itself — only the date portion is load-bearing on the wire.
 *
 * Why not `.toISOString()`? It serialises midnight-local as the previous
 * UTC day for any timezone east of UTC, masking today's records.
 *
 * Why not bare "yyyy-MM-dd"? The REST controllers declare every start/end
 * arg as `format: date-time`, and `rest_parse_date()` rejects bare dates
 * with 400.
 *
 * @param {Date|string|number} date
 * @returns {string} e.g. "2026-05-07T00:00:00.000Z"
 */
export const toAnalyticsDate = (date) =>
  `${format(date, "yyyy-MM-dd")}T00:00:00.000Z`;

/**
 * Gets a date range for the last N days, inclusive of today.
 *
 * Boundaries are anchored at start-of-day so the result is `getTime()`-equal
 * to Force UI's built-in DatePicker presets (e.g. "Last 30 Days"), which
 * means the matching preset highlights when this range is the selected value.
 *
 * @param {number} days - The number of days in the window (e.g. 30 = today + 29 prior days)
 * @returns {Object} Object with 'from' and 'to' Date objects (both at 00:00 local time)
 *
 * @example
 * getLastNDays(7)  // { from: startOfDay(today - 6),  to: startOfDay(today) }
 * getLastNDays(30) // { from: startOfDay(today - 29), to: startOfDay(today) }
 */
export const getLastNDays = (days) => {
  if (isNaN(days)) {
    return {
      from: "",
      to: "",
    };
  }
  const today = startOfDay(new Date());
  return {
    from: startOfDay(subDays(today, days - 1)),
    to: today,
  };
};

/**
 * Formats selected date range for display
 *
 * @param {Object} selectedDatesForChart - Object with 'from' and 'to' dates
 * @returns {string} The formatted date range string
 *
 * @example
 * getSelectedDate({ from: new Date('2026-01-01'), to: new Date('2026-01-15') })
 * // Returns: "01/01/2026 - 01/15/2026"
 */
export const getSelectedDate = (selectedDatesForChart) => {
  if (!selectedDatesForChart.from) {
    return "";
  }
  if (!selectedDatesForChart.to) {
    return `${format(selectedDatesForChart.from, "MM/dd/yyyy")}`;
  }
  return `${format(selectedDatesForChart.from, "MM/dd/yyyy")} - ${format(
    selectedDatesForChart.to,
    "MM/dd/yyyy"
  )}`;
};

/**
 * Renders the trigger label for an analytics date-range picker:
 *  - if `range` matches a known preset by calendar-day equality → preset label
 *  - else if `range` is a usable from/to → formatted "MM/dd/yyyy - MM/dd/yyyy"
 *  - else → empty string
 *
 * Day-string equality (rather than `getTime()`) is used so a `range`
 * computed in a previous render or context still matches the preset
 * built fresh this render.
 *
 * @param {{ from: Date, to: Date }} range
 * @returns {string}
 */
export const getRangeLabel = (range) => {
  if (!range?.from) return "";
  const sameDay = (a, b) =>
    a && b && format(a, "yyyy-MM-dd") === format(b, "yyyy-MM-dd");
  const presets = getAnalyticsPresets();
  const match = presets.find(
    (p) =>
      sameDay(p.range.from, range.from) &&
      sameDay(p.range.to, range.to ?? range.from)
  );
  return match ? match.label : getSelectedDate(range);
};

