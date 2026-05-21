import { CROSSHAIR_COLOR } from "./chartTheme";

/**
 * Vertical dashed crosshair line shown on chart hover.
 * Used as the `cursor` prop on Recharts <Tooltip>.
 *
 * Recharts passes x, y, width, height, and points automatically.
 */
const ChartCrosshair = ({ x, y, height }) => {
  if (x == null) return null;

  return (
    <line
      x1={x}
      y1={y || 0}
      x2={x}
      y2={(y || 0) + (height || 0)}
      stroke={CROSSHAIR_COLOR}
      strokeWidth={1}
      strokeDasharray="4 3"
    />
  );
};

export default ChartCrosshair;
