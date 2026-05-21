import { useId } from "@wordpress/element";

// Colors
export const CHART_COLOR = "#9a20f8";
export const ALL_TIME_CHART_COLOR = "#2563EB";
export const GRID_COLOR = "#E3E8EE";
export const AXIS_LABEL_COLOR = "#6B7280";
export const TOOLTIP_BG = "#FFFFFF";
export const TOOLTIP_BORDER = "#E6E8EB";
export const TOOLTIP_TEXT_PRIMARY = "#111827";
export const TOOLTIP_TEXT_SECONDARY = "#6B7280";
export const CROSSHAIR_COLOR = "#D3D8DE";
export const POSITIVE_TREND = "#059669";
export const NEGATIVE_TREND = "#DC2626";

// Dimensions
export const STROKE_WIDTH = 2;
export const ACTIVE_DOT_RADIUS = 4;
export const ACTIVE_DOT_GLOW_RADIUS = 6;
export const ACTIVE_DOT_GLOW_OPACITY = 0.12;
export const TOOLTIP_RADIUS = 8;
export const GRADIENT_OPACITY = 0.12;
export const RETENTION_GRADIENT_OPACITY = 0.10;

// Tooltip shadow (CSS)
export const TOOLTIP_SHADOW =
  "0 1px 1px rgba(0,0,0,0.03), 0 3px 6px rgba(18,42,66,0.02), 0 8px 24px rgba(0,0,0,0.08)";

// Animation
export const ANIMATION_DURATION = 400;
export const TAB_SWITCH_DURATION = 200;
export const ANIMATION_EASING = "ease-out";

/**
 * Returns a unique SVG gradient ID per component instance.
 * Prevents collisions when multiple charts render on the same page.
 */
export const useChartGradientId = (prefix = "chart") => {
  const id = useId();
  return `${prefix}-gradient-${id}`;
};
