import { memo, useMemo } from "@wordpress/element";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { __ } from "@wordpress/i18n";
import { humanSeconds, humanSecondsCompact, formatXAxis } from "../../utils";
import {
  CHART_COLOR,
  GRID_COLOR,
  AXIS_LABEL_COLOR,
  GRADIENT_OPACITY,
  STROKE_WIDTH,
  ANIMATION_DURATION,
  ANIMATION_EASING,
  useChartGradientId,
} from "./chartTheme";
import ChartActiveDot from "./ChartActiveDot";
import ChartCrosshair from "./ChartCrosshair";
import ChartTooltip from "./ChartTooltip";

const AXIS_TICK = { fontSize: "12px", fill: AXIS_LABEL_COLOR };
const CHART_MARGIN = { top: 10, right: 10, bottom: 5, left: 0 };
const X_AXIS_PADDING = { left: 15, right: 15 };
const X_AXIS_LABEL_TARGET = 7;
const crosshairCursor = <ChartCrosshair />;
const activeDotElement = <ChartActiveDot />;

// Recharts' "equidistantPreserveStart" decimates labels too aggressively
// for short ranges (e.g. a 7-day chart was rendering only 2 ticks). This
// computes a manual stride that aims for ~7 evenly-spaced labels no
// matter how many days are in the window — small ranges show every day,
// larger ones thin out without overlapping.
const computeXAxisInterval = (length) =>
  Math.max(0, Math.ceil(length / X_AXIS_LABEL_TARGET) - 1);

const EngagementAreaChart = memo(({ data, isWatchTime }) => {
  const gradientId = useChartGradientId("engagement");
  const xAxisInterval = useMemo(
    () => computeXAxisInterval(data?.length || 0),
    [data?.length]
  );

  const tooltipContent = useMemo(
    () => (
      <ChartTooltip
        metricLabel={
          isWatchTime
            ? __("Watch Time", "presto-player")
            : __("Views", "presto-player")
        }
        formatter={isWatchTime ? humanSeconds : undefined}
      />
    ),
    [isWatchTime]
  );

  return (
    <div className="w-full h-full min-h-[248px] min-[1427px]:min-h-[228px] [&_.recharts-surface]:cursor-crosshair">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={CHART_MARGIN}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLOR} stopOpacity={GRADIENT_OPACITY} />
              <stop offset="100%" stopColor={CHART_COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            horizontal={true}
            vertical={false}
            stroke={GRID_COLOR}
            strokeWidth={1}
          />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={formatXAxis}
            tick={AXIS_TICK}
            interval={xAxisInterval}
            padding={X_AXIS_PADDING}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            width={40}
            tick={AXIS_TICK}
            allowDecimals={false}
            tickFormatter={isWatchTime ? humanSecondsCompact : undefined}
          />
          <Tooltip content={tooltipContent} cursor={crosshairCursor} />
          <Area
            type="monotone"
            dataKey="count"
            stroke={CHART_COLOR}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={activeDotElement}
            isAnimationActive={true}
            animationDuration={ANIMATION_DURATION}
            animationEasing={ANIMATION_EASING}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});

export default EngagementAreaChart;
