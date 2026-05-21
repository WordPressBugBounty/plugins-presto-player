import React from "react";
import { Skeleton, Container, Table } from "@bsf/force-ui";

const MediaHubPageSkeleton = () => {
  return (
    <Container
      className="p-8"
      gap="md"
      direction="column"
    >
      {/* Page Header Section */}
      <Container className="w-full flex items-center justify-between">
        {/* Title: "Media Hub" */}
        <Container.Item grow={1}>
          <Skeleton className="h-6 w-36 rounded-full" />
        </Container.Item>
        {/* Header Actions: Filter Icon + Search Bar */}
        <Container.Item className="flex items-center gap-3">
          {/* Filter Icon (ListFilter) */}
          <Skeleton variant="circular" className="w-6 h-6" />
          {/* Search Bar */}
          <Skeleton className="h-8 w-64 rounded" />
        </Container.Item>
      </Container>

      {/* Table Section */}
      <Container gap="md" direction="column">
        <div className="gap-0">
          <Table>
            {/* Table Header Row */}
            <Table.Head className="bg-background-primary items-center">
              {/* Checkbox Column Header */}
              <Table.HeadCell className="w-10 px-3 py-3">
                <Skeleton className="h-4 w-4 rounded" />
              </Table.HeadCell>

              {/* Title Column Header (with sort icon) */}
              <Table.HeadCell className="cursor-pointer items-center gap-2 text-text-secondary">
                <div className="flex items-center gap-2">
                  {/* "Title" text */}
                  <Skeleton className="h-4 w-16 rounded" />
                  {/* Sort icon (ChevronsUpDown) */}
                  <Skeleton className="h-3.5 w-3.5 rounded" />
                </div>
              </Table.HeadCell>

              {/* Tags Column Header */}
              <Table.HeadCell className="text-text-secondary items-center">
                {/* "Tags" text */}
                <Skeleton className="h-4 w-12 rounded" />
              </Table.HeadCell>

              {/* Shortcode Column Header */}
              <Table.HeadCell className="text-text-secondary items-center">
                {/* "Shortcode" text */}
                <Skeleton className="h-4 w-20 rounded" />
              </Table.HeadCell>

              {/* Published on Column Header (with sort icon) */}
              <Table.HeadCell className="cursor-pointer items-center gap-2 text-text-secondary">
                <div className="flex items-center gap-2">
                  {/* "Published on" text */}
                  <Skeleton className="h-4 w-24 rounded" />
                  {/* Sort icon (ChevronsUpDown) */}
                  <Skeleton className="h-3.5 w-3.5 rounded" />
                </div>
              </Table.HeadCell>

              {/* Actions Column Header */}
              <Table.HeadCell className="items-center justify-center">
                <span className="sr-only">Actions</span>
              </Table.HeadCell>
            </Table.Head>

            {/* Table Body Rows */}
            <Table.Body>
              {Array.from({ length: 10 }).map((_, idx) => (
                <Table.Row key={idx} className="border-b border-border-subtle">
                  {/* Checkbox Cell */}
                  <Table.Cell className="w-10 px-3 py-4">
                    <Skeleton className="h-4 w-4 rounded" />
                  </Table.Cell>

                  {/* Title Cell: Poster Image + Media Title */}
                  <Table.Cell className="min-w-[300px] text-left px-3 py-4">
                    <div className="flex items-center gap-3">
                      {/* Poster Image (75px × ~42px to match 16:9 thumbnail). Force UI's
                       * Skeleton ships with a default `h-3`, which beats `aspect-video`
                       * unless we set an explicit height. */}
                      <Skeleton
                        className="flex-shrink-0 rounded w-[75px] h-[42px]"
                      />
                      {/* Media Title */}
                      <Skeleton className="h-4 w-40 rounded-full flex-1" />
                    </div>
                  </Table.Cell>

                  {/* Tags Cell: Multiple Tag Badges */}
                  <Table.Cell className="w-[240px] text-left px-3 py-4">
                    <div className="flex flex-wrap gap-1">
                      {/* Tag Badge 1 */}
                      <Skeleton className="h-6 w-16 rounded-full" />
                      {/* Tag Badge 2 */}
                      <Skeleton className="h-6 w-20 rounded-full" />
                      {/* Tag Badge 3 */}
                      <Skeleton className="h-6 w-14 rounded-full" />
                    </div>
                  </Table.Cell>

                  {/* Shortcode Cell: Input Field + Copy Button */}
                  <Table.Cell className="w-[1%] whitespace-nowrap text-left px-3 py-4">
                    <div className="flex items-center gap-2">
                      {/* Shortcode Input Field */}
                      <Skeleton className="h-7 w-40 rounded" />
                      {/* Copy Button */}
                      <Skeleton className="h-4 w-4 rounded" />
                    </div>
                  </Table.Cell>

                  {/* Published Date Cell */}
                  <Table.Cell className="w-[170px] text-left px-3 py-4">
                    {/* Published Date Text */}
                    <Skeleton className="h-4 w-28 rounded" />
                  </Table.Cell>

                  {/* Actions Cell: View, Edit, Settings, More Options Buttons */}
                  <Table.Cell className="w-[130px] text-right px-3 py-4">
                    <div className="flex items-center justify-center gap-2">
                      {/* View Button (Eye icon) */}
                      <Skeleton className="h-5 w-5 rounded-full" />
                      {/* Edit Button (PencilLine icon) */}
                      <Skeleton className="h-5 w-5 rounded-full" />
                      {/* Settings Button (Settings icon) */}
                      <Skeleton className="h-5 w-5 rounded-full" />
                      {/* More Options Button (Ellipsis icon) */}
                      <Skeleton className="h-5 w-5 rounded-full" />
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      </Container>
    </Container>
  );
};

export default MediaHubPageSkeleton;
