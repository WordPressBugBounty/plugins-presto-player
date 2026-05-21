import { Text } from "@bsf/force-ui";
import { __ } from "@wordpress/i18n";
import { humanSeconds } from "../../utils";
import { useChartContext } from "./ChartContext";

const ChartKPI = () => {
  const { total, isWatchTime, chartData } = useChartContext();

  if (!chartData.length) return null;

  const formattedValue = isWatchTime
    ? humanSeconds(total)
    : total.toLocaleString();

  const label = isWatchTime
    ? __("Watch Time", "presto-player")
    : __("Unique Views", "presto-player");

  return (
    <div className="flex items-baseline gap-x-2 px-2 pt-1">
      <Text
        as="span"
        className="text-3xl font-semibold leading-none text-text-primary tabular-nums tracking-tight"
      >
        {formattedValue}
      </Text>
      <Text
        as="span"
        className="text-base font-medium text-text-secondary"
      >
        {label}
      </Text>
    </div>
  );
};

export default ChartKPI;
