import { Skeleton, Container } from "@bsf/force-ui";

const StatCardSkeleton = ({ hasChart = false }) => (
  <div
    className={`bg-background-primary border border-solid border-border-subtle rounded-xl shadow-sm p-5 flex flex-col gap-1 ${
      hasChart ? "flex-1 min-h-0" : ""
    }`}
  >
    <div className="px-1 py-1">
      <Skeleton className="w-24 h-3.5 rounded-full" />
    </div>
    {hasChart ? (
      <div className="px-1 py-1 flex-1 min-h-0">
        <Skeleton className="!w-full !h-full min-h-[140px] rounded-md" />
      </div>
    ) : (
      <div className="px-1 py-1">
        <Skeleton className="w-20 h-8 rounded-full" />
      </div>
    )}
  </div>
);

const AnalyticsDetailSkeleton = () => (
  <Container
    className="p-8 bg-background-secondary"
    direction="column"
    gap="2xl"
  >
    {/* Header: Back + Title + Edit + Date Picker */}
    <div className="flex items-center gap-3">
      <Skeleton className="w-8 h-8 rounded-md shrink-0" />
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Skeleton className="w-96 h-7 rounded-full" />
        <Skeleton className="w-8 h-8 rounded-md shrink-0" />
      </div>
      <Skeleton className="w-60 h-8 rounded-sm shrink-0" />
    </div>

    {/* Main Content: Video + Stats */}
    <div className="flex gap-6 items-stretch">
      {/* Left: Video Player */}
      <div className="flex-1 min-w-0">
        <div className="w-full aspect-video rounded-xl overflow-hidden">
          <Skeleton className="!w-full !h-full rounded-xl" />
        </div>
      </div>

      {/* Right: Stat Cards */}
      <div className="w-[500px] shrink-0 flex flex-col gap-6">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton hasChart />
      </div>
    </div>
  </Container>
);

export default AnalyticsDetailSkeleton;
