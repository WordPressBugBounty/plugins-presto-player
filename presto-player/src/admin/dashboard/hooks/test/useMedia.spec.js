import { renderHook, act } from "@testing-library/react-hooks";
import apiFetch from "@wordpress/api-fetch";
import useMedia from "../useMedia";

jest.mock("@wordpress/api-fetch");

const makePost = (overrides = {}) => ({
  id: 1,
  title: { rendered: "Hello" },
  date: "2026-01-01T00:00:00",
  status: "publish",
  ...overrides,
});

beforeEach(() => {
  apiFetch.mockReset();
});

describe("useMedia", () => {
  describe("fetch + pagination", () => {
    it("requests page 1 with per_page=100, _embed=1, and the full status list", async () => {
      apiFetch.mockResolvedValueOnce([]);

      const { waitForNextUpdate } = renderHook(() => useMedia());
      await waitForNextUpdate();

      const path = apiFetch.mock.calls[0][0].path;
      expect(path).toContain("/wp/v2/presto-videos");
      expect(path).toContain("per_page=100");
      expect(path).toContain("page=1");
      expect(path).toContain("_embed=1");
      // Trash included so the Media Hub UI can show + filter trashed items.
      expect(path).toContain("trash");
    });

    it("stops paginating once a page returns fewer than perPage items", async () => {
      const fullPage = Array.from({ length: 100 }, (_, i) =>
        makePost({ id: i + 1 })
      );
      const partialPage = [makePost({ id: 101 })];
      apiFetch
        .mockResolvedValueOnce(fullPage)
        .mockResolvedValueOnce(partialPage);

      const { result, waitForNextUpdate } = renderHook(() => useMedia());
      await waitForNextUpdate();

      // 2 calls for /presto-videos, no tag fetch (no pp_video_tag on posts).
      expect(apiFetch).toHaveBeenCalledTimes(2);
      expect(apiFetch.mock.calls[0][0].path).toContain("page=1");
      expect(apiFetch.mock.calls[1][0].path).toContain("page=2");
      expect(result.current.media).toHaveLength(101);
    });

    it("treats a non-array response as the end of pagination", async () => {
      apiFetch.mockResolvedValueOnce({ unexpected: true });

      const { result, waitForNextUpdate } = renderHook(() => useMedia());
      await waitForNextUpdate();

      expect(apiFetch).toHaveBeenCalledTimes(1);
      expect(result.current.media).toEqual([]);
    });

    it("returns empty media + clears loading on fetch failure", async () => {
      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      apiFetch.mockRejectedValueOnce(new Error("network"));

      const { result, waitForNextUpdate } = renderHook(() => useMedia());
      await waitForNextUpdate();

      expect(result.current.media).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe("post → MediaItem transform", () => {
    const renderWithPost = async (post) => {
      apiFetch.mockResolvedValueOnce([post]);
      const hook = renderHook(() => useMedia());
      await hook.waitForNextUpdate();
      return hook.result.current.media[0];
    };

    it.each([
      ["uses post_title when present (custom post type shape)", { post_title: "Direct" }, "Direct"],
      ["falls back to title.rendered when no post_title", { title: { rendered: "Rendered" } }, "Rendered"],
      ["falls back to title.raw when only raw is present", { title: { raw: "Raw" } }, "Raw"],
      ["accepts title as a plain string", { title: "Plain" }, "Plain"],
    ])("title fallback: %s", async (_label, overrides, expected) => {
      const item = await renderWithPost(makePost(overrides));
      expect(item.title).toBe(expected);
    });

    it("falls back to `Media #<id>` when nothing yields a title", async () => {
      const item = await renderWithPost(
        makePost({ id: 99, title: undefined })
      );
      expect(item.title).toBe("Media #99");
    });

    it("decodes HTML entities in the title (REST returns them encoded)", async () => {
      const item = await renderWithPost(
        makePost({ title: { rendered: "Foo &amp; Bar &#039;baz&#039;" } })
      );
      expect(item.title).toBe("Foo & Bar 'baz'");
    });

    it("strips the WP `Protected: ` prefix that get_the_title() prepends", async () => {
      const item = await renderWithPost(
        makePost({ title: { rendered: "Protected: Members Only" } })
      );
      expect(item.title).toBe("Members Only");
    });

    it("strips the WP `Private: ` prefix that get_the_title() prepends", async () => {
      const item = await renderWithPost(
        makePost({ title: { rendered: "Private: Internal Tutorial" } })
      );
      expect(item.title).toBe("Internal Tutorial");
    });

    it.each([
      [
        "prefers details.poster over _embedded wp:featuredmedia",
        {
          details: { poster: "https://cdn/x.jpg" },
          _embedded: {
            "wp:featuredmedia": [{ source_url: "https://cdn/y.jpg" }],
          },
        },
        "https://cdn/x.jpg",
      ],
      [
        "falls back to wp:featuredmedia when details.poster is absent",
        {
          _embedded: {
            "wp:featuredmedia": [{ source_url: "https://cdn/y.jpg" }],
          },
        },
        "https://cdn/y.jpg",
      ],
    ])("poster fallback: %s", async (_label, overrides, expected) => {
      const item = await renderWithPost(makePost(overrides));
      expect(item.poster_image).toBe(expected);
    });

    it("uses embedded tags when present (no second-pass fetch needed)", async () => {
      apiFetch.mockResolvedValueOnce([
        makePost({
          id: 1,
          pp_video_tag: [10, 20],
          _embedded: {
            "https://api.w.org/term": [
              {
                pp_video_tag: [
                  { id: 10, name: "Demo", slug: "demo" },
                  { id: 20, name: "How To" },
                ],
              },
            ],
          },
        }),
      ]);

      const { result, waitForNextUpdate } = renderHook(() => useMedia());
      await waitForNextUpdate();

      // Only the posts call — no second tag-batch fetch.
      expect(apiFetch).toHaveBeenCalledTimes(1);
      expect(result.current.media[0].tags).toEqual([
        { id: 10, name: "Demo", slug: "demo" },
        // Slug derived from name: "How To" → "how-to".
        { id: 20, name: "How To", slug: "how-to" },
      ]);
    });

    it("batches a second-pass tag fetch when posts have tag IDs but no embedded tags", async () => {
      apiFetch
        .mockResolvedValueOnce([
          makePost({ id: 1, pp_video_tag: [10, 20] }),
          makePost({ id: 2, pp_video_tag: [20, 30] }),
        ])
        .mockResolvedValueOnce([
          { id: 10, name: "Demo", slug: "demo" },
          { id: 20, name: "How To", slug: "how-to" },
          { id: 30, name: "Tutorial", slug: "tutorial" },
        ]);

      const { result, waitForNextUpdate } = renderHook(() => useMedia());
      await waitForNextUpdate();

      // 2 calls: posts + tags batch.
      expect(apiFetch).toHaveBeenCalledTimes(2);
      const tagPath = apiFetch.mock.calls[1][0].path;
      expect(tagPath).toContain("/wp/v2/pp_video_tag");
      expect(tagPath).toContain("include=10%2C20%2C30"); // unique, urlencoded comma

      expect(result.current.media[0].tags).toHaveLength(2);
      expect(result.current.media[1].tags).toHaveLength(2);
    });
  });

  // Sort *application* now lives in MediaHub so filter+sort can run on the
  // smaller filtered set. The hook only owns sort state — these tests cover
  // the state transitions; comparator behavior is exercised by MediaHub.
  describe("sort state", () => {
    const seed = [
      makePost({ id: 1, title: "Banana", date: "2026-03-01T00:00:00" }),
    ];

    it("defaults to date desc", async () => {
      apiFetch.mockResolvedValueOnce(seed);
      const { result, waitForNextUpdate } = renderHook(() => useMedia());
      await waitForNextUpdate();

      expect(result.current.sortField).toBe("date");
      expect(result.current.sortOrder).toBe("desc");
    });

    it("toggles order when handleSort is called for the active field", async () => {
      apiFetch.mockResolvedValueOnce(seed);
      const { result, waitForNextUpdate } = renderHook(() => useMedia());
      await waitForNextUpdate();

      act(() => result.current.handleSort("date"));
      expect(result.current.sortOrder).toBe("asc");

      act(() => result.current.handleSort("date"));
      expect(result.current.sortOrder).toBe("desc");
    });

    it("switching to a non-date field resets order to asc", async () => {
      apiFetch.mockResolvedValueOnce(seed);
      const { result, waitForNextUpdate } = renderHook(() => useMedia());
      await waitForNextUpdate();

      act(() => result.current.handleSort("title"));
      expect(result.current.sortField).toBe("title");
      expect(result.current.sortOrder).toBe("asc");
    });

    it("switching back to date defaults to desc", async () => {
      apiFetch.mockResolvedValueOnce(seed);
      const { result, waitForNextUpdate } = renderHook(() => useMedia());
      await waitForNextUpdate();

      act(() => result.current.handleSort("title"));
      act(() => result.current.handleSort("date"));
      expect(result.current.sortField).toBe("date");
      expect(result.current.sortOrder).toBe("desc");
    });
  });
});
