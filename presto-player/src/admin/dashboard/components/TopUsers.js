const { __ } = wp.i18n;
import { Badge, Text } from "@bsf/force-ui";
import { useHistory } from "../router/router";
import ChartEmptyState from "./ChartEmptyState";
import TruncatedTitle from "./TruncatedTitle";
import RankedTable from "./RankedTable";

/**
 * Top Users table with server-side pagination.
 *
 * @param {Object}   props
 * @param {Array}    props.users         Current page of user items.
 * @param {number}   props.currentPage   1-indexed page.
 * @param {number}   props.totalItems    Total items across pages.
 * @param {number}   props.totalPages    Total page count.
 * @param {number}   props.perPage       Items per page.
 * @param {Function} props.onPageChange  (page) => void.
 */
const TopUsers = ({
  users = [],
  currentPage = 1,
  totalItems = 0,
  totalPages = 0,
  perPage = 5,
  onPageChange,
}) => {
  const history = useHistory();

  const goToDetail = (user) =>
    history.push({
      tab: "Analytics",
      detail: "user",
      id: String(user.id),
    });

  const columns = [
    {
      key: "name",
      header: __("Viewer", "presto-player"),
      headerClassName: "w-1/3 text-text-secondary font-medium py-2",
      cellClassName: "w-1/3 py-3",
      render: (user) => <TruncatedTitle title={user.name} />,
    },
    {
      key: "totalViews",
      header: __("Views", "presto-player"),
      headerClassName:
        "w-1/3 whitespace-nowrap text-text-secondary font-medium py-2",
      cellClassName: "w-1/3 whitespace-nowrap py-2",
      render: (user) => (
        <Text as="span" size="sm" className="text-text-secondary">
          {`${user.totalViews} ${__("views", "presto-player")}`}
        </Text>
      ),
    },
    {
      key: "avgViewTime",
      header: __("Avg View Time", "presto-player"),
      headerClassName:
        "w-1/3 whitespace-nowrap text-text-secondary font-medium py-2",
      cellClassName: "w-1/3 whitespace-nowrap py-2",
      render: (user) => (
        <Badge
          label={user.avgViewTime}
          type="rounded"
          size="sm"
          variant="neutral"
          className="border-0 bg-gray-100 w-fit"
        />
      ),
    },
  ];

  return (
    <RankedTable
      title={__("Most Engaged Viewers", "presto-player")}
      className="w-full"
      columns={columns}
      rows={users}
      rowKey={(user) => user.id}
      onRowClick={goToDetail}
      pagination={{
        currentPage,
        totalItems: totalItems || users.length,
        totalPages:
          totalPages || Math.ceil((totalItems || users.length) / perPage),
        perPage,
        onPageChange,
      }}
      emptyState={
        <ChartEmptyState className="min-h-[180px] pb-6 px-1" proGated />
      }
    />
  );
};

export default TopUsers;
