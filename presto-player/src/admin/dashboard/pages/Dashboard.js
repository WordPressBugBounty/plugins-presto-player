import React, { useState, useRef } from "react";
import { Container } from "@bsf/force-ui";
import WelcomeBanner from "../components/WelcomeBanner";
import VideoModal from "../components/VideoModal";
import ExtendPlugins from "../components/ExtendPlugins";
import QuickAccess from "../components/QuickAccess";
import TopPerformingMedia from "../components/TopPerformingMedia";
import UpgradeToPro from "../components/UpgradeToPro";
import EngagementChart, { Chart } from "../components/EngagementChart";
import useTopPerforming from "../hooks/useTopPerforming";
import DashboardSkeleton from "../components/Skeletons/DashboardSkeleton";

const Dashboard = () => {
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const videoTriggerRef = useRef(null);

  const { data: topPerformingData, isLoading: isTopPerformingLoading } =
    useTopPerforming({ mediaPerPage: 5 });

  if (isTopPerformingLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <Container className="p-8" gap="md" direction="column">
      <Container gap="md" direction={{ sm: "column", md: "row" }}>
        {/* Left Card */}
        <div className="relative flex flex-col gap-6 flex-1 min-w-0">
          <WelcomeBanner onVideoOpen={setIsVideoOpen} videoTriggerRef={videoTriggerRef} />

          <EngagementChart showAllTimeSummary>
            <Chart>
              <Container.Item className="flex items-center justify-between w-full p-1">
                <Chart.Tabs />
                <Chart.DateFilter />
              </Container.Item>
              <Container.Item className="w-full flex items-stretch justify-between gap-1 bg-background-secondary rounded-lg p-1">
                <Chart.AreaChart />
                <Chart.Summary />
              </Container.Item>
            </Chart>
          </EngagementChart>

          <ExtendPlugins layout="inline" />
        </div>

        {/* Right Card */}
        <Container.Item className="max-w-full w-full md:max-w-[33%]">
          <Container direction="column" gap="md">
            <UpgradeToPro />
            <TopPerformingMedia data={topPerformingData} />
            <QuickAccess />
          </Container>
        </Container.Item>
      </Container>

      <VideoModal isOpen={isVideoOpen} onClose={() => setIsVideoOpen(false)} triggerRef={videoTriggerRef} />
    </Container>
  );
};

export default Dashboard;
