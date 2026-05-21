import {
  transformMediaItem,
  transformUserItem,
} from "../transformers";

describe("transformers", () => {
  describe("transformMediaItem", () => {
    it("flattens the API shape into the component shape", () => {
      const item = {
        video: { id: 1, post_id: 100, title: "Hello" },
        stats: [{ data: "42 views" }, { data: "1m 30s" }],
        poster_image: "https://cdn/p.jpg",
      };
      expect(transformMediaItem(item)).toEqual({
        id: 1,
        postId: 100,
        title: "Hello",
        totalViews: "42",
        avgViewTime: "1m 30s",
        poster_image: "https://cdn/p.jpg",
      });
    });

    it("strips commas from view counts in stats[0].data", () => {
      const item = {
        video: { id: 2, post_id: 2, title: "A" },
        stats: [{ data: "1,234,567 views" }, { data: "0s" }],
      };
      expect(transformMediaItem(item).totalViews).toBe("1234567");
    });

    it("falls back to '0' views and '0s' avg when stats are missing", () => {
      const item = { video: { id: 3, post_id: 3, title: "A" } };
      const out = transformMediaItem(item);
      expect(out.totalViews).toBe("0");
      expect(out.avgViewTime).toBe("0s");
    });

    it("falls back to localized 'Untitled' when title is empty", () => {
      const out = transformMediaItem({
        video: { id: 4, post_id: 4, title: "" },
        stats: [],
      });
      expect(out.title).toBe("Untitled");
    });

    it("decodes HTML entities in the title", () => {
      const out = transformMediaItem({
        video: { id: 5, post_id: 5, title: "John&#039;s &amp; Co" },
        stats: [],
      });
      expect(out.title).toBe("John's & Co");
    });

    it("defaults postId to null when video.post_id is absent", () => {
      const out = transformMediaItem({
        video: { id: 6, title: "x" },
        stats: [],
      });
      expect(out.postId).toBeNull();
    });

    it("defaults poster_image to null when not provided", () => {
      const out = transformMediaItem({
        video: { id: 7, post_id: 7, title: "x" },
        stats: [],
      });
      expect(out.poster_image).toBeNull();
    });

    it("returns '0' totalViews when stats[0].data has no digits", () => {
      const item = {
        video: { id: 8, post_id: 8, title: "x" },
        stats: [{ data: "no number here" }, { data: "1s" }],
      };
      expect(transformMediaItem(item).totalViews).toBe("0");
    });
  });

  describe("transformUserItem", () => {
    it("flattens the API shape into the component shape", () => {
      const item = {
        user: { id: 11, name: "Ada Lovelace" },
        stats: [{ data: "9 views" }, { data: "30s" }],
      };
      expect(transformUserItem(item)).toEqual({
        id: 11,
        name: "Ada Lovelace",
        totalViews: "9",
        avgViewTime: "30s",
      });
    });

    it("falls back to localized 'Unknown User' when name is empty", () => {
      const out = transformUserItem({
        user: { id: 13, name: "" },
        stats: [],
      });
      expect(out.name).toBe("Unknown User");
    });

  });
});
