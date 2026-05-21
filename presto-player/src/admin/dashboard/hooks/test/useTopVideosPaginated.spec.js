import { renderHook, act } from "@testing-library/react-hooks";
import apiFetch from "@wordpress/api-fetch";
import useTopVideosPaginated from "../useTopVideosPaginated";

jest.mock("@wordpress/api-fetch");

const dateParams = {
  start: "2026-04-11T00:00:00.000Z",
  end: "2026-05-10T00:00:00.000Z",
};

// Minimal canned response that matches the shape produced by the
// /analytics/top-videos endpoint (an array of { video, stats } items)
// and the headers the hook reads.
const mockResponse = ({
  items = [],
  total = items.length,
  totalPages = total ? Math.max(1, Math.ceil(total / 10)) : 0,
} = {}) => ({
  headers: {
    get: (h) =>
      h === "X-WP-Total"
        ? String(total)
        : h === "X-WP-TotalPages"
        ? String(totalPages)
        : null,
  },
  json: async () => items,
});

const mockItem = (id, title) => ({
  video: { id, title, post_id: id },
  stats: [{ data: "5 views" }, { data: "1m 0s" }],
});

beforeAll(() => {
  global.window.prestoPlayer = {
    api: { analyticsTopVideos: "/presto-player/v1/analytics/top-videos" },
  };
});

beforeEach(() => {
  apiFetch.mockReset();
});

describe("useTopVideosPaginated", () => {
  it("fetches page 1 and parses X-WP-Total / X-WP-TotalPages from headers", async () => {
    apiFetch.mockResolvedValue(
      mockResponse({ items: [mockItem(1, "a"), mockItem(2, "b")], total: 12, totalPages: 2 })
    );

    const { result, waitForNextUpdate } = renderHook(() =>
      useTopVideosPaginated({ dateParams, perPage: 10 })
    );

    await waitForNextUpdate();

    expect(result.current.pagination).toEqual({
      totalItems: 12,
      totalPages: 2,
    });
    expect(result.current.topMedia).toHaveLength(2);
    expect(result.current.topMedia[0]).toMatchObject({ id: 1, title: "a" });
    expect(apiFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringContaining("page=1"),
        parse: false,
      })
    );
  });

  it("includes user_id in the request when provided", async () => {
    apiFetch.mockResolvedValue(mockResponse({ items: [], total: 0, totalPages: 0 }));

    renderHook(() =>
      useTopVideosPaginated({ userId: 42, dateParams, perPage: 10 })
    );
    // Allow the effect to run.
    await act(async () => {});

    expect(apiFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringContaining("user_id=42"),
      })
    );
  });

  it("omits user_id when not provided", async () => {
    apiFetch.mockResolvedValue(mockResponse({ items: [], total: 0, totalPages: 0 }));

    renderHook(() => useTopVideosPaginated({ dateParams, perPage: 10 }));
    await act(async () => {});

    const lastCall = apiFetch.mock.calls.at(-1)[0];
    expect(lastCall.path).not.toContain("user_id=");
  });

  it("setPage triggers a refetch with the new page param", async () => {
    apiFetch.mockResolvedValue(
      mockResponse({ items: [mockItem(1, "a")], total: 12, totalPages: 2 })
    );

    const { result, waitForNextUpdate } = renderHook(() =>
      useTopVideosPaginated({ dateParams, perPage: 10 })
    );
    await waitForNextUpdate();

    act(() => {
      result.current.setPage(2);
    });
    await waitForNextUpdate();

    const lastCall = apiFetch.mock.calls.at(-1)[0];
    expect(lastCall.path).toContain("page=2");
  });

  it("resets page to 1 when scope (userId) changes", async () => {
    apiFetch.mockResolvedValue(
      mockResponse({ items: [], total: 12, totalPages: 2 })
    );

    const { result, rerender, waitForNextUpdate } = renderHook(
      ({ userId }) =>
        useTopVideosPaginated({ userId, dateParams, perPage: 10 }),
      { initialProps: { userId: 1 } }
    );
    await waitForNextUpdate();

    await act(async () => {
      result.current.setPage(2);
    });
    expect(result.current.page).toBe(2);

    // Scope change → page should reset, then a fresh fetch fires.
    await act(async () => {
      rerender({ userId: 99 });
    });
    expect(result.current.page).toBe(1);
  });

  it("surfaces non-abort fetch errors", async () => {
    apiFetch.mockRejectedValueOnce(new Error("500"));

    const { result, waitForNextUpdate } = renderHook(() =>
      useTopVideosPaginated({ dateParams })
    );
    await waitForNextUpdate();

    expect(result.current.error).toBe("500");
    expect(result.current.topMedia).toEqual([]);
    expect(result.current.pagination).toEqual({
      totalItems: 0,
      totalPages: 0,
    });
  });

  it("skips fetching when enabled=false", async () => {
    renderHook(() =>
      useTopVideosPaginated({ dateParams, enabled: false })
    );
    await act(async () => {});
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("skips fetching when dateParams is incomplete", async () => {
    renderHook(() =>
      useTopVideosPaginated({ dateParams: { start: "", end: "" } })
    );
    await act(async () => {});
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
