import {
  TOOLTIP_BG,
  TOOLTIP_BORDER,
  TOOLTIP_SHADOW,
  TOOLTIP_RADIUS,
  TOOLTIP_TEXT_PRIMARY,
  TOOLTIP_TEXT_SECONDARY,
} from "./chartTheme";

/**
 * Stripe-inspired chart tooltip.
 * White bg, multi-layer shadow, stacked date/metric/value layout.
 *
 * @param {boolean} active - Whether tooltip is visible (from Recharts)
 * @param {Array} payload - Data points at cursor position (from Recharts)
 * @param {string} label - X-axis label at cursor position (from Recharts)
 * @param {Function} formatter - Optional value formatter (e.g., humanSeconds)
 * @param {string} metricLabel - Label for the metric (e.g., "Views", "Watch Time")
 * @param {boolean} showComparison - Whether to show "vs prev" comparison row (deferred — requires API support for previous period data)
 */
const ChartTooltip = ({ active, payload, label, formatter, metricLabel, showComparison = false }) => {
  if (!active || !payload || payload.length === 0) return null;

  const value = payload[0]?.value;
  const displayValue = formatter
    ? formatter(value)
    : typeof value === "number"
      ? value.toLocaleString()
      : value;

  return (
    <div
      style={{
        background: TOOLTIP_BG,
        border: `1px solid ${TOOLTIP_BORDER}`,
        borderRadius: `${TOOLTIP_RADIUS}px`,
        boxShadow: TOOLTIP_SHADOW,
        padding: "12px 16px",
        fontVariantNumeric: "tabular-nums",
        transition: "opacity 100ms ease",
      }}
    >
      {/* Date label */}
      <div
        style={{
          fontSize: "11px",
          color: TOOLTIP_TEXT_SECONDARY,
          marginBottom: "6px",
        }}
      >
        {label}
      </div>

      {/* Metric + Value */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "16px",
        }}
      >
        {metricLabel && (
          <span
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: TOOLTIP_TEXT_PRIMARY,
            }}
          >
            {metricLabel}
          </span>
        )}
        <span
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: TOOLTIP_TEXT_PRIMARY,
          }}
        >
          {displayValue}
        </span>
      </div>
    </div>
  );
};

export default ChartTooltip;
