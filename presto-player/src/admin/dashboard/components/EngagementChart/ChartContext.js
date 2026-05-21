import { createContext, useContext } from "@wordpress/element";

const ChartContext = createContext(null);

export const useChartContext = () => {
  const context = useContext(ChartContext);
  if (!context) {
    throw new Error("Chart sub-components must be used within <EngagementChart>");
  }
  return context;
};

export default ChartContext;
