import React, { useState } from "react";
const { __ } = wp.i18n;
import { Label, Container, Select, Text } from "@bsf/force-ui";
import ChartEmptyState from "./ChartEmptyState";
import Link from "./Link";
import TruncatedTitle from "./TruncatedTitle";
import { useLocation } from "../router/router";

/**
 * Top Performing widget showing top media or top users in a table.
 * Pure presentational — data must be passed via the `data` prop.
 */
const TopPerformingMedia = ({ data }) => {
  const location = useLocation();
  const fromTab = location.params?.tab || "Dashboard";

  const topMedia = data?.topMedia || [];
  const topUsers = data?.topUsers || [];

  const [selectedId, setSelectedId] = useState("media");

  const options = [
    {
      id: "media",
      label: __("Most Watched", "presto-player"),
      data: topMedia,
      countLabel: __("Views", "presto-player"),
    },
    {
      id: "users",
      label: __("Most Engaged Viewers", "presto-player"),
      data: topUsers,
      countLabel: __("Views", "presto-player"),
    },
  ];

  const selectedOption =
    options.find((opt) => opt.id === selectedId) || options[0];

  // Transformed data shape: media = { id, title, totalViews, avgViewTime }
  // Transformed data shape: users = { id, name, totalViews, avgViewTime }
  const getTitle = (item) => {
    if (selectedId === "media") {
      return item?.title || __("Untitled", "presto-player");
    }
    return item?.name || __("Unknown User", "presto-player");
  };

  return (
    <div className="h-auto p-4 flex flex-col gap-3 border-[0.5px] border-border-subtle border-solid shadow-sm bg-background-primary rounded-xl">
      {/* Header with inline Select */}
      <div className="flex items-center justify-between gap-4">
        <Label className="font-semibold">
          {__("What's Performing", "presto-player")}
        </Label>
        <div className="min-w-[180px]">
          <Select
            size="sm"
            value={selectedOption}
            onChange={(option) => setSelectedId(option.id)}
            by="id"
          >
            <Select.Button label="" render={(value) => value?.label || ""} />
            <Select.Options>
              {options.map((option) => (
                <Select.Option key={option.id} value={option}>
                  {option.label}
                </Select.Option>
              ))}
            </Select.Options>
          </Select>
        </div>
      </div>

      {/* Content */}
      {selectedOption?.data?.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-solid border-border-subtle">
          {/* Header */}
          <div className="flex items-center bg-background-secondary px-3 py-2">
            <span className="flex-1 text-sm font-medium text-text-secondary">
              {selectedId === "media"
                ? __("Media", "presto-player")
                : __("Viewer", "presto-player")}
            </span>
            <span className="w-10 text-right text-sm font-medium text-text-secondary">
              {selectedOption.countLabel}
            </span>
          </div>

          {/* Rows */}
          {selectedOption.data.map((item, index) => {
            const title = getTitle(item);
            const hasLink = !!item?.id;

            return (
              <div
                key={item?.id || index}
                className="flex items-center px-3 py-3 border-t border-solid border-border-subtle border-b-0 border-x-0"
              >
                <div className="flex-1 min-w-0">
                  {hasLink ? (
                    <Link
                      params={{
                        page: "presto-dashboard",
                        tab: "Analytics",
                        detail: selectedId === "media" ? "media" : "user",
                        id: String(item.id),
                        from: fromTab,
                      }}
                    >
                      <a className="cursor-pointer no-underline hover:no-underline block min-w-0">
                        <TruncatedTitle title={title} />
                      </a>
                    </Link>
                  ) : (
                    <TruncatedTitle title={title} />
                  )}
                </div>
                <div className="w-10 text-right shrink-0 whitespace-nowrap">
                  <Text as="span" size="sm" className="text-text-secondary">
                    {item?.totalViews || "0"}
                  </Text>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <ChartEmptyState className="min-h-[112px] pt-6 pb-8" proGated />
      )}
    </div>
  );
};

export default TopPerformingMedia;
