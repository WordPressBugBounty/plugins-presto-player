import ChartContext from "./ChartContext";
import Chart from "./Chart";
import useEngagementChartData from "../../hooks/useEngagementChartData";

const SelfManaged = ({ showAllTimeSummary, children }) => {
  const value = useEngagementChartData({ showAllTimeSummary });
  return <ChartContext.Provider value={value}>{children}</ChartContext.Provider>;
};

// Pass `contextValue` to share the chart hook with sibling consumers
// (e.g. useTopPerforming on the Analytics page); omit it to let the
// component own its own hook instance.
const EngagementChart = ({ showAllTimeSummary = false, contextValue, children }) => {
  if (contextValue) {
    return <ChartContext.Provider value={contextValue}>{children}</ChartContext.Provider>;
  }
  return (
    <SelfManaged showAllTimeSummary={showAllTimeSummary}>{children}</SelfManaged>
  );
};

export { Chart };
export default EngagementChart;
