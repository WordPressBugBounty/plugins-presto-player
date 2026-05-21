import { __ } from "@wordpress/i18n";
import { Button, Container, Text, Title } from "@bsf/force-ui";
import { Rocket } from "lucide-react";
import { CHART_COLOR } from "./charts";
import useUpgradeCTA from "../hooks/useUpgradeCTA";
import { useHistory } from "../router/router";

const CheckIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 10.5833 7.6667"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="shrink-0"
  >
    <path
      d="M9.95833 0.625L3.54167 7.04167L0.625 4.125"
      stroke={CHART_COLOR}
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Upgrade-to-Pro card.
 *
 * @param {Object} props
 * @param {"vertical"|"horizontal"} [props.layout="vertical"] Layout mode.
 *   "vertical"   — illustration on top, copy/features/CTA below. Suits narrow columns (≤ ~400px).
 *   "horizontal" — illustration on the left, copy/features/CTA on the right. Suits wide surfaces (≥ ~640px).
 */
const UpgradeToPro = ({ layout = "vertical" }) => {
  const features = [
    __("Chapters & timestamps", "presto-player"),
    __("Overlays and CTAs", "presto-player"),
    __("Playlists", "presto-player"),
    __("Video popups", "presto-player"),
    __("Advanced playback", "presto-player"),
    __("Engagement insights", "presto-player"),
  ];

  const history = useHistory();
  const { label, onClick, isProUnlicensed, isPremium } = useUpgradeCTA(history);

  if (isPremium) {
    return null;
  }

  const isHorizontal = layout === "horizontal";

  const illustration = (
    <img
      src={window.prestoPlayer?.upgrade_image}
      alt={__("Upgrade to Pro", "presto-player")}
      className={
        isHorizontal
          ? "w-full h-full max-h-[180px] object-contain"
          : "w-full h-[180px] object-contain"
      }
    />
  );

  const content = (
    <Container className="gap-4" direction="column">
      <Container className="gap-3" direction="column">
        <Container.Item
          className="gap-2 capitalize font-semibold text-xs flex items-center leading-4"
          style={{ color: CHART_COLOR }}
        >
          <Rocket size={16} />
          {__("Unlock Premium Features", "presto-player")}
        </Container.Item>

        <Container className="gap-1" direction="column">
          <Title
            tag="h2"
            title={__("Power up your videos with Presto Player Pro", "presto-player")}
            size="sm"
            className="text-text-primary font-semibold text-lg leading-7"
          />
          <Text
            size="sm"
            className="text-text-secondary text-sm font-normal leading-5"
          >
            {__(
              "Engage viewers, grow your audience, and convert with powerful video tools — all in one place.",
              "presto-player"
            )}
          </Text>
        </Container>
      </Container>

      <Container
        containerType="grid"
        cols={2}
        gapX="sm"
        gapY="xs"
        className="pb-1"
      >
        {features.map((item, index) => (
          <Container
            key={index}
            direction="row"
            align="center"
            className="gap-2"
          >
            <CheckIcon />
            <Text
              size="sm"
              className="text-text-primary text-sm font-normal leading-5"
            >
              {item}
            </Text>
          </Container>
        ))}
      </Container>

      <Button
        className="w-full shadow-lg"
        size="md"
        variant="primary"
        onClick={onClick}
      >
        {label}
      </Button>
    </Container>
  );

  return (
    <div
      className="p-6 rounded-xl border border-solid border-transparent shadow-2xl overflow-clip"
      style={{
        background:
          "linear-gradient(white, white) padding-box, linear-gradient(to bottom, #9A20F8, #3058E5) border-box",
      }}
    >
      {isHorizontal ? (
        <Container direction="column" className="gap-4">
          {content}
        </Container>
      ) : (
        <Container className="gap-4" direction="column">
          {illustration}
          {content}
        </Container>
      )}
    </div>
  );
};

export default UpgradeToPro;
