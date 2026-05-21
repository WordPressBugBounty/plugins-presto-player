import { memo } from "@wordpress/element";
import { Container, Text } from "@bsf/force-ui";
import { __ } from "@wordpress/i18n";
import { humanSeconds } from "../../utils";
import { CHART_COLOR, ALL_TIME_CHART_COLOR } from "../charts";
import { useChartContext } from "./ChartContext";

const StatCard = memo(({ label, value, indicatorColor }) => (
  <Container.Item className="flex flex-col items-start justify-center flex-1 p-4 text-left rounded-md shadow-sm bg-background-primary">
    <div className="flex items-center gap-2">
      {indicatorColor && (
        <div
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: indicatorColor }}
        />
      )}
      <Text className="text-sm font-medium text-text-primary">
        {label}
      </Text>
    </div>
    <Text className="mt-2 text-2xl font-semibold text-text-primary tabular-nums">
      {value}
    </Text>
  </Container.Item>
));

const ChartSummary = () => {
  const { total, allTimeViews, allTimeWatchTime, isWatchTime, chartData } =
    useChartContext();

  // Only render when there is chart data and all-time data available
  const hasAllTimeData = allTimeViews !== null || allTimeWatchTime !== null;
  if (!chartData.length || !hasAllTimeData) return null;

  const formatCount = (n) =>
    typeof n === "number" ? n.toLocaleString() : n;

  const currentLabel = isWatchTime
    ? __("Watch Time", "presto-player")
    : __("Views", "presto-player");
  const currentValue = isWatchTime ? humanSeconds(total) : formatCount(total);

  const allTimeLabel = isWatchTime
    ? __("All Time Watch Time", "presto-player")
    : __("All Time Views", "presto-player");
  const allTimeValue = isWatchTime
    ? humanSeconds(allTimeWatchTime)
    : formatCount(allTimeViews);

  return (
    <Container
      containerType="flex"
      direction="column"
      className="w-[30%] gap-1 bg-background-secondary rounded-lg"
    >
      <StatCard
        label={currentLabel}
        value={currentValue}
        indicatorColor={CHART_COLOR}
      />
      <StatCard
        label={allTimeLabel}
        value={allTimeValue}
        indicatorColor={ALL_TIME_CHART_COLOR}
      />
    </Container>
  );
};

export default ChartSummary;
