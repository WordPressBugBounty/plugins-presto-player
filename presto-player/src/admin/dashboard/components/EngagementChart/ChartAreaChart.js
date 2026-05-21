import { Container, Text } from "@bsf/force-ui";
import { AlertCircle } from "lucide-react";
import { EngagementAreaChart } from "../charts";
import ChartEmptyState from "../ChartEmptyState";
import { useChartContext } from "./ChartContext";

const ChartAreaChart = () => {
  const { chartData, isWatchTime, isLoading, error } = useChartContext();

  if (isLoading) return null;

  const hasData = chartData.length > 0;

  return (
    <Container
      className={`w-full flex flex-col flex-1 p-3 overflow-hidden bg-background-primary ${hasData ? "rounded-md shadow-sm" : ""}`}
      containerType="flex"
      direction="column"
    >
      {error && (
        <Container align="center" gap="xs" className="p-3 mb-3 rounded-md bg-background-error">
          <AlertCircle className="w-5 h-5 text-text-error" />
          <Text className="text-sm text-text-error">{error}</Text>
        </Container>
      )}

      {hasData && (
        <EngagementAreaChart data={chartData} isWatchTime={isWatchTime} />
      )}

      {!error && !hasData && (
        <ChartEmptyState className="h-full min-h-[256px] min-[1427px]:min-h-[236px]" proGated />
      )}
    </Container>
  );
};

export default ChartAreaChart;
