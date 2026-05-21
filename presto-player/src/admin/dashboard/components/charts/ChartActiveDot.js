import {
  CHART_COLOR,
  ACTIVE_DOT_RADIUS,
  ACTIVE_DOT_GLOW_RADIUS,
  ACTIVE_DOT_GLOW_OPACITY,
} from "./chartTheme";

/**
 * Stripe-inspired ringed active dot with glow.
 * Used as the `activeDot` prop on Recharts <Area>.
 *
 * Renders:
 * - Outer glow circle (brand color at 0.12 opacity)
 * - Inner dot (white fill with brand color stroke ring)
 *
 * Recharts passes cx, cy, and other props automatically.
 */
const ChartActiveDot = ({ cx, cy, color = CHART_COLOR }) => {
  if (cx == null || cy == null) return null;

  return (
    <g style={{ transition: "opacity 150ms ease-out" }}>
      <circle
        cx={cx}
        cy={cy}
        r={ACTIVE_DOT_GLOW_RADIUS}
        fill={color}
        opacity={ACTIVE_DOT_GLOW_OPACITY}
      />
      <circle
        cx={cx}
        cy={cy}
        r={ACTIVE_DOT_RADIUS}
        fill="#FFFFFF"
        stroke={color}
        strokeWidth={2}
      />
    </g>
  );
};

export default ChartActiveDot;
