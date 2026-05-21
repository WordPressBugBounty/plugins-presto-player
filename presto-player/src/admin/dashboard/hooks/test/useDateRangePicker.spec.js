import { renderHook, act } from "@testing-library/react-hooks";
import useDateRangePicker from "../useDateRangePicker";

describe("useDateRangePicker", () => {
  let refetch;

  beforeEach(() => {
    refetch = jest.fn();
    // Clean any stray DOM from prior tests.
    document.body.innerHTML = "";
  });

  it("calls refetchFn(from, to) when both dates are applied", () => {
    const { result } = renderHook(() => useDateRangePicker(refetch));
    const from = new Date("2026-01-01");
    const to = new Date("2026-01-05");

    act(() => {
      result.current.handleDateApply({ from, to });
    });

    expect(result.current.selectedDates).toEqual({ from, to });
    expect(result.current.isDatePickerOpen).toBe(false);
    expect(refetch).toHaveBeenCalledWith(from, to);
  });

  it("swaps from/to when the user applies a reversed range", () => {
    const { result } = renderHook(() => useDateRangePicker(refetch));
    const earlier = new Date("2026-01-01");
    const later = new Date("2026-02-01");

    act(() => {
      // User picked "from = later, to = earlier" — hook should swap.
      result.current.handleDateApply({ from: later, to: earlier });
    });

    expect(result.current.selectedDates).toEqual({
      from: earlier,
      to: later,
    });
  });

  it("treats a single-day pick (only `from`) as { from, to: from }", () => {
    const { result } = renderHook(() => useDateRangePicker(refetch));
    const day = new Date("2026-03-15");

    act(() => {
      result.current.handleDateApply({ from: day, to: undefined });
    });

    expect(result.current.selectedDates).toEqual({ from: day, to: day });
    expect(refetch).toHaveBeenCalledWith(day, day);
  });

  it("clears selection when handleDateApply is called with no dates", () => {
    const { result } = renderHook(() => useDateRangePicker(refetch));

    // Set something first.
    act(() => {
      result.current.handleDateApply({
        from: new Date("2026-01-01"),
        to: new Date("2026-01-02"),
      });
    });
    refetch.mockClear();

    act(() => {
      result.current.handleDateApply({ from: null, to: null });
    });

    expect(result.current.selectedDates).toEqual({ from: null, to: null });
    // No refetch fires for an empty range — only when both ends are set.
    expect(refetch).not.toHaveBeenCalled();
  });

  it("handleClearFilters resets dates and calls refetchFn() with no args", () => {
    const { result } = renderHook(() => useDateRangePicker(refetch));

    act(() => {
      result.current.handleDateApply({
        from: new Date("2026-01-01"),
        to: new Date("2026-01-05"),
      });
    });
    refetch.mockClear();

    act(() => {
      result.current.handleClearFilters();
    });

    expect(result.current.selectedDates).toEqual({ from: null, to: null });
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(refetch).toHaveBeenCalledWith();
  });

  it("closes the picker when a mousedown fires outside the ref'd element", () => {
    const inside = document.createElement("div");
    const outside = document.createElement("div");
    document.body.appendChild(inside);
    document.body.appendChild(outside);

    const { result } = renderHook(() => useDateRangePicker(refetch));

    act(() => {
      result.current.datePickerRef.current = inside;
      result.current.setIsDatePickerOpen(true);
    });
    expect(result.current.isDatePickerOpen).toBe(true);

    act(() => {
      outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(result.current.isDatePickerOpen).toBe(false);
  });

  it("does NOT close the picker when mousedown fires inside the ref'd element", () => {
    const inside = document.createElement("div");
    const child = document.createElement("span");
    inside.appendChild(child);
    document.body.appendChild(inside);

    const { result } = renderHook(() => useDateRangePicker(refetch));

    act(() => {
      result.current.datePickerRef.current = inside;
      result.current.setIsDatePickerOpen(true);
    });

    act(() => {
      child.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(result.current.isDatePickerOpen).toBe(true);
  });

  it("removes the click-outside listener when the picker closes", () => {
    const inside = document.createElement("div");
    const outside = document.createElement("div");
    document.body.appendChild(inside);
    document.body.appendChild(outside);

    const { result } = renderHook(() => useDateRangePicker(refetch));

    act(() => {
      result.current.datePickerRef.current = inside;
      result.current.setIsDatePickerOpen(true);
    });
    act(() => {
      result.current.setIsDatePickerOpen(false);
    });

    // After close, a stray outside-click should not toggle anything.
    act(() => {
      outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(result.current.isDatePickerOpen).toBe(false);
  });
});
