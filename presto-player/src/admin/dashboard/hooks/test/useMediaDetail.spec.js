import { renderHook, act } from "@testing-library/react-hooks";
import apiFetch from "@wordpress/api-fetch";
import { addQueryArgs } from "@wordpress/url";
import useMediaDetail from "../useMediaDetail";

jest.mock("@wordpress/api-fetch");

beforeAll(() => {
  // The hook uses the WordPress URL helper via the global `wp.url` namespace
  // (not the named import), which webpack provides at runtime.
  global.wp = global.wp || {};
  global.wp.url = { addQueryArgs };
});

beforeEach(() => {
  apiFetch.mockReset();
});

describe("useMediaDetail", () => {
  it("does not fire any fetches when mediaId is falsy", async () => {
    const { result } = renderHook(() => useMediaDetail(null));
    await act(async () => {});
    expect(apiFetch).not.toHaveBeenCalled();
    expect(result.current.media).toBeNull();
  });

  it("fetches the video, then runs all three analytics calls in parallel", async () => {
    apiFetch
      // 1) /presto-player/v1/videos/42 — base video
      .mockResolvedValueOnce({
        id: 42,
        title: "Demo",
        src: "https://cdn/v.mp4",
        type: "self-hosted",
        post_id: null,
      })
      // 2) views, 3) avg, 4) timeline (Promise.all preserves array order)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(180)
      .mockResolvedValueOnce([{ position: 0, retention: 1 }]);

    const { result, waitForNextUpdate } = renderHook(() => useMediaDetail(42));
    await waitForNextUpdate();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.media).toMatchObject({
      id: 42,
      title: "Demo",
      src: "https://cdn/v.mp4",
      provider: "self-hosted",
      // No postId on response → shortcode falls back to videoResponse.id.
      shortcode: "[presto_player id=42]",
    });

    expect(result.current.stats).toEqual({
      uniqueViews: 7,
      avgWatchTime: "00:03:00",
      retentionData: [{ position: 0, retention: 1 }],
    });

    // 1 video + 3 analytics = 4 calls (no WP enrichment without post_id).
    expect(apiFetch).toHaveBeenCalledTimes(4);
  });

  it("enriches media metadata via WP REST when a post_id is present", async () => {
    apiFetch
      .mockResolvedValueOnce({
        id: 42,
        title: "Basic Title",
        src: "https://cdn/v.mp4",
        post_id: 100,
      })
      // /wp/v2/presto-videos?include=100&_embed=1
      .mockResolvedValueOnce([
        {
          post_title: "Rich WP Title",
          details: {
            poster: "https://cdn/poster.jpg",
            provider: "youtube",
            preset: { id: 9 },
            branding: { color: "red" },
            blockAttributes: { foo: 1 },
            tracks: [{ kind: "captions" }],
          },
        },
      ])
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce([]);

    const { result, waitForNextUpdate } = renderHook(() => useMediaDetail(42));
    await waitForNextUpdate();

    expect(result.current.media).toMatchObject({
      title: "Rich WP Title",
      poster: "https://cdn/poster.jpg",
      provider: "youtube",
      preset: { id: 9 },
      branding: { color: "red" },
      blockAttributes: { foo: 1 },
      tracks: [{ kind: "captions" }],
      // post_id present → shortcode uses it.
      shortcode: "[presto_player id=100]",
    });
    expect(apiFetch).toHaveBeenCalledTimes(5);
  });

  it("falls back to basic video data when WP REST enrichment fails", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    apiFetch
      .mockResolvedValueOnce({
        id: 42,
        title: "Basic",
        src: "https://cdn/v.mp4",
        post_id: 100,
      })
      .mockRejectedValueOnce(new Error("404"))
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce([]);

    const { result, waitForNextUpdate } = renderHook(() => useMediaDetail(42));
    await waitForNextUpdate();

    expect(result.current.media).toMatchObject({
      title: "Basic",
      shortcode: "[presto_player id=100]",
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("falls back to default analytics defaults when the analytics calls fail (free tier)", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    apiFetch
      .mockResolvedValueOnce({ id: 42, title: "x", post_id: null })
      // Promise.all rejects on first failure; the subsequent mocks are
      // never read.
      .mockRejectedValueOnce(new Error("403"));

    const { result, waitForNextUpdate } = renderHook(() => useMediaDetail(42));
    await waitForNextUpdate();

    expect(result.current.stats).toEqual({
      uniqueViews: 0,
      avgWatchTime: "00:00:00",
      retentionData: [],
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("surfaces a top-level error message when the video fetch itself fails", async () => {
    const errorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    apiFetch.mockRejectedValueOnce(new Error("video gone"));

    const { result, waitForNextUpdate } = renderHook(() => useMediaDetail(42));
    await waitForNextUpdate();

    expect(result.current.error).toBe("video gone");
    expect(result.current.isLoading).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("refetch passes start/end into the analytics path query string", async () => {
    apiFetch
      .mockResolvedValueOnce({ id: 42, title: "x", post_id: null })
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce([]);

    const { result, waitForNextUpdate } = renderHook(() => useMediaDetail(42));
    await waitForNextUpdate();

    apiFetch.mockReset();
    apiFetch
      .mockResolvedValueOnce({ id: 42, title: "x", post_id: null })
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce([]);

    const from = new Date(Date.UTC(2026, 0, 5));
    const to = new Date(Date.UTC(2026, 0, 10));
    await act(async () => {
      await result.current.refetch(from, to);
    });

    // Analytics calls (last 3 of the new 4) carry the date params.
    const analyticsPaths = apiFetch.mock.calls
      .slice(1)
      .map((c) => c[0].path);
    expect(analyticsPaths.every((p) => p.includes("start=2026-01-05"))).toBe(
      true
    );
    expect(analyticsPaths.every((p) => p.includes("end=2026-01-10"))).toBe(
      true
    );
  });

});
