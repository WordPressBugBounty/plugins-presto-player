import { useState, useMemo, useEffect, useRef, useCallback } from "@wordpress/element";
import { __ } from "@wordpress/i18n";
import {
  formatChartData,
  padDailyPoints,
  format,
  getAllTimeRange,
  getLastNDays,
  DEFAULT_ANALYTICS_DAYS,
  fetchViews,
  fetchWatchTime,
  toAnalyticsDate,
} from "../utils";

// Watch time stays in seconds for the chart so low values (e.g. 6s) plot
// above the x-axis. The Y-axis and tooltip handle unit formatting.
const formatData = (data, range) =>
  padDailyPoints(formatChartData(data, "total", false, format), range, format);

const useEngagementChartData = ({ showAllTimeSummary = false }) => {
  // Analytics endpoints are Pro-only. For free users, skip the fetch and let
  // the chart render its built-in "No Stats Available" empty state — rather
  // than firing doomed requests that surface as a red error banner.
  const isPremium = !! window.prestoPlayer?.isPremium;

  const [activeChartTab, setActiveChartTab] = useState("views");
  const [selectedDates, setSelectedDates] = useState({ from: null, to: null });
  const [mountData, setMountData] = useState(null);
  const [isInitialLoading, setIsInitialLoading] = useState(isPremium);
  const [filteredResult, setFilteredResult] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  // Errors are tracked per-metric so a watch-time failure doesn't paint a
  // red banner on the views tab (and vice versa). `filterError` is only
  // relevant while a `filteredResult` is in play; it resets on tab switch
  // because the in-flight fetch was for the prior tab.
  const [mountErrors, setMountErrors] = useState({
    views: null,
    watchTime: null,
  });
  const [filterError, setFilterError] = useState(null);

  const mountAbortRef = useRef(null);
  const fetchAbortRef = useRef(null);
  const defaultDateRange = useMemo(
    () => getLastNDays(DEFAULT_ANALYTICS_DAYS),
    []
  );

  // --- Mount-level fetch (default last-N-days + optional all-time summary) ---
  useEffect(() => {
    if (!isPremium) {
      return;
    }

    mountAbortRef.current = new AbortController();
    const { signal } = mountAbortRef.current;

    const fetchInitialData = async () => {
      try {
        setIsInitialLoading(true);
        setMountErrors({ views: null, watchTime: null });

        const { from: startDate, to: endDate } = getLastNDays(
          DEFAULT_ANALYTICS_DAYS
        );

        const start = toAnalyticsDate(startDate);
        const end = toAnalyticsDate(endDate);

        // When the consumer asks for an all-time summary (Dashboard's two
        // "All Time …" cards), fetch the all-time totals in parallel —
        // the chart itself runs on the default last-N-days window above,
        // so the summary needs its own pair of requests.
        const requests = [
          fetchViews(start, end, { signal }),
          fetchWatchTime(start, end, { signal }),
        ];
        if (showAllTimeSummary) {
          const all = getAllTimeRange();
          const allStart = toAnalyticsDate(all.from);
          const allEnd = toAnalyticsDate(all.to);
          requests.push(fetchViews(allStart, allEnd, { signal }));
          requests.push(fetchWatchTime(allStart, allEnd, { signal }));
        }

        const results = await Promise.allSettled(requests);

        const views =
          results[0].status === "fulfilled"
            ? results[0].value
            : { total: 0, chartData: [] };
        const watchTime =
          results[1].status === "fulfilled"
            ? results[1].value
            : { total: 0, chartData: [], average: 0 };

        let allTimeViewsTotal = null;
        let allTimeWatchTimeTotal = null;
        if (showAllTimeSummary) {
          if (results[2]?.status === "fulfilled") {
            allTimeViewsTotal = results[2].value.total;
          } else if (results[2]?.status === "rejected") {
            // Aborts are noise; everything else is a genuine failure that
            // would otherwise leave the "All Time Views" card silently blank.
            if (results[2].reason?.name !== "AbortError") {
              console.warn(
                "Failed to load all-time views summary:",
                results[2].reason
              );
            }
          }
          if (results[3]?.status === "fulfilled") {
            allTimeWatchTimeTotal = results[3].value.total;
          } else if (results[3]?.status === "rejected") {
            if (results[3].reason?.name !== "AbortError") {
              console.warn(
                "Failed to load all-time watch-time summary:",
                results[3].reason
              );
            }
          }
        }

        setMountData({
          totalViews: views.total,
          viewsChartData: views.chartData,
          totalWatchTime: watchTime.total,
          watchTimeChartData: watchTime.chartData,
          range: { from: startDate, to: endDate },
          allTimeViews: allTimeViewsTotal,
          allTimeWatchTime: allTimeWatchTimeTotal,
        });

        setMountErrors({
          views:
            results[0].status === "rejected"
              ? __(
                  "Couldn't load views. Try refreshing the page.",
                  "presto-player"
                )
              : null,
          watchTime:
            results[1].status === "rejected"
              ? __(
                  "Couldn't load watch time. Try refreshing the page.",
                  "presto-player"
                )
              : null,
        });
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("Error fetching engagement data:", err);
        setMountData({
          totalViews: 0,
          viewsChartData: [],
          totalWatchTime: 0,
          watchTimeChartData: [],
          allTimeViews: null,
          allTimeWatchTime: null,
        });
        setMountErrors({
          views: __(
            "Couldn't load views. Try refreshing the page.",
            "presto-player"
          ),
          watchTime: __(
            "Couldn't load watch time. Try refreshing the page.",
            "presto-player"
          ),
        });
      } finally {
        setIsInitialLoading(false);
      }
    };

    fetchInitialData();

    return () => {
      mountAbortRef.current?.abort();
    };
  }, [showAllTimeSummary, isPremium]);

  // --- Derived values ---
  const isWatchTime = activeChartTab === "watch-time";

  const dataToShow = useMemo(() => {
    if (filteredResult?.chartData) return filteredResult.chartData;
    if (!mountData) return [];

    const source = isWatchTime
      ? mountData.watchTimeChartData
      : mountData.viewsChartData;
    if (!source.length) return [];

    return formatData(source, mountData.range);
  }, [isWatchTime, mountData, filteredResult]);

  const currentTotal = useMemo(() => {
    if (filteredResult?.total != null) return filteredResult.total;
    if (!mountData) return 0;
    return isWatchTime
      ? (mountData.totalWatchTime || 0)
      : (mountData.totalViews || 0);
  }, [isWatchTime, mountData, filteredResult]);

  // Pick the error appropriate for what the user is currently looking at:
  // - while a date filter is active, the in-flight metric's filter error
  // - otherwise, the active tab's mount-fetch error
  // This stops a failure on one metric from painting a banner on the
  // other tab where the data is fine.
  const activeError = useMemo(() => {
    if (filteredResult !== null) return filterError;
    return isWatchTime ? mountErrors.watchTime : mountErrors.views;
  }, [filteredResult, filterError, isWatchTime, mountErrors]);

  // --- Date-filter fetch ---
  const fetchChartData = useCallback(async (dates, chartType) => {
    if (!isPremium) {
      return;
    }
    if (!dates.from) {
      return;
    }

    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
    }

    fetchAbortRef.current = new AbortController();
    const { signal } = fetchAbortRef.current;

    const start = toAnalyticsDate(dates.from);
    const end = toAnalyticsDate(dates.to || dates.from);
    const isWT = chartType === "watch-time";

    setIsFetching(true);

    try {
      setFilterError(null);
      const result = isWT
        ? await fetchWatchTime(start, end, { signal })
        : await fetchViews(start, end, { signal });

      const range = { from: dates.from, to: dates.to || dates.from };
      if (result.chartData?.length) {
        setFilteredResult({
          chartData: formatData(result.chartData, range),
          total: result.total,
        });
      } else {
        setFilteredResult({
          chartData: formatData([], range),
          total: 0,
        });
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Error fetching chart data:", err);
        setFilterError(
          __("Failed to load chart data. Please try again.", "presto-player")
        );
        setFilteredResult({ chartData: [], total: 0 });
      }
    } finally {
      setIsFetching(false);
    }
  }, [isPremium]);

  useEffect(() => {
    if (selectedDates.from) {
      fetchChartData(selectedDates, activeChartTab);
    }

    return () => {
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
      }
    };
  }, [selectedDates.from, selectedDates.to, activeChartTab, fetchChartData]);

  // --- Callbacks ---
  const handleClearFilters = useCallback(() => {
    setSelectedDates({ from: null, to: null });
    setFilteredResult(null);
    setFilterError(null);
  }, []);

  const handleTabChange = useCallback(({ value }) => {
    setActiveChartTab(value.slug);
    // Drop the prior tab's filtered result + filter error; the effect will
    // refetch for the new tab if a date range is still selected.
    setFilteredResult(null);
    setFilterError(null);
  }, []);

  const handleDateApply = useCallback((dates) => {
    const { from, to } = dates;

    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      setSelectedDates(fromDate > toDate ? { from: to, to: from } : dates);
    } else if (from && !to) {
      setSelectedDates({ from, to: from });
    } else {
      setSelectedDates({ from: null, to: null });
    }
  }, []);

  // --- Context-ready callbacks (match what consumers expect) ---
  const setActiveTab = useCallback(
    (slug) => handleTabChange({ value: { slug } }),
    [handleTabChange]
  );

  const setSelectedDatesForContext = useCallback(
    (dates) => {
      if (dates === null) {
        handleClearFilters();
      } else {
        handleDateApply(dates);
      }
    },
    [handleClearFilters, handleDateApply]
  );

  // --- Return context-ready value ---
  return useMemo(
    () => ({
      activeTab: activeChartTab,
      setActiveTab,
      chartData: dataToShow,
      total: currentTotal,
      allTimeViews: showAllTimeSummary ? (mountData?.allTimeViews ?? null) : null,
      allTimeWatchTime: showAllTimeSummary ? (mountData?.allTimeWatchTime ?? null) : null,
      isWatchTime,
      selectedDates,
      setSelectedDates: setSelectedDatesForContext,
      defaultDateRange,
      isLoading: isInitialLoading || isFetching,
      error: activeError,
    }),
    [
      activeChartTab,
      setActiveTab,
      dataToShow,
      currentTotal,
      showAllTimeSummary,
      mountData,
      isWatchTime,
      selectedDates,
      setSelectedDatesForContext,
      defaultDateRange,
      isInitialLoading,
      isFetching,
      activeError,
    ]
  );
};

export default useEngagementChartData;
