const { __ } = wp.i18n;
import { Container, Table, Pagination, Text } from "@bsf/force-ui";

/**
 * Build the page list for the pager — first/last pinned, current ± siblings,
 * ellipses for gaps. Bounded output keeps the pager inside the card on every
 * page so the last page stays reachable however many pages there are.
 *
 * Returns at most `boundary*2 + siblings*2 + 3` entries (default = 7).
 */
const buildPagerWindow = (currentPage, totalPages, siblings = 1, boundary = 1) => {
  const totalSlots = boundary * 2 + siblings * 2 + 3;
  if (totalPages <= totalSlots) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(currentPage - siblings, boundary + 1);
  const rightSibling = Math.min(currentPage + siblings, totalPages - boundary);
  const showLeftEllipsis = leftSibling > boundary + 2;
  const showRightEllipsis = rightSibling < totalPages - boundary - 1;

  const range = (start, end) =>
    Array.from({ length: end - start + 1 }, (_, i) => start + i);

  const head = range(1, boundary);
  const tail = range(totalPages - boundary + 1, totalPages);

  if (!showLeftEllipsis && showRightEllipsis) {
    return [...range(1, boundary + siblings * 2 + 2), "ellipsis-right", ...tail];
  }
  if (showLeftEllipsis && !showRightEllipsis) {
    return [
      ...head,
      "ellipsis-left",
      ...range(totalPages - boundary - siblings * 2 - 1, totalPages),
    ];
  }
  return [
    ...head,
    "ellipsis-left",
    ...range(leftSibling, rightSibling),
    "ellipsis-right",
    ...tail,
  ];
};

/**
 * Card + table + pagination chrome shared by Analytics ranked-list widgets
 * (Top Media, Top Users, etc.).
 *
 * The shared component owns ONLY the chrome: card wrapper, header, table
 * layout, and the pagination footer ("X–Y of N items" + numbered page
 * buttons). Per-row content is supplied by `columns`; an optional trailing
 * action cell is supplied by `rowAction`. Pagination is fully controlled
 * — pass the metadata + `onPageChange` callback from the parent's data
 * hook (server-side pagination) and the footer wires itself up.
 *
 * @param {Object}    props
 * @param {string}    props.title                    Card header text.
 * @param {Array}     props.columns                  Column definitions:
 *   { key, header, headerClassName?, cellClassName?, render(row) }
 * @param {Array}     props.rows                     Current page of rows.
 * @param {Function}  [props.rowKey]                 (row) => key. Falls back to row.id.
 * @param {Function}  [props.onRowClick]             (row) => void. Makes the row clickable.
 * @param {Function}  [props.rowAction]              (row) => ReactNode. Renders trailing action cell.
 * @param {Object}    [props.pagination]             { currentPage, totalItems, totalPages, perPage, onPageChange }.
 *                                                   When omitted, no footer renders.
 * @param {ReactNode} [props.emptyState]             Rendered when `rows` is empty.
 * @param {string}    [props.className]              Extra classes applied to the outer card Container.
 */
const RankedTable = ({
  title,
  columns = [],
  rows = [],
  rowKey,
  onRowClick,
  rowAction,
  pagination,
  emptyState = null,
  className = "",
}) => {
  const hasPagination = Boolean(pagination);
  const total = pagination?.totalItems ?? rows.length;
  const totalPages = pagination?.totalPages ?? 0;
  const currentPage = pagination?.currentPage ?? 1;
  const perPage = pagination?.perPage ?? rows.length;
  const startIndex = hasPagination ? (currentPage - 1) * perPage : 0;
  const endIndex = hasPagination
    ? Math.min(startIndex + rows.length, total)
    : rows.length;

  const goToPage = (page) => {
    pagination?.onPageChange?.(page);
  };

  const renderPaginationItems = () => {
    if (totalPages <= 1) return null;

    const items = buildPagerWindow(currentPage, totalPages).map((entry) =>
      typeof entry === "number" ? (
        <Pagination.Item
          key={entry}
          isActive={entry === currentPage}
          onClick={() => goToPage(entry)}
        >
          {entry}
        </Pagination.Item>
      ) : (
        <Pagination.Ellipsis key={entry} />
      )
    );

    return (
      <>
        <Pagination.Previous
          onClick={() => goToPage(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1}
        />
        {items}
        <Pagination.Next
          onClick={() => goToPage(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage === totalPages}
        />
      </>
    );
  };

  const cardClasses = [
    "overflow-hidden border-0.5 border-solid border-border-subtle rounded-xl shadow-sm bg-background-primary",
    "h-full w-full",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const getKey = (row, idx) => {
    if (rowKey) return rowKey(row);
    return row?.id ?? idx;
  };

  return (
    <Container direction="column" gap="none" className={cardClasses}>
      <Container align="center" gap="xs" className="px-3 py-3">
        <Text className="text-base font-semibold text-text-primary">
          {title}
        </Text>
      </Container>

      {rows.length === 0 ? (
        emptyState
      ) : (
        <>
          <div className="[&>div]:rounded-none [&>div]:border-b-0">
            <Table className="shadow-none border-0 rounded-none">
              <Table.Head className="bg-background-primary border-b-0.5">
                {columns.map((col, idx) => (
                  <Table.HeadCell
                    key={col.key ?? idx}
                    className={col.headerClassName}
                  >
                    {col.header}
                  </Table.HeadCell>
                ))}
                {rowAction ? <Table.HeadCell className="py-2" /> : null}
              </Table.Head>

              <Table.Body>
                {rows.map((row, idx) => (
                  <Table.Row
                    key={getKey(row, idx)}
                    className={
                      onRowClick
                        ? "cursor-pointer hover:bg-background-secondary"
                        : undefined
                    }
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((col, colIdx) => (
                      <Table.Cell
                        key={col.key ?? colIdx}
                        className={col.cellClassName}
                      >
                        {col.render(row)}
                      </Table.Cell>
                    ))}
                    {rowAction ? (
                      <Table.Cell className="whitespace-nowrap py-2">
                        {rowAction(row)}
                      </Table.Cell>
                    ) : null}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>

          {hasPagination && totalPages > 1 ? (
            <div className="bg-background-primary px-4 py-3 border-t-[0.5px] border-x-0 border-b-0 border-solid border-border-subtle">
              <Container align="center" justify="between" className="w-full">
                <Text
                  size="sm"
                  weight="regular"
                  className="text-text-secondary"
                >
                  {`${startIndex + 1}–${endIndex} ${__(
                    "of",
                    "presto-player"
                  )} ${total} ${__("items", "presto-player")}`}
                </Text>
                <Pagination className="w-fit [&_li]:!my-0">
                  <Pagination.Content>
                    {renderPaginationItems()}
                  </Pagination.Content>
                </Pagination>
              </Container>
            </div>
          ) : null}
        </>
      )}
    </Container>
  );
};

export default RankedTable;
