const { __ } = wp.i18n;
import { useMemo } from "@wordpress/element";
import {
  Avatar,
  Container,
  Button,
  Text,
  Input,
  DatePicker,
} from "@bsf/force-ui";
import { ArrowLeft, Calendar, X } from "lucide-react";
import { useHistory, useLocation } from "../router/router";
import useUserDetail from "../hooks/useUserDetail";
import useDateRangePicker from "../hooks/useDateRangePicker";
import {
  getRangeLabel,
  getLastNDays,
  getAnalyticsPresets,
  DEFAULT_ANALYTICS_DAYS,
} from "../utils";
import StatCard from "../components/StatCard";
import TopMedia from "../components/TopMedia";
import UserAnalyticsDetailSkeleton from "../components/Skeletons/UserAnalyticsDetailSkeleton";

/**
 * User Analytics Detail Page
 *
 * Reached by clicking a user row in the Top Users table on the Analytics page.
 * URL pattern: ?tab=Analytics&detail=user&id={userId}
 *
 * Layout:
 *  - Header: back button, avatar, clickable username (links to WP profile), email, date range picker
 *  - 3 stat cards: Total Views, Average Watch Time, Total Watch Time
 *  - Top Media table (reused TopMedia component, filtered by user_id)
 */
const UserAnalyticsDetail = () => {
  const history = useHistory();
  const location = useLocation();
  const userId = location.params?.id;

  const {
    user,
    stats,
    topMedia,
    mediaPage,
    setMediaPage,
    mediaPagination,
    mediaPerPage,
    isLoading,
    error,
    refetch,
  } = useUserDetail(userId);

  const {
    selectedDates,
    isDatePickerOpen,
    setIsDatePickerOpen,
    datePickerRef,
    handleDateApply,
    handleDateCancel,
    handleClearFilters,
  } = useDateRangePicker(refetch);

  const presets = useMemo(() => getAnalyticsPresets(), []);
  const defaultDateRange = useMemo(
    () => getLastNDays(DEFAULT_ANALYTICS_DAYS),
    []
  );

  const fromTab = location.params?.from;
  const handleBack = () => {
    if (fromTab) {
      history.replace({ tab: fromTab, detail: null, id: null, from: null });
    } else {
      history.replace({ tab: "Analytics", detail: null, id: null });
    }
  };

  // Loading state — show skeleton until all data (user + stats + topMedia) is ready
  if (isLoading) {
    return <UserAnalyticsDetailSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <Container
        className="p-8 bg-background-secondary"
        direction="column"
        gap="md"
      >
        <Button
          variant="ghost"
          size="xs"
          icon={<ArrowLeft className="size-5" />}
          onClick={handleBack}
        />
        <Container
          align="center"
          justify="center"
          className="p-8 bg-background-primary border border-solid border-border-subtle rounded-lg"
        >
          <Text size={14} weight={400} color="secondary">
            {error}
          </Text>
        </Container>
      </Container>
    );
  }

  return (
    <Container
      className="p-8 bg-background-secondary"
      direction="column"
      gap="md"
    >
      {/* Header: Back + Avatar + User Info + Date Picker */}
      <Container align="center" gap="sm">
        <Button
          variant="ghost"
          size="xs"
          icon={<ArrowLeft className="size-5" />}
          onClick={handleBack}
          className="shrink-0"
        />

        <Avatar
          size="md"
          variant="primary"
          src={user?.avatarUrl}
          alt={user?.name}
          className="shrink-0"
        >
          {(user?.name || "?").charAt(0).toUpperCase()}
        </Avatar>

        <Container direction="column" gap="none" className="flex-1 min-w-0">
          <a
            href={user?.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline hover:underline w-fit"
          >
            <Text
              size={20}
              weight={600}
              color="primary"
              className="truncate"
            >
              {user?.name || __("User Detail", "presto-player")}
            </Text>
          </a>
          {user?.email && (
            <Text size={13} weight={400} color="tertiary">
              {user.email}
            </Text>
          )}
        </Container>

        {/* Date Range Picker */}
        <Container align="center" gap="xs" className="shrink-0">
          {(selectedDates.from || selectedDates.to) && (
            <Button
              variant="link"
              size="xs"
              destructive
              icon={<X />}
              onClick={handleClearFilters}
              aria-label={__("Clear Filters", "presto-player")}
            >
              {__("Clear Filters", "presto-player")}
            </Button>
          )}
          <div className="relative" ref={datePickerRef}>
            <Input
              type="text"
              size="sm"
              value={getRangeLabel(
                selectedDates?.from && selectedDates?.to
                  ? selectedDates
                  : defaultDateRange
              )}
              suffix={<Calendar className="text-icon-secondary" />}
              onClick={() => setIsDatePickerOpen((prev) => !prev)}
              className="w-60 cursor-pointer"
              readOnly
              aria-label={__("Select Date Range", "presto-player")}
            />
            {isDatePickerOpen && (
              <Container className="absolute z-10 mt-2 rounded-lg shadow-lg right-0 bg-background-primary">
                <DatePicker
                  applyButtonText={__("Apply", "presto-player")}
                  cancelButtonText={__("Cancel", "presto-player")}
                  selectionType="range"
                  showOutsideDays={false}
                  variant="presets"
                  presets={presets}
                  onApply={handleDateApply}
                  onCancel={handleDateCancel}
                  selected={
                    selectedDates?.from && selectedDates?.to
                      ? selectedDates
                      : defaultDateRange
                  }
                  disabled={{ after: new Date() }}
                />
              </Container>
            )}
          </div>
        </Container>
      </Container>

      {/* Stat Cards Row */}
      <Container containerType="grid" gap="md" className="grid-cols-3">
        <StatCard
          label={__("Views", "presto-player")}
          value={String(stats.totalViews)}
        />
        <StatCard
          label={__("Average Watch Time", "presto-player")}
          value={stats.avgWatchTime}
        />
        <StatCard
          label={__("Total Watch Time", "presto-player")}
          value={stats.totalWatchTime}
        />
      </Container>

      {/* Top Media Table (reused component) */}
      <TopMedia
        media={topMedia}
        fromUserId={userId}
        currentPage={mediaPage}
        totalItems={mediaPagination.totalItems}
        totalPages={mediaPagination.totalPages}
        perPage={mediaPerPage}
        onPageChange={setMediaPage}
      />
    </Container>
  );
};

export default UserAnalyticsDetail;
