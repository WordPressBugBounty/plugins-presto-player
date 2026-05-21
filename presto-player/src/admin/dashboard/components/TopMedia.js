import { useState } from "@wordpress/element";
const { __ } = wp.i18n;
import { Button, Badge, Text } from "@bsf/force-ui";
import { ArrowRight } from "lucide-react";
import { useHistory } from "../router/router";
import iconWhiteSvg from "../../../../img/icon-white.svg";
import ChartEmptyState from "./ChartEmptyState";
import TruncatedTitle from "./TruncatedTitle";
import RankedTable from "./RankedTable";

const MediaThumbnail = ({ item }) => {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="flex items-center gap-3 min-w-0">
      {item?.poster_image && !imageError ? (
        <img
          src={item.poster_image}
          alt={item?.title || ""}
          className="flex-shrink-0 object-cover w-[75px] h-auto aspect-video rounded-[2px]"
          loading="lazy"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="flex-shrink-0 flex items-center justify-center w-[75px] aspect-video box-border bg-[#d1d5db] rounded-[2px]">
          <img
            src={iconWhiteSvg}
            alt=""
            width="20"
            height="auto"
            className="h-auto"
          />
        </div>
      )}
      <TruncatedTitle title={item.title} className="flex-1" />
    </div>
  );
};

/**
 * Top Media table with server-side pagination.
 *
 * @param {Object}   props
 * @param {Array}    props.media         Current page of media items.
 * @param {number}   props.currentPage   1-indexed page.
 * @param {number}   props.totalItems    Total items across pages.
 * @param {number}   props.totalPages    Total page count.
 * @param {number}   props.perPage       Items per page.
 * @param {Function} props.onPageChange  (page) => void.
 * @param {string}   [props.fromUserId]  Optional user id for back-navigation.
 */
const TopMedia = ({
  media = [],
  currentPage = 1,
  totalItems = 0,
  totalPages = 0,
  perPage = 10,
  onPageChange,
  fromUserId,
}) => {
  const history = useHistory();

  const goToDetail = (item) =>
    history.push({
      tab: "Analytics",
      detail: "media",
      id: String(item.id),
      ...(fromUserId ? { from_user: String(fromUserId) } : {}),
    });

  const columns = [
    {
      key: "title",
      header: __("Media", "presto-player"),
      headerClassName: "text-text-secondary font-medium py-2",
      cellClassName: "py-3",
      render: (item) => <MediaThumbnail item={item} />,
    },
    {
      key: "totalViews",
      header: __("Views", "presto-player"),
      headerClassName: "whitespace-nowrap text-text-secondary font-medium py-2",
      cellClassName: "whitespace-nowrap py-2",
      render: (item) => (
        <Text as="span" size="sm" className="text-text-secondary">
          {`${item.totalViews} ${__("views", "presto-player")}`}
        </Text>
      ),
    },
    {
      key: "avgViewTime",
      header: __("Avg View Time", "presto-player"),
      headerClassName: "whitespace-nowrap text-text-secondary font-medium py-2",
      cellClassName: "whitespace-nowrap py-2",
      render: (item) => (
        <Badge
          label={item.avgViewTime}
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
      title={__("Most Watched", "presto-player")}
      columns={columns}
      rows={media}
      rowKey={(item) => item.id}
      onRowClick={goToDetail}
      rowAction={(item) => (
        <Button
          variant="ghost"
          size="xs"
          className="text-brand-primary font-semibold"
          iconPosition="right"
          icon={<ArrowRight className="size-3" />}
          onClick={(e) => {
            e.stopPropagation();
            goToDetail(item);
          }}
        >
          {__("View Details", "presto-player")}
        </Button>
      )}
      pagination={{
        currentPage,
        totalItems: totalItems || media.length,
        totalPages: totalPages || Math.ceil((totalItems || media.length) / perPage),
        perPage,
        onPageChange,
      }}
      emptyState={
        <ChartEmptyState className="min-h-[180px] pb-6 px-1" proGated />
      }
    />
  );
};

export default TopMedia;
