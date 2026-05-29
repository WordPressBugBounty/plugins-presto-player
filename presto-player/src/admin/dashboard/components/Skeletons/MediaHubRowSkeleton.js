import React from "react";
import { Skeleton, Table } from "@bsf/force-ui";

/**
 * Single skeleton row mirroring the live MediaRow column layout
 * (Media, Status, Tags, Shortcode, Published on, Actions).
 *
 * Shared between the first-load page skeleton and the in-place
 * refetch skeleton so paging/filtering/sorting never falls back to
 * "stale rows with no feedback".
 */
const MediaHubRowSkeleton = () => {
  return (
    <Table.Row className="border-b border-border-subtle">
      {/* Media: poster thumbnail + title */}
      <Table.Cell className="text-left px-3 py-4" style={{ maxWidth: 0 }}>
        <div className="flex items-center gap-3">
          <Skeleton className="flex-shrink-0 rounded w-[75px] h-[42px]" />
          <Skeleton className="h-4 w-40 rounded-full flex-1" />
        </div>
      </Table.Cell>

      {/* Status badge */}
      <Table.Cell className="text-left px-3 py-4">
        <Skeleton className="h-5 w-16 rounded-full" />
      </Table.Cell>

      {/* Tags: a few badges */}
      <Table.Cell className="text-left px-3 py-4">
        <div className="flex flex-wrap gap-1">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      </Table.Cell>

      {/* Shortcode field + copy icon */}
      <Table.Cell className="whitespace-nowrap text-left px-3 py-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-40 rounded" />
          <Skeleton className="h-4 w-4 rounded" />
        </div>
      </Table.Cell>

      {/* Published date */}
      <Table.Cell className="text-left whitespace-nowrap px-3 py-4">
        <Skeleton className="h-4 w-28 rounded" />
      </Table.Cell>

      {/* Actions: 4 icon buttons */}
      <Table.Cell className="text-right px-3 py-4">
        <div className="flex items-center justify-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-5 w-5 rounded-full" />
        </div>
      </Table.Cell>
    </Table.Row>
  );
};

export default MediaHubRowSkeleton;
