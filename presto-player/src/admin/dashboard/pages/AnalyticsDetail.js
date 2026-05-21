const { __ } = wp.i18n;
import { useState, useEffect, useRef, useMemo } from "@wordpress/element";
import apiFetch from "@wordpress/api-fetch";
import {
  Container,
  Button,
  Text,
  Input,
  DatePicker,
  Tooltip as ForceTooltip,
} from "@bsf/force-ui";
import {
  ArrowLeft,
  Calendar,
  X,
  Info,
  PencilLine,
  Check,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { useHistory, useLocation } from "../router/router";
import useMediaDetail from "../hooks/useMediaDetail";
import useDateRangePicker from "../hooks/useDateRangePicker";
import {
  getRangeLabel,
  getLastNDays,
  getAnalyticsPresets,
  formatHMS,
  DEFAULT_ANALYTICS_DAYS,
} from "../utils";
import Player from "../../blocks/shared/Player";
import { getProvider } from "../../blocks/util";
import AnalyticsDetailSkeleton from "../components/Skeletons/AnalyticsDetailSkeleton";
import StatCard from "../components/StatCard";
import ChartEmptyState from "../components/ChartEmptyState";

import {
  CHART_COLOR,
  GRID_COLOR,
  AXIS_LABEL_COLOR,
  STROKE_WIDTH,
  RETENTION_GRADIENT_OPACITY,
  ANIMATION_DURATION,
  ANIMATION_EASING,
  useChartGradientId,
  ChartActiveDot,
  ChartCrosshair,
  RetentionTooltip,
} from "../components/charts";

/**
 * Audience Retention mini-chart using Recharts AreaChart.
 * Shows watch-time distribution across the video timeline.
 */
const RetentionChart = ({ data }) => {
  const gradientId = useChartGradientId("retention");

  if (!data || data.length === 0) {
    return <ChartEmptyState className="h-full" description={null} proGated />;
  }

  return (
    <ResponsiveContainer
      width="100%"
      height="100%"
      minHeight={140}
      className="[&_.recharts-surface]:cursor-crosshair"
    >
      <AreaChart
        data={data}
        margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLOR} stopOpacity={0.7} />
            <stop offset="90%" stopColor={CHART_COLOR} stopOpacity={0.3} />
            <stop offset="100%" stopColor={CHART_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          horizontal={true}
          vertical={false}
          stroke={GRID_COLOR}
          strokeWidth={0.5}
        />
        <XAxis
          dataKey="seconds"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: AXIS_LABEL_COLOR }}
          tickFormatter={formatHMS}
        />
        <YAxis
          hide
          domain={[0, "auto"]}
          allowDecimals={false}
        />
        <Tooltip
          content={<RetentionTooltip />}
          cursor={<ChartCrosshair />}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={CHART_COLOR}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={<ChartActiveDot />}
          isAnimationActive={true}
          animationDuration={ANIMATION_DURATION}
          animationEasing={ANIMATION_EASING}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

/**
 * Renders the Presto Player video embed for a given media item.
 * Uses the same Player component as the original analytics detail page.
 */
const VideoPlayer = ({ media }) => {
  if (!media?.src) return null;

  return (
    <div className="w-full aspect-video rounded-xl overflow-hidden [&_.wp-block-video]:h-full [&_.presto-block-video]:h-full [&_presto-player]:h-full">
      <Player
        src={media.src}
        attributes={{
          title: media.title,
          poster: media.poster,
        }}
        type={getProvider(media.src)}
        preset={{
          ...media.preset,
          "play-large": true,
          play: true,
          progress: true,
          rewind: true,
          "fast-forward": true,
          "current-time": true,
          volume: true,
          mute: true,
          i18n: window.prestoPlayer?.i18n,
        }}
        branding={media.branding}
        preload="metadata"
      />
    </div>
  );
};

/**
 * Analytics Detail Page
 *
 * Reached by clicking "View Details" on a media row in the Top Media table
 * on the Analytics page. URL pattern: ?tab=Analytics&detail=media&id={mediaId}
 *
 * Layout:
 *  - Header: back button, video title, date range picker
 *  - Left column: Presto Player video embed (16:9)
 *  - Right column: 3 stat cards (Unique views, Avg watch time, Audience retention)
 */
const AnalyticsDetail = () => {
  const history = useHistory();
  const location = useLocation();
  const mediaId = location.params?.id;

  const { media, stats, isLoading, error, refetch } =
    useMediaDetail(mediaId);

  const [videoReady, setVideoReady] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  // Optimistic title used after a successful rename so the new value shows
  // immediately without paying for a full media+stats refetch.
  const [titleOverride, setTitleOverride] = useState(null);

  const displayedTitle =
    titleOverride ?? media?.title ?? __("Media Detail", "presto-player");

  const beginTitleEdit = () => {
    setEditedTitle(displayedTitle);
    setIsEditingTitle(true);
  };

  const cancelTitleEdit = () => {
    setIsEditingTitle(false);
    setEditedTitle("");
  };

  const saveTitleEdit = async () => {
    const next = editedTitle.trim();
    if (!next || next === displayedTitle) {
      cancelTitleEdit();
      return;
    }
    setSavingTitle(true);
    try {
      await apiFetch({
        path: `/presto-player/v1/videos/${mediaId}`,
        method: "PUT",
        data: { ...media, title: next },
      });
      setTitleOverride(next);
      setIsEditingTitle(false);
    } catch (e) {
      // Stay in edit mode so the user can retry; failure is rare and
      // visible (the input keeps the typed value).
    } finally {
      setSavingTitle(false);
    }
  };

  useEffect(() => {
    setVideoReady(false);
    if (isLoading || !media?.src) return;

    const markReady = () => setVideoReady(true);
    document.addEventListener("loadedmetadata", markReady, true);
    document.addEventListener("canplay", markReady, true);
    const fallback = window.setTimeout(markReady, 1500);

    return () => {
      document.removeEventListener("loadedmetadata", markReady, true);
      document.removeEventListener("canplay", markReady, true);
      window.clearTimeout(fallback);
    };
  }, [isLoading, media?.src]);

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

  const retentionData = stats.retentionData.map((item) => ({
    seconds: parseInt(item.watch_time, 10) || 0,
    value: parseInt(item.total, 10) || 0,
  }));

  const fromUserId = location.params?.from_user;
  const fromTab = location.params?.from;
  const handleBack = () => {
    if (fromUserId) {
      history.replace({ tab: "Analytics", detail: "user", id: fromUserId, from_user: null });
    } else if (fromTab) {
      history.replace({ tab: fromTab, detail: null, id: null, from: null });
    } else {
      history.replace({ tab: "Analytics", detail: null, id: null });
    }
  };

  // Loading state — show skeleton until data is fetched.
  // Once data arrives we mount the real layout (so the player can start
  // loading) and overlay the skeleton until the video is ready to play.
  if (isLoading) {
    return <AnalyticsDetailSkeleton />;
  }

  const showVideoOverlay = Boolean(media?.src) && !videoReady;

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
    <div className="relative">
      {showVideoOverlay && (
        <div className="absolute inset-0 z-10">
          <AnalyticsDetailSkeleton />
        </div>
      )}
    <Container
      className="p-8 bg-background-secondary"
      direction="column"
      gap="2xl"
    >
      <Container align="center" gap="sm">
        <Button
          variant="ghost"
          size="xs"
          icon={<ArrowLeft className="size-5" />}
          onClick={handleBack}
          className="shrink-0"
        />

        <Container align="center" gap="sm" className="flex-1 min-w-0">
          {isEditingTitle ? (
            <>
              <Input
                type="text"
                size="sm"
                value={editedTitle}
                onChange={(value) =>
                  setEditedTitle(typeof value === "string" ? value : value?.target?.value || "")
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveTitleEdit();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelTitleEdit();
                  }
                }}
                disabled={savingTitle}
                aria-label={__("Edit title", "presto-player")}
                className="flex-1 min-w-0"
              />
              <Button
                variant="primary"
                size="xs"
                icon={<Check className="size-4" />}
                onClick={saveTitleEdit}
                disabled={savingTitle}
                aria-label={__("Save title", "presto-player")}
              />
              <Button
                variant="ghost"
                size="xs"
                icon={<X className="size-4" />}
                onClick={cancelTitleEdit}
                disabled={savingTitle}
                aria-label={__("Cancel", "presto-player")}
              />
            </>
          ) : (
            <>
              <Text
                size={24}
                weight={600}
                color="primary"
                className="truncate tracking-[-0.14px]"
              >
                {displayedTitle}
              </Text>
              {media?.id && (
                <Button
                  variant="ghost"
                  size="xs"
                  icon={<PencilLine className="size-4" />}
                  onClick={beginTitleEdit}
                  aria-label={__("Rename media", "presto-player")}
                />
              )}
            </>
          )}
        </Container>

        {/* Date Range Picker */}
        <Container align="center" gap="xs" className="shrink-0">
          {(selectedDates.from || selectedDates.to) && (
            <Button
              variant="link"
              size="xs"
              icon={<X />}
              onClick={handleClearFilters}
              className="flex items-center gap-1 text-button-danger hover:text-button-danger transition-colors"
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
              className="w-60 cursor-pointer [&>input]:min-h-8 rounded-sm border border-solid border-field-border bg-field-secondary-background"
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

      {/* Main Content: Video + Stats */}
      <Container gap="lg">
        {/* Left: Video Player */}
        <Container className="flex-1 min-w-0">
          <VideoPlayer media={media} />
        </Container>

        {/* Right: Stat Cards */}
        <Container direction="column" gap="lg" className="w-[500px] shrink-0">
          <StatCard
            label={
              <span className="inline-flex items-center gap-1.5">
                {__("Unique views", "presto-player")}
                <ForceTooltip
                  content={__("Each viewer is counted once, even if they watch the video multiple times.", "presto-player")}
                  arrow
                  placement="right"
                >
                  <Info className="size-3.5 text-icon-secondary cursor-help shrink-0" />
                </ForceTooltip>
              </span>
            }
            value={String(stats.uniqueViews)}
          />
          <StatCard
            label={
              <span className="inline-flex items-center gap-1.5">
                {__("Average watch time", "presto-player")}
                <ForceTooltip
                  content={__("Mean duration watched per view across all viewers in the selected date range.", "presto-player")}
                  arrow
                  placement="right"
                >
                  <Info className="size-3.5 text-icon-secondary cursor-help shrink-0" />
                </ForceTooltip>
              </span>
            }
            value={stats.avgWatchTime}
          />
          <StatCard
            className="flex-1 min-h-0"
            label={
              <span className="inline-flex items-center gap-1.5">
                {__("Audience Retention", "presto-player")}
                <ForceTooltip
                  content={__("Shows how many viewers watched each moment of the video. Drop-offs indicate where people stopped watching.", "presto-player")}
                  arrow
                  placement="right"
                >
                  <Info className="size-3.5 text-icon-secondary cursor-help shrink-0" />
                </ForceTooltip>
              </span>
            }
          >
            <RetentionChart data={retentionData} />
          </StatCard>
        </Container>
      </Container>
    </Container>
    </div>
  );
};

export default AnalyticsDetail;
