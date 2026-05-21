import { useState, useEffect, useRef, useMemo, useCallback } from "@wordpress/element";
import { Container, Input, DatePicker, Button } from "@bsf/force-ui";
import { __ } from "@wordpress/i18n";
import { Calendar, X } from "lucide-react";
import { getRangeLabel, getAnalyticsPresets } from "../../utils";
import { useChartContext } from "./ChartContext";

const clearIcon = <X />;
const calendarIcon = <Calendar className="text-icon-secondary" />;

const ChartDateFilter = () => {
  const { selectedDates, setSelectedDates, defaultDateRange } = useChartContext();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Date normalization (from/to swap, single-date handling) is handled
  // by the data layer via hookData.handleDateApply — no need to duplicate here.
  const handleApply = useCallback(
    (dates) => {
      setSelectedDates(dates);
      setIsOpen(false);
    },
    [setSelectedDates]
  );

  const handleCancel = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleClear = useCallback(() => {
    setSelectedDates(null);
  }, [setSelectedDates]);

  const presets = useMemo(() => getAnalyticsPresets(), []);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const hasFilters = selectedDates?.from || selectedDates?.to;

  return (
    <Container align="center" gap="xs">
      {hasFilters && (
        <Button
          variant="link"
          size="xs"
          icon={clearIcon}
          onClick={handleClear}
          className="flex items-center gap-1 text-xs font-medium text-button-danger hover:text-button-danger transition-colors"
          aria-label={__("Clear Filters", "presto-player")}
        >
          {__("Clear Filters", "presto-player")}
        </Button>
      )}

      <div className="relative" ref={containerRef}>
        <Input
          type="text"
          size="sm"
          value={getRangeLabel(
            selectedDates?.from && selectedDates?.to
              ? selectedDates
              : defaultDateRange
          )}
          suffix={calendarIcon}
          onClick={() => setIsOpen((prev) => !prev)}
          className="w-auto min-w-[200px] cursor-pointer rounded-sm shadow-sm border border-border-subtle"
          readOnly
          aria-label={__("Select Date Range", "presto-player")}
        />

        {isOpen && (
          <div className="absolute z-50 mt-2 rounded-lg shadow-lg right-0 bg-background-primary">
            <DatePicker
              applyButtonText={__("Apply", "presto-player")}
              cancelButtonText={__("Cancel", "presto-player")}
              selectionType="range"
              showOutsideDays={false}
              variant="presets"
              presets={presets}
              onApply={handleApply}
              onCancel={handleCancel}
              selected={
                selectedDates?.from && selectedDates?.to
                  ? selectedDates
                  : defaultDateRange
              }
              disabled={{ after: new Date() }}
            />
          </div>
        )}
      </div>
    </Container>
  );
};

export default ChartDateFilter;
