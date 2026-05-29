import React, { useState } from "react";
import { __ } from "@wordpress/i18n";
import { addQueryArgs } from "@wordpress/url";
import {
  Tooltip,
  Button,
  DropdownMenu,
  Table,
  Badge,
  Text,
} from "@bsf/force-ui";
import { Eye, PencilLine, Ellipsis, Copy, Check, Settings } from "lucide-react";
import { decodeHTMLEntities } from "../../utils";
import { getViewportBoundary } from "../../utils/viewportBoundary";
import iconWhiteSvg from "../../../../../img/icon-white.svg";

// Statuses for which the front-end permalink would 404 (or worse — leak the
// slug). For these we either redirect via the WP preview URL or hide the
// View button entirely (trash).
const PREVIEW_STATUSES = ["draft", "pending", "future", "private"];

// Resolve the View button target for a given row, accounting for the post
// status. Returns null when there's no meaningful front-end URL (trash).
const resolveViewUrl = (item) => {
  const status = item?.status;
  if (status === "trash") {
    return null;
  }
  const baseUrl = item?.link || `?p=${item?.id}`;
  if (PREVIEW_STATUSES.includes(status)) {
    return addQueryArgs(baseUrl, { preview: "true" });
  }
  return baseUrl;
};

const MediaRow = ({
  item,
  selected,
  onChangeSelection,
  onEditClick,
  renderActionMenu,
  getBadge,
  formatPublishDate,
  handleOpenSettings,
}) => {
  const [imageError, setImageError] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyShortcode = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!item?.shortcode) return;

    const flagCopied = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(item.shortcode);
        flagCopied();
        return;
      }
    } catch (err) {
      // fall through to legacy path
    }

    const textarea = document.createElement("textarea");
    textarea.value = item.shortcode;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      if (document.execCommand("copy")) {
        flagCopied();
      }
    } catch (err) {
      console.error("Failed to copy shortcode:", err);
    }
    document.body.removeChild(textarea);
  };

  return (
    <Table.Row
      value={item}
      selected={selected}
      onChangeSelection={onChangeSelection}
      data-id={item?.id}
    >
      <Table.Cell className="text-left" style={{ maxWidth: 0 }}>
        <div className="flex items-center gap-3 overflow-hidden">
          {item?.poster_image && !imageError ? (
            <img
              src={item.poster_image}
              alt={item?.title || ""}
              className="flex-shrink-0 object-cover w-[75px] h-auto aspect-video rounded-[2px]"
              loading="lazy"
              onError={() => {
                setImageError(true);
              }}
            />
          ) : (
            <div
              className="flex-shrink-0 flex items-center justify-center w-[75px] aspect-video box-border bg-[#d1d5db] rounded-[2px]"
            >
              <img
                src={iconWhiteSvg}
                alt=""
                width="20"
                height="auto"
                className="h-auto"
              />
            </div>
          )}
          {(() => {
            const decodedTitle = decodeHTMLEntities(
              item?.title || __("Untitled", "presto-player")
            );
            const MAX_TITLE_CHARS = 60;
            const isTruncated = decodedTitle.length > MAX_TITLE_CHARS;
            return (
              <span
                className="block truncate cursor-pointer flex-1 min-w-0"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onEditClick) {
                    onEditClick(e, item?.id);
                  }
                }}
              >
                {isTruncated ? (
                  <>
                    {decodedTitle.slice(0, MAX_TITLE_CHARS - 1)}
                    <Tooltip placement="top" content={decodedTitle} arrow>
                      <span className="inline-block">…</span>
                    </Tooltip>
                  </>
                ) : (
                  decodedTitle
                )}
              </span>
            );
          })()}
        </div>
      </Table.Cell>
      <Table.Cell className="text-left">
        {getBadge(item?.status)}
      </Table.Cell>
      <Table.Cell className="text-left">
        <div className="flex flex-wrap gap-x-1 gap-y-2">
          {item?.tags && item.tags.length > 0 ? (
            item.tags
              .slice(0, 10)
              .map((tag) => (
                <Badge
                  key={tag.id}
                  variant="neutral"
                  label={decodeHTMLEntities(tag.name)}
                  size="sm"
                  className="text-xs"
                />
              ))
          ) : (
            <Text className="text-text-secondary text-sm">
              {__("No tags", "presto-player")}
            </Text>
          )}
          {item?.tags && item.tags.length > 10 && (
            <Tooltip
              content={item.tags
                .slice(10)
                .map((tag) => decodeHTMLEntities(tag.name))
                .join(", ")}
              arrow
              placement="top"
            >
              <Badge
                variant="neutral"
                label={`+${item.tags.length - 10}`}
                size="sm"
                className="text-xs"
              />
            </Tooltip>
          )}
        </div>
      </Table.Cell>
      <Table.Cell className="whitespace-nowrap text-left">
        <div className="flex items-center gap-2">
          {item?.shortcode ? (
            <code
              className="font-mono text-xs px-3 py-2 rounded bg-field-secondary-background outline outline-1 outline-border-subtle text-text-primary cursor-text select-all"
              onClick={(e) => e.stopPropagation()}
            >
              {item.shortcode}
            </code>
          ) : (
            <span className="font-mono text-xs px-3 py-2 rounded bg-field-secondary-background outline outline-1 outline-border-subtle text-text-tertiary">
              {__("No shortcode", "presto-player")}
            </span>
          )}
          {item?.shortcode && (
            <Tooltip
              content={
                copied
                  ? __("Copied!", "presto-player")
                  : __("Copy shortcode", "presto-player")
              }
              arrow
              placement="top"
            >
              <Button
                variant="ghost"
                icon={
                  copied ? (
                    <Check width="14" height="14" />
                  ) : (
                    <Copy width="14" height="14" />
                  )
                }
                size="xs"
                className={`flex-shrink-0 transition-colors ${
                  copied
                    ? "text-green-600 hover:text-green-700"
                    : "text-icon-secondary hover:text-icon-primary"
                }`}
                aria-label={__("Copy shortcode", "presto-player")}
                onClick={handleCopyShortcode}
              />
            </Tooltip>
          )}
        </div>
      </Table.Cell>
      <Table.Cell className="text-left whitespace-nowrap">
        {formatPublishDate(item?.post_date)}
      </Table.Cell>
      <Table.Cell className="text-right">
        <div className="flex items-center justify-center gap-2">
          {(() => {
            const viewUrl = resolveViewUrl(item);
            if (!viewUrl) {
              return null;
            }
            const isPreview = PREVIEW_STATUSES.includes(item?.status);
            const label = isPreview
              ? __("Preview", "presto-player")
              : __("View", "presto-player");
            return (
              <Tooltip content={label} arrow placement="top">
                <Button
                  variant="ghost"
                  icon={<Eye />}
                  size="xs"
                  className="text-icon-secondary hover:text-icon-primary"
                  aria-label={label}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(viewUrl, "_blank", "noopener,noreferrer");
                  }}
                />
              </Tooltip>
            );
          })()}
          <Tooltip content={__("Edit", "presto-player")} arrow placement="top">
            <Button
              variant="ghost"
              icon={<PencilLine />}
              size="xs"
              className="text-icon-secondary hover:text-icon-primary"
              aria-label={__("Edit", "presto-player")}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onEditClick) {
                  onEditClick(e, item?.id);
                }
              }}
            />
          </Tooltip>
          <Tooltip
            content={__("Post Settings", "presto-player")}
            arrow
            placement="top"
          >
            <Button
              variant="ghost"
              size="xs"
              icon={<Settings />}
              aria-label={__("Post Settings", "presto-player")}
              className="text-icon-secondary hover:text-icon-primary"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (handleOpenSettings) {
                  handleOpenSettings(e, item);
                }
              }}
            />
          </Tooltip>
          <DropdownMenu boundary={getViewportBoundary()}>
            <DropdownMenu.Trigger>
              <Button
                variant="ghost"
                icon={<Ellipsis />}
                size="xs"
                className="text-icon-secondary hover:text-icon-primary z-0"
                aria-label={__("More Options", "presto-player")}
              />
            </DropdownMenu.Trigger>
            <DropdownMenu.ContentWrapper className="z-10">
              <DropdownMenu.Content className="w-48">
                <DropdownMenu.List>
                  {renderActionMenu ? renderActionMenu(item) : null}
                </DropdownMenu.List>
              </DropdownMenu.Content>
            </DropdownMenu.ContentWrapper>
          </DropdownMenu>
        </div>
      </Table.Cell>
    </Table.Row>
  );
};

export default MediaRow;
