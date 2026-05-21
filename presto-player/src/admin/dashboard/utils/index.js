/**
 * Centralized exports for all dashboard utilities
 * This allows for cleaner imports like:
 * import { decodeHTMLEntities, format, activatePlugin } from '../utils'
 */

// Formatters
export {
  decodeHTMLEntities,
  formatHMS,
  humanSeconds,
  humanSecondsCompact,
  formatChartData,
  padDailyPoints,
} from "./formatters";

// Date utilities
export {
  format,
  formatXAxis,
  getLastNDays,
  getSelectedDate,
  getRangeLabel,
  getAllTimeRange,
  getAnalyticsPresets,
  toAnalyticsDate,
  ALL_TIME_START,
  DEFAULT_ANALYTICS_DAYS,
} from "./dateUtils";

// Plugin utilities
export {
  activatePlugin,
  installPlugins,
  generateSuggestions,
} from "./pluginUtils";

// Analytics API
export { fetchViews, fetchWatchTime } from "./analyticsApi";

// General helpers
export { classNames } from "./helpers";

// Icons
export { default as Presto_Admin_Icons } from "./icons";
