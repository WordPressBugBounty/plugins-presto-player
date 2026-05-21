import { renderHook, act } from "@testing-library/react-hooks";
import apiFetch from "@wordpress/api-fetch";
import useEmail, { EMAIL_SUBMISSIONS_PATH } from "../useEmail";

jest.mock("@wordpress/api-fetch");

const makeRow = (id, date) => ({
  id,
  email: `user${id}@example.com`,
  video_title: "Video",
  preset_name: "Default",
  date,
});

// Fake of the Response object the hook gets back when apiFetch is called
// with `parse: false`. Returns a single page; total-pages defaults to 1.
const fakeResponse = (items, totalPages = 1) => ({
  headers: { get: (name) => (name === "X-WP-TotalPages" ? String(totalPages) : null) },
  json: async () => items,
});

const mockPagesOnce = (...pages) => {
  pages.forEach((page, idx) => {
    apiFetch.mockResolvedValueOnce(fakeResponse(page, pages.length));
  });
};

beforeEach(() => {
  apiFetch.mockReset();
});

describe("useEmail", () => {
  it("fetches /email-submissions on mount and exposes raw + sorted lists", async () => {
    mockPagesOnce([
      makeRow(1, "2026-01-01T00:00:00"),
      makeRow(2, "2026-03-01T00:00:00"),
    ]);

    const { result, waitForNextUpdate } = renderHook(() => useEmail());

    expect(result.current.loading).toBe(true);
    await waitForNextUpdate();

    expect(apiFetch).toHaveBeenCalledWith({
      path: `${EMAIL_SUBMISSIONS_PATH}?per_page=100&page=1`,
      method: "GET",
      parse: false,
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.rawEmails).toHaveLength(2);
    // Default sort: date desc → newest first.
    expect(result.current.emails.map((r) => r.id)).toEqual([2, 1]);
    expect(result.current.sortField).toBe("date");
    expect(result.current.sortOrder).toBe("desc");
  });

  it("walks pages reported by X-WP-TotalPages and concatenates results", async () => {
    mockPagesOnce(
      [makeRow(1, "2026-01-01T00:00:00")],
      [makeRow(2, "2026-02-01T00:00:00")],
      [makeRow(3, "2026-03-01T00:00:00")]
    );

    const { result, waitForNextUpdate } = renderHook(() => useEmail());
    await waitForNextUpdate();

    expect(apiFetch).toHaveBeenCalledTimes(3);
    expect(result.current.rawEmails).toHaveLength(3);
    expect(result.current.emails.map((r) => r.id)).toEqual([3, 2, 1]);
  });

  it("returns an empty list and clears loading when the API rejects", async () => {
    // Hook logs the failure on its way to a graceful empty state — silence
    // the expected console.error so the failure mode is the only signal.
    const errorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    apiFetch.mockRejectedValueOnce(new Error("boom"));

    const { result, waitForNextUpdate } = renderHook(() => useEmail());
    await waitForNextUpdate();

    expect(result.current.loading).toBe(false);
    expect(result.current.emails).toEqual([]);
    expect(result.current.rawEmails).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("returns an empty list when the API returns a non-array payload", async () => {
    apiFetch.mockResolvedValueOnce(fakeResponse({ unexpected: "shape" }));

    const { result, waitForNextUpdate } = renderHook(() => useEmail());
    await waitForNextUpdate();

    expect(result.current.emails).toEqual([]);
  });

  it("flips sortOrder when handleSort is called for the active field (date)", async () => {
    mockPagesOnce([
      makeRow(1, "2026-01-01T00:00:00"),
      makeRow(2, "2026-03-01T00:00:00"),
    ]);
    const { result, waitForNextUpdate } = renderHook(() => useEmail());
    await waitForNextUpdate();

    // Currently desc; toggle → asc → oldest first.
    act(() => {
      result.current.handleSort("date");
    });
    expect(result.current.sortOrder).toBe("asc");
    expect(result.current.emails.map((r) => r.id)).toEqual([1, 2]);

    // Toggle again → desc.
    act(() => {
      result.current.handleSort("date");
    });
    expect(result.current.sortOrder).toBe("desc");
  });

  it("switching to a different sort field resets order to asc (or desc for date)", async () => {
    mockPagesOnce([
      makeRow(1, "2026-01-01T00:00:00"),
      makeRow(2, "2026-03-01T00:00:00"),
    ]);
    const { result, waitForNextUpdate } = renderHook(() => useEmail());
    await waitForNextUpdate();

    act(() => {
      result.current.handleSort("email");
    });
    expect(result.current.sortField).toBe("email");
    expect(result.current.sortOrder).toBe("asc");

    act(() => {
      result.current.handleSort("date");
    });
    expect(result.current.sortField).toBe("date");
    expect(result.current.sortOrder).toBe("desc");
  });

  it("treats missing dates as epoch 0 in the comparator", async () => {
    mockPagesOnce([
      { ...makeRow(1, ""), date: "" },
      makeRow(2, "2026-01-01T00:00:00"),
    ]);
    const { result, waitForNextUpdate } = renderHook(() => useEmail());
    await waitForNextUpdate();

    // desc → real date first, missing-date row last.
    expect(result.current.emails.map((r) => r.id)).toEqual([2, 1]);
  });

});
