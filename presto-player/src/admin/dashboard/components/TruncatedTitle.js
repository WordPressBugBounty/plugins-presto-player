import { Tooltip, Text } from "@bsf/force-ui";

const MAX_TITLE_CHARS = 60;

/**
 * Single-line text that truncates by character count and shows a tooltip with
 * the full value only when truncation actually occurs. Mirrors the Media Hub
 * row pattern so behavior stays consistent across dashboard tables.
 */
const TruncatedTitle = ({
  title,
  className = "",
  maxChars = MAX_TITLE_CHARS,
}) => {
  const str = title || "";
  if (!str) return null;

  const textClass = `text-text-secondary ${className}`.trim();

  if (str.length <= maxChars) {
    return (
      <Text as="span" size="sm" className={textClass}>
        {str}
      </Text>
    );
  }

  return (
    <Text as="span" size="sm" className={textClass}>
      {str.slice(0, maxChars - 1)}
      <Tooltip placement="top" content={str} arrow>
        <span className="inline-block">…</span>
      </Tooltip>
    </Text>
  );
};

export default TruncatedTitle;
