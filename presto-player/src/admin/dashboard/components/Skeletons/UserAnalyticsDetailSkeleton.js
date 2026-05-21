import { Skeleton, Container } from "@bsf/force-ui";

const StatCardSkeleton = () => (
  <div className="bg-background-primary border border-solid border-border-subtle rounded-xl shadow-sm p-5 flex flex-col gap-1">
    <div className="px-1 py-1">
      <Skeleton className="w-24 h-3.5 rounded-full" />
    </div>
    <div className="px-1 py-1">
      <Skeleton className="w-20 h-8 rounded-full" />
    </div>
  </div>
);

const TableRowSkeleton = () => (
  <div className="flex items-center gap-4 px-4 py-3 border-b border-border-subtle">
    <Skeleton className="flex-1 h-4 rounded-full" />
    <Skeleton className="w-16 h-4 rounded-full" />
    <Skeleton className="w-20 h-6 rounded-full" />
    <Skeleton className="w-24 h-6 rounded-full" />
  </div>
);

const UserAnalyticsDetailSkeleton = () => (
  <Container
    className="p-8 bg-background-secondary"
    direction="column"
    gap="md"
  >
    {/* Header: Back + Avatar + Name + Date Picker */}
    <div className="flex items-center gap-3">
      <Skeleton className="w-8 h-8 rounded-md shrink-0" />
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <Skeleton className="w-32 h-6 rounded-full" />
        <Skeleton className="w-48 h-3.5 rounded-full" />
      </div>
      <Skeleton className="w-60 h-8 rounded-sm shrink-0" />
    </div>

    {/* Stat Cards */}
    <div className="grid grid-cols-3 gap-5">
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>

    {/* Table */}
    <div className="bg-background-primary border border-solid border-border-subtle rounded-xl shadow-sm">
      <div className="px-3 py-3">
        <Skeleton className="w-24 h-5 rounded-full" />
      </div>
      <TableRowSkeleton />
      <TableRowSkeleton />
      <TableRowSkeleton />
    </div>
  </Container>
);

export default UserAnalyticsDetailSkeleton;
