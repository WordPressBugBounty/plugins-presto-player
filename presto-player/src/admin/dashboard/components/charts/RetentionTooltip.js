import { __ } from "@wordpress/i18n";
import {
  TOOLTIP_BG,
  TOOLTIP_BORDER,
  TOOLTIP_SHADOW,
  TOOLTIP_RADIUS,
  TOOLTIP_TEXT_PRIMARY,
  CHART_COLOR,
} from "./chartTheme";
import { formatHMS } from "../../utils";

/**
 * Compact tooltip for the RetentionChart.
 * Shows the video timestamp and viewer count.
 */
const RetentionTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  const value = payload[0]?.value;
  const formattedLabel = typeof label === "number" ? formatHMS(label) : label;

  return (
    <div
      style={{
        background: TOOLTIP_BG,
        border: `1px solid ${TOOLTIP_BORDER}`,
        borderRadius: `${TOOLTIP_RADIUS}px`,
        boxShadow: TOOLTIP_SHADOW,
        padding: "8px 12px",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {formattedLabel && (
        <div
          style={{
            fontSize: "11px",
            fontWeight: 400,
            color: TOOLTIP_TEXT_PRIMARY,
            marginBottom: "4px",
          }}
        >
          {formattedLabel}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: CHART_COLOR,
            display: "inline-block",
          }}
        />
        <span
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: TOOLTIP_TEXT_PRIMARY,
          }}
        >
          {__("Viewers:", "presto-player")}{" "}
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
      </div>
    </div>
  );
};

export default RetentionTooltip;
