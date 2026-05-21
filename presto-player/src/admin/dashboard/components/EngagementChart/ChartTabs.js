import { useCallback } from "@wordpress/element";
import { Tabs } from "@bsf/force-ui";
import { __ } from "@wordpress/i18n";
import { useChartContext } from "./ChartContext";

const ChartTabs = () => {
  const { activeTab, setActiveTab } = useChartContext();

  const handleChange = useCallback(
    ({ value }) => {
      setActiveTab(value.slug);
    },
    [setActiveTab]
  );

  return (
    <Tabs.Group
      activeItem={activeTab}
      onChange={handleChange}
      orientation="horizontal"
      size="xs"
      variant="pill"
      width="auto"
      className="!p-0.5"
    >
      <Tabs.Tab
        slug="views"
        text={__("Views", "presto-player")}
        className="font-medium !px-2 !py-1"
      />
      <Tabs.Tab
        slug="watch-time"
        text={__("Watch Time", "presto-player")}
        className="font-medium !px-2 !py-1"
      />
    </Tabs.Group>
  );
};

export default ChartTabs;
