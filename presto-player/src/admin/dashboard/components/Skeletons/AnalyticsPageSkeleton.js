import { Skeleton, Container, Table } from "@bsf/force-ui";

const AnalyticsPageSkeleton = () => {
  return (
    <Container
      className="p-8"
      gap="md"
      direction="column"
    >
      {/* Title */}
      <Container className="w-full">
        <Container.Item grow={1}>
          <Skeleton className="w-24 h-6 rounded-full" />
        </Container.Item>
      </Container>

      {/* Analytics Overview Chart + Top Users side by side */}
      <div className="flex flex-col md:flex-row gap-5 items-stretch">
        {/* Left: AnalyticsOverview skeleton */}
        <div className="flex-1 min-w-0 flex">
          <Container
            containerType="flex"
            direction="column"
            gap="xs"
            className="w-full max-w-full min-w-0 overflow-hidden p-4 border-0.5 border-solid rounded-xl shadow-sm bg-background-primary border-border-subtle box-border"
          >
            {/* Top bar: unified tabs pill + date picker */}
            <Container.Item className="flex items-center justify-between w-full p-1">
              <Skeleton className="w-[150px] h-[30px] rounded-full" />
              <Skeleton className="w-[220px] h-[36px] rounded-sm" />
            </Container.Item>

            {/* KPI row — single block, no dot/label specifics */}
            <div className="px-2 py-2">
              <Skeleton className="w-[120px] h-[32px] rounded" />
            </div>

            {/* Chart area — single Skeleton matches EngagementAreaChart's min-height to avoid layout shift on load */}
            <div className="w-full flex flex-col flex-1 p-3 overflow-hidden bg-background-primary rounded-md shadow-sm">
              <Skeleton className="w-full h-full min-h-[248px] min-[1427px]:min-h-[228px] rounded" />
            </div>
          </Container>
        </div>

        {/* Right: TopUsers skeleton */}
        <div className="md:w-1/3 shrink-0 flex">
          <Container
            direction="column"
            gap="none"
            className="w-full border border-solid border-border-subtle rounded-xl shadow-sm bg-background-primary"
          >
            {/* Header */}
            <Container align="center" gap="xs" className="px-3 py-3">
              <Skeleton className="w-24 h-4 rounded-full" />
            </Container>

            {/* Table */}
            <div className="[&>div]:rounded-none">
              <Table className="shadow-none border-0 rounded-none">
                <Table.Head className="bg-background-primary border-b-0.5">
                  <Table.HeadCell className="w-1/3 py-2">
                    <Skeleton className="w-[50px] h-[14px] rounded" />
                  </Table.HeadCell>
                  <Table.HeadCell className="w-1/3 py-2">
                    <Skeleton className="w-[70px] h-[14px] rounded" />
                  </Table.HeadCell>
                  <Table.HeadCell className="w-1/3 py-2">
                    <Skeleton className="w-[80px] h-[14px] rounded" />
                  </Table.HeadCell>
                </Table.Head>
                <Table.Body>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Table.Row key={i} className="border-b border-border-subtle">
                      <Table.Cell className="w-1/3 py-3">
                        <Skeleton className="w-full h-[14px] rounded" />
                      </Table.Cell>
                      <Table.Cell className="w-1/3 py-2">
                        <Skeleton className="w-[60px] h-[14px] rounded" />
                      </Table.Cell>
                      <Table.Cell className="w-1/3 py-2">
                        <Skeleton className="w-[50px] h-[20px] rounded-full" />
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          </Container>
        </div>
      </div>

      {/* Bottom: TopMedia skeleton */}
      <Container
        direction="column"
        gap="none"
        className="w-full border border-solid border-border-subtle rounded-xl shadow-sm bg-background-primary"
      >
        {/* Header */}
        <Container align="center" gap="xs" className="px-3 py-3">
          <Skeleton className="w-24 h-4 rounded-full" />
        </Container>

        {/* Table */}
        <div className="[&>div]:rounded-none">
          <Table className="shadow-none border-0 rounded-none">
            <Table.Head className="bg-background-primary border-b-0.5">
              <Table.HeadCell className="py-2">
                <Skeleton className="w-[50px] h-[14px] rounded" />
              </Table.HeadCell>
              <Table.HeadCell className="py-2">
                <Skeleton className="w-[70px] h-[14px] rounded" />
              </Table.HeadCell>
              <Table.HeadCell className="py-2">
                <Skeleton className="w-[80px] h-[14px] rounded" />
              </Table.HeadCell>
              <Table.HeadCell className="py-2" />
            </Table.Head>
            <Table.Body>
              {[1, 2, 3, 4, 5].map((i) => (
                <Table.Row key={i} className="border-b border-border-subtle">
                  <Table.Cell className="py-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-[80px] h-[45px] rounded-md shrink-0" />
                      <Skeleton className="flex-1 min-w-0 h-[14px] rounded" />
                    </div>
                  </Table.Cell>
                  <Table.Cell className="py-2">
                    <Skeleton className="w-[60px] h-[14px] rounded" />
                  </Table.Cell>
                  <Table.Cell className="py-2">
                    <Skeleton className="w-[50px] h-[20px] rounded-full" />
                  </Table.Cell>
                  <Table.Cell className="py-2">
                    <Skeleton className="w-[90px] h-[28px] rounded" />
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

export default AnalyticsPageSkeleton;
