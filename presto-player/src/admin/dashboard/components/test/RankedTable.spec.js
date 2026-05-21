import { render, screen, fireEvent } from "@testing-library/react";
import RankedTable from "../RankedTable";

const cols = [
  {
    key: "name",
    header: "Name",
    cellClassName: "name-cell",
    render: (r) => r.name,
  },
];

const makeRows = (n, offset = 0) =>
  Array.from({ length: n }, (_, i) => ({
    id: offset + i + 1,
    name: `row-${offset + i + 1}`,
  }));

const renderTable = (props = {}) =>
  render(
    <RankedTable
      title="Top"
      columns={cols}
      rows={props.rows ?? makeRows(10)}
      pagination={
        props.pagination === null
          ? undefined
          : {
              currentPage: 1,
              totalItems: 12,
              totalPages: 2,
              perPage: 10,
              onPageChange: jest.fn(),
              ...props.pagination,
            }
      }
      emptyState={props.emptyState}
      rowAction={props.rowAction}
      onRowClick={props.onRowClick}
    />
  );

describe("RankedTable", () => {
  it('hides the pagination footer when totalPages <= 1', () => {
    renderTable({
      rows: makeRows(3),
      pagination: { totalItems: 3, totalPages: 1 },
    });
    expect(screen.queryByText(/of \d+ items/i)).not.toBeInTheDocument();
  });

  it('displays "1–10 of 12 items" on the first page of a two-page set', () => {
    renderTable({
      rows: makeRows(10),
      pagination: { currentPage: 1, totalItems: 12, totalPages: 2, perPage: 10 },
    });
    expect(screen.getByText(/1\s*[–-]\s*10\s+of\s+12\s+items/i)).toBeInTheDocument();
  });

  it('displays "11–12 of 12 items" on the last (partial) page', () => {
    renderTable({
      rows: makeRows(2, 10),
      pagination: { currentPage: 2, totalItems: 12, totalPages: 2, perPage: 10 },
    });
    expect(screen.getByText(/11\s*[–-]\s*12\s+of\s+12\s+items/i)).toBeInTheDocument();
  });

  it("calls onPageChange with the clicked page number", () => {
    const onPageChange = jest.fn();
    renderTable({
      rows: makeRows(10),
      pagination: { currentPage: 1, totalItems: 12, totalPages: 2, perPage: 10, onPageChange },
    });
    fireEvent.click(screen.getByText("2"));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("renders the empty state when rows is empty", () => {
    const empty = <div data-testid="empty">No items</div>;
    renderTable({ rows: [], emptyState: empty });
    expect(screen.getByTestId("empty")).toBeInTheDocument();
    // No data rows when empty.
    expect(screen.queryAllByRole("row")).toHaveLength(0);
  });

  it("renders a trailing action cell when rowAction is provided", () => {
    renderTable({
      rows: makeRows(2),
      rowAction: (r) => <button type="button">action-{r.id}</button>,
    });
    expect(screen.getByRole("button", { name: "action-1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "action-2" })).toBeInTheDocument();
  });

  it("calls onRowClick with the row when a body row is clicked", () => {
    const onRowClick = jest.fn();
    renderTable({ rows: makeRows(3), onRowClick });
    const bodyRows = screen.getAllByRole("row").slice(1); // skip header
    fireEvent.click(bodyRows[1]);
    expect(onRowClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, name: "row-2" })
    );
  });

  describe("paginated windowing", () => {
    const renderPaged = (currentPage, totalPages) =>
      renderTable({
        rows: makeRows(5),
        pagination: {
          currentPage,
          totalItems: totalPages * 5,
          totalPages,
          perPage: 5,
          onPageChange: jest.fn(),
        },
      });

    const pageButtons = () =>
      Array.from(document.querySelectorAll('nav[role="navigation"] li'))
        .map((li) => li.textContent.trim())
        .filter((t) => /^\d+$/.test(t));

    it("renders every page button when totalPages <= 7", () => {
      renderPaged(3, 7);
      expect(pageButtons()).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
      // No ellipses needed below the threshold.
      expect(screen.queryByText("•••")).not.toBeInTheDocument();
    });

    it("shows only a right-side ellipsis when current page is near the start", () => {
      renderPaged(1, 17);
      // First 5 pages + ellipsis + last page.
      expect(pageButtons()).toEqual(["1", "2", "3", "4", "5", "17"]);
      expect(screen.getAllByText("•••")).toHaveLength(1);
    });

    it("shows ellipses on both sides when current page is in the middle", () => {
      renderPaged(11, 17);
      // First + ellipsis + (current±1) + ellipsis + last — the exact preview
      // shown in the AskUserQuestion: 1 ... 10 [11] 12 ... 17.
      expect(pageButtons()).toEqual(["1", "10", "11", "12", "17"]);
      expect(screen.getAllByText("•••")).toHaveLength(2);
    });

    it("shows only a left-side ellipsis when current page is near the end", () => {
      renderPaged(17, 17);
      expect(pageButtons()).toEqual(["1", "13", "14", "15", "16", "17"]);
      expect(screen.getAllByText("•••")).toHaveLength(1);
    });

    it("keeps the last page reachable on every page", () => {
      // Iterating across every page in a 17-page set, the last page button
      // must always be present so users can never get stuck mid-pager.
      for (let p = 1; p <= 17; p++) {
        const { unmount } = renderPaged(p, 17);
        expect(pageButtons()).toContain("17");
        unmount();
      }
    });
  });

});
