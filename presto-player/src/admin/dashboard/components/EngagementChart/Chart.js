import { Container } from "@bsf/force-ui";
import ChartTabs from "./ChartTabs";
import ChartDateFilter from "./ChartDateFilter";
import ChartAreaChart from "./ChartAreaChart";
import ChartSummary from "./ChartSummary";
import ChartKPI from "./ChartKPI";

const Chart = ({ children }) => {
  return (
    <Container
      containerType="flex"
      direction="column"
      gap="xs"
      className="w-full max-w-full min-w-0 p-4 border-0.5 border-solid rounded-xl shadow-sm bg-background-primary border-border-subtle box-border"
    >
      {children}
    </Container>
  );
};

Chart.Tabs = ChartTabs;
Chart.DateFilter = ChartDateFilter;
Chart.AreaChart = ChartAreaChart;
Chart.Summary = ChartSummary;
Chart.KPI = ChartKPI;

export default Chart;
