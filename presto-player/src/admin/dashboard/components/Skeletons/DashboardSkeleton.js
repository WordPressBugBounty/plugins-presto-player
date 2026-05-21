import { Skeleton, Container, Table } from "@bsf/force-ui";

const DashboardSkeleton = () => {
  return (
    <Container
      className="p-8"
      gap="md"
      direction="column"
    >
      {/* Main Content Section */}
      <Container gap="md" direction={{ sm: "column", md: "row" }}>
        {/* Left Column */}
        <div className="relative flex flex-col gap-6 flex-1 min-w-0">
          {/* WelcomeBanner Skeleton */}
          <Container
            className="p-4 border border-solid border-border-subtle bg-background-primary rounded-xl shadow-soft-shadow overflow-clip"
            direction={{ sm: "column", md: "row" }}
            gap="lg"
            align="center"
          >
            <Container.Item className="md:w-[60%] lg:w-[70%]">
              <div className="flex flex-col gap-4 px-4 py-2">
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="w-[200px] h-[28px] rounded-md" />
                  <Skeleton className="w-[160px] h-[28px] rounded-md" />
                  <Skeleton className="w-full max-w-[380px] h-[14px] rounded-full mt-2" />
                  <Skeleton className="w-full max-w-[340px] h-[14px] rounded-full" />
                  <Skeleton className="w-full max-w-[300px] h-[14px] rounded-full" />
                </div>
                <div className="flex gap-3">
                  <Skeleton className="w-[140px] h-[40px] rounded-md" />
                  <Skeleton className="w-[110px] h-[40px] rounded-md" />
                </div>
              </div>
            </Container.Item>
            <Container.Item className="shrink-0 w-full md:w-[360px] p-2">
              <div className="w-full aspect-video rounded-lg bg-gray-200 animate-pulse" />
            </Container.Item>
          </Container>

          {/* EngagementChart Skeleton — matches Chart + [AreaChart | Summary] layout */}
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

            {/* Chart area + summary stat cards — matches Container.Item bg-background-secondary wrapper */}
            <Container.Item className="w-full flex items-stretch justify-between gap-1 bg-background-secondary rounded-lg p-1">
              {/* Chart — single Skeleton matches EngagementAreaChart's min-height to avoid layout shift on load */}
              <div className="flex-1 flex flex-col p-3 bg-background-primary rounded-md shadow-sm overflow-hidden">
                <Skeleton className="w-full h-full min-h-[248px] min-[1427px]:min-h-[228px] rounded" />
              </div>

              {/* Summary — matches ChartSummary (w-[30%]) + two StatCards */}
              <div className="w-[30%] flex flex-col gap-1">
                <div className="flex-1 flex flex-col items-start justify-center p-3 text-left rounded-md shadow-sm bg-background-primary">
                  <div className="flex items-center mb-1">
                    <Skeleton className="w-3 h-3 rounded" />
                    <Skeleton className="w-[40px] h-[10px] rounded-full ml-1" />
                  </div>
                  <Skeleton className="w-[60px] h-[44px] rounded mt-3" />
                </div>
                <div className="flex-1 flex flex-col items-start justify-center p-3 text-left rounded-md shadow-sm bg-background-primary">
                  <div className="flex items-center mb-1">
                    <Skeleton className="w-3 h-3 rounded" />
                    <Skeleton className="w-[80px] h-[10px] rounded-full ml-1" />
                  </div>
                  <Skeleton className="w-[50px] h-[44px] rounded mt-3" />
                </div>
              </div>
            </Container.Item>
          </Container>

          {/* ExtendPlugins (inline layout) Skeleton */}
          <div className="h-auto shadow-sm bg-background-primary rounded-xl">
            <Container
              containerType="flex"
              gap="xs"
              direction="column"
              className="p-3 border-solid rounded-xl border-border-subtle border-0.5 gap-1"
            >
              <Container.Item className="md:w-full lg:w-full">
                <Container className="p-1" justify="between" gap="xs" align="center">
                  <Container.Item>
                    <Skeleton className="w-[170px] h-[16px] rounded-full" />
                  </Container.Item>
                </Container>
              </Container.Item>
              <Container.Item className="rounded-lg md:w-full lg:w-full bg-field-primary-background">
                <Container
                  containerType="flex"
                  direction="row"
                  className="gap-1.5 p-1"
                >
                  {[1, 2, 3, 4].map((_, index) => (
                    <Container.Item key={index} className="flex flex-1">
                      <Container
                        containerType="flex"
                        direction="column"
                        className="w-full min-h-[110px] gap-1 p-1.5 rounded-md shadow-soft-shadow-inner bg-background-primary"
                      >
                        <Container.Item>
                          <Container className="items-center gap-1 p-0.5">
                            <Container.Item className="flex" grow={0} shrink={0}>
                              <Skeleton variant="circular" className="w-4 h-4" />
                            </Container.Item>
                            <Container.Item className="flex">
                              <Skeleton className="w-16 h-3 rounded-full" />
                            </Container.Item>
                          </Container>
                        </Container.Item>
                        <Container.Item className="gap-0.5 px-0.5">
                          <Skeleton className="w-full max-w-[140px] h-3 rounded-full" />
                          <Skeleton className="w-20 h-3 mt-1 rounded-full" />
                        </Container.Item>
                        <Container.Item className="gap-0.5 px-0.5 pt-1 mt-auto">
                          <Skeleton className="w-24 h-7 rounded-md" />
                        </Container.Item>
                      </Container>
                    </Container.Item>
                  ))}
                </Container>
              </Container.Item>
            </Container>
          </div>
        </div>

        {/* Right Column */}
        <div className="max-w-[100%] w-full md:max-w-[33%] flex flex-col gap-7">
          {/* TopPerformingMedia Skeleton */}
          <div className="h-auto p-4 flex flex-col gap-3 border-[0.5px] border-border-subtle border-solid shadow-sm bg-background-primary rounded-xl">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="w-[130px] h-[16px] rounded-full" />
              <div className="min-w-[180px]">
                <Skeleton className="w-full h-[32px] rounded-md" />
              </div>
            </div>
            <div className="overflow-hidden">
              <Table className="bg-background-primary">
                <Table.Head className="bg-background-secondary w-full">
                  <Table.HeadCell className="px-3 py-2">
                    <Skeleton className="w-[80px] h-[14px] rounded" />
                  </Table.HeadCell>
                  <Table.HeadCell className="px-3 py-2 text-right w-32">
                    <Skeleton className="w-[40px] h-[14px] rounded ml-auto" />
                  </Table.HeadCell>
                </Table.Head>
                <Table.Body>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Table.Row key={i} className="border-b border-border-subtle">
                      <Table.Cell className="px-3 py-3">
                        <Skeleton className="w-full h-[14px] rounded" />
                      </Table.Cell>
                      <Table.Cell className="px-3 py-3 text-right">
                        <Skeleton className="w-[24px] h-[14px] rounded ml-auto" />
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          </div>

          {/* QuickAccess Skeleton */}
          <div className="w-full h-auto bg-background-primary rounded-xl">
            <Container
              containerType="flex"
              direction="column"
              className="p-3 border-0.5 border-solid rounded-xl shadow-sm border-border-subtle"
              gap="xs"
            >
              <Container.Item className="p-1 md:w-full lg:w-full">
                <Skeleton className="w-[90px] h-[16px] rounded-full" />
              </Container.Item>
              <Container.Item className="flex flex-col gap-1 p-1 rounded-lg md:w-full lg:w-full bg-field-primary-background">
                {["w-[72px]", "w-[120px]", "w-[108px]"].map((width, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1 p-2 rounded-md bg-background-primary shadow-soft-shadow-inner"
                  >
                    <Container
                      containerType="flex"
                      direction="row"
                      className="items-center gap-1 p-1"
                      align="center"
                    >
                      <Container.Item className="flex items-center justify-center">
                        <Skeleton variant="circular" className="w-4 h-4" />
                      </Container.Item>
                      <Container.Item className="flex items-center">
                        <Skeleton className={`${width} h-3 rounded-full`} />
                      </Container.Item>
                    </Container>
                  </div>
                ))}
              </Container.Item>
            </Container>
          </div>
        </div>
      </Container>
    </Container>
  );
};

export default DashboardSkeleton;
