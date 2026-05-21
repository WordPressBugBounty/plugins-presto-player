import { useState, useEffect, useRef, useCallback } from "@wordpress/element";

/**
 * Encapsulates date range picker state, handlers, and side-effects
 * used by analytics detail pages.
 *
 * @param {Function} refetchFn - Called with (from, to) when dates change, or with no args on clear.
 */
const useDateRangePicker = (refetchFn) => {
  const [selectedDates, setSelectedDates] = useState({ from: null, to: null });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const datePickerRef = useRef(null);

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
    setIsDatePickerOpen(false);
  }, []);

  const handleDateCancel = useCallback(() => {
    setIsDatePickerOpen(false);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSelectedDates({ from: null, to: null });
    refetchFn();
  }, [refetchFn]);

  // Refetch when date range changes
  useEffect(() => {
    if (selectedDates.from && selectedDates.to) {
      refetchFn(selectedDates.from, selectedDates.to);
    }
  }, [selectedDates.from, selectedDates.to, refetchFn]);

  // Close on click outside
  useEffect(() => {
    if (!isDatePickerOpen) return;

    function handleClickOutside(event) {
      if (
        datePickerRef.current &&
        !datePickerRef.current.contains(event.target)
      ) {
        setIsDatePickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDatePickerOpen]);

  return {
    selectedDates,
    isDatePickerOpen,
    setIsDatePickerOpen,
    datePickerRef,
    handleDateApply,
    handleDateCancel,
    handleClearFilters,
  };
};

export default useDateRangePicker;
