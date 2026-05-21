import { decodeHTMLEntities } from "./formatters";

const { __ } = wp.i18n;

/**
 * Transforms raw API video data into the flat shape expected by TopMedia component.
 * API returns: { video: { id, title, ... }, stats: [ { data: "X views" }, { data: "Xm Xs" } ] }
 * Component expects: { id, title, totalViews, avgViewTime }
 */
export const transformMediaItem = (item) => {
  const viewsData = item?.stats?.[0]?.data || "";
  const match = viewsData.match(/[\d,]+/);
  return {
    id: item?.video?.id,
    postId: item?.video?.post_id || null,
    title:
      decodeHTMLEntities(item?.video?.title) ||
      __("Untitled", "presto-player"),
    totalViews: match ? match[0].replace(/,/g, "") : "0",
    avgViewTime: item?.stats?.[1]?.data || "0s",
    poster_image: item?.poster_image || null,
  };
};

/**
 * Transforms raw API user data into the flat shape expected by TopUsers component.
 * API returns: { user: { id, name, ... }, stats: [ { data: "X views" }, { data: "Xm Xs" } ] }
 * Component expects: { id, name, totalViews, avgViewTime }
 */
export const transformUserItem = (item) => {
  const viewsData = item?.stats?.[0]?.data || "";
  const match = viewsData.match(/[\d,]+/);
  return {
    id: item?.user?.id,
    name:
      decodeHTMLEntities(item?.user?.name) ||
      __("Unknown User", "presto-player"),
    totalViews: match ? match[0].replace(/,/g, "") : "0",
    avgViewTime: item?.stats?.[1]?.data || "0s",
  };
};
