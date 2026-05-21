import React, { useEffect, useState } from "react";
const { __ } = wp.i18n;
import apiFetch from "@wordpress/api-fetch";
import { Container, Title, Alert } from "@bsf/force-ui";
import EngagementChart, { Chart } from "../components/EngagementChart";
import TopUsers from "../components/TopUsers";
import TopMedia from "../components/TopMedia";
import useEngagementChartData from "../hooks/useEngagementChartData";
import useTopPerforming from "../hooks/useTopPerforming";
import AnalyticsPageSkeleton from "../components/Skeletons/AnalyticsPageSkeleton";
import ProGateOverlay from "../components/ProGateOverlay";

const MEDIA_PER_PAGE = 5;
const USERS_PER_PAGE = 5;

const AnalyticsDisabledNotice = () => {
  const dashboardUrl = window.prestoPlayer?.dashboardUrl || "";
  const settingsHref = `${dashboardUrl}&tab=Settings&section=viewing-analytics`;
  return (
    <Alert
      design="stack"
      variant="warning"
      title={__("Analytics collection is turned off", "presto-player")}
      content={
        <>
          {__(
            "New views and watch-time data won't be recorded until you enable analytics.",
            "presto-player"
          )}{" "}
          <a
            href={settingsHref}
            className="text-brand-primary-600 hover:underline"
          >
            {__("Enable in Settings", "presto-player")}
          </a>
        </>
      }
    />
  );
};

const AnalyticsContent = () => {
  const chartContext = useEngagementChartData({});
  const [analyticsDisabled, setAnalyticsDisabled] = useState(false);

  useEffect(() => {
    apiFetch({ path: "/wp/v2/settings" })
      .then((settings) => {
        if (settings?.presto_player_analytics?.enable === false) {
          setAnalyticsDisabled(true);
        }
      })
      .catch(() => {
        // Non-fatal — fall through without the notice.
      });
  }, []);

  // The chart shows last-30-days when no filter is set; mirror that here
  // so the tables match what the chart is showing instead of drifting
  // back to all-time on the unfiltered view.
  const effectiveDates = chartContext.selectedDates?.from
    ? chartContext.selectedDates
    : chartContext.defaultDateRange;

  const {
    data: topData,
    isLoading,
    error: topPerformingError,
    mediaPage,
    setMediaPage,
    mediaPagination,
    usersPage,
    setUsersPage,
    usersPagination,
  } = useTopPerforming({
    mediaPerPage: MEDIA_PER_PAGE,
    usersPerPage: USERS_PER_PAGE,
    selectedDates: effectiveDates,
  });

  if (isLoading) {
    return <AnalyticsPageSkeleton />;
  }

  return (
    <Container className="p-8" gap="md" direction="column">
      <Container className="w-full">
        <Container.Item grow={1}>
          <Title
            description=""
            icon={null}
            iconPosition="right"
            size="md"
            tag="h3"
            title={__("Analytics", "presto-player")}
          />
        </Container.Item>
      </Container>

      {analyticsDisabled && <AnalyticsDisabledNotice />}

      {topPerformingError && (
        <Alert
          design="stack"
          variant="error"
          title={__(
            "Couldn't load top media and viewers",
            "presto-player"
          )}
          content={__(
            "Try refreshing the page. If the problem persists, contact support.",
            "presto-player"
          )}
        />
      )}

      {/* Analytics Overview Chart + Top Users side by side */}
      <div className="flex flex-col md:flex-row gap-5 items-stretch">
        <div className="flex-1 min-w-0 flex">
          <EngagementChart contextValue={chartContext}>
            <Chart>
              <Container.Item className="flex items-center justify-between w-full p-1">
                <Chart.Tabs />
                <Chart.DateFilter />
              </Container.Item>
              <Chart.KPI />
              <Chart.AreaChart />
            </Chart>
          </EngagementChart>
        </div>
        <div className="md:w-1/3 shrink-0 flex">
          <TopUsers
            users={topData?.topUsers || []}
            currentPage={usersPage}
            totalItems={usersPagination.totalItems}
            totalPages={usersPagination.totalPages}
            perPage={USERS_PER_PAGE}
            onPageChange={setUsersPage}
          />
        </div>
      </div>

      {/* Top Media Table */}
      <TopMedia
        media={topData?.topMedia || []}
        currentPage={mediaPage}
        totalItems={mediaPagination.totalItems}
        totalPages={mediaPagination.totalPages}
        perPage={MEDIA_PER_PAGE}
        onPageChange={setMediaPage}
      />
    </Container>
  );
};

const Analytics = () => {
  if (!window.prestoPlayer?.isPremium) {
    return (
      <ProGateOverlay>
        <AnalyticsPageSkeleton />
      </ProGateOverlay>
    );
  }

  return <AnalyticsContent />;
};

export default Analytics;
