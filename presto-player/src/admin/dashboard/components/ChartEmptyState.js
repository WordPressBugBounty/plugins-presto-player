import { Text } from "@bsf/force-ui";
const { __ } = wp.i18n;

const FileVideoIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M14.5 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V7.5L14.5 2Z"
      stroke="#111827"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14.5 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V7.5L14.5 2Z"
      stroke="url(#paint0_linear_chart_empty)"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14 2V8H20"
      stroke="#111827"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14 2V8H20"
      stroke="url(#paint1_linear_chart_empty)"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M10 11L15 14L10 17V11Z"
      stroke="#111827"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M10 11L15 14L10 17V11Z"
      stroke="url(#paint2_linear_chart_empty)"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <defs>
      <linearGradient
        id="paint0_linear_chart_empty"
        x1="12"
        y1="2"
        x2="12"
        y2="22"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#9A20F8" />
        <stop offset="1" stopColor="#3058E5" />
      </linearGradient>
      <linearGradient
        id="paint1_linear_chart_empty"
        x1="17"
        y1="2"
        x2="17"
        y2="8"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#9A20F8" />
        <stop offset="1" stopColor="#3058E5" />
      </linearGradient>
      <linearGradient
        id="paint2_linear_chart_empty"
        x1="12.5"
        y1="11"
        x2="12.5"
        y2="17"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#9A20F8" />
        <stop offset="1" stopColor="#3058E5" />
      </linearGradient>
    </defs>
  </svg>
);

/**
 * Shared empty state for analytics/engagement charts and stats tables.
 * Keeps the icon, copy, and layout identical across the dashboard so every
 * "no data" moment feels like the same product.
 *
 * Pass `className` to control the container height/padding per chart — the
 * engagement chart gets a tall 256px placeholder while the Top Performing
 * widget gets a compact 112px one. Pass `description={null}` to hide the
 * secondary line in tight spaces (e.g. the retention mini-chart).
 *
 * Pass `proGated` for charts that only fill in for Pro users. When the
 * current user isn't licensed, an "Unlock with Pro." sentence is appended
 * to the description so the empty state reads as gated rather than empty.
 * The phrase is intentionally plain text (no link) — the page already has
 * upgrade banners and CTAs, and stacking another clickable nudge here was
 * deemed too noisy.
 */
const ChartEmptyState = ({
  title = __("No Stats Available", "presto-player"),
  description = __(
    "You'll find detailed insights here to help you monitor and manage your video performance.",
    "presto-player"
  ),
  className = "",
  proGated = false,
}) => {
  const isPremium = !!window?.prestoPlayer?.isPremium;
  const showUpsell = proGated && !isPremium;
  const showText = !!description || showUpsell;

  return (
    <div
      className={`flex flex-col gap-4 items-center justify-center text-center px-1 ${className}`}
    >
      <FileVideoIcon />
      <div className="flex flex-col gap-1 items-center">
        <Text size="sm" className="font-medium text-text-primary m-0">
          {title}
        </Text>
        {showText && (
          <Text size="sm" className="font-normal text-text-tertiary m-0">
            {description}
            {description && showUpsell ? " " : null}
            {showUpsell && __("Unlock with Pro.", "presto-player")}
          </Text>
        )}
      </div>
    </div>
  );
};

export default ChartEmptyState;
