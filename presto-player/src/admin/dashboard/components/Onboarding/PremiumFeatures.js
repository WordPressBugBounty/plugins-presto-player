import { Badge, Button, Text, Title, Container } from "@bsf/force-ui";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Lock,
  ExternalLink,
} from "lucide-react";
import useUpgradeCTA from "../../hooks/useUpgradeCTA";
import useCompleteOnboarding from "../../hooks/useCompleteOnboarding";

const { __ } = wp.i18n;

const FEATURES = [
  {
    id: "video_sources",
    title: __("YouTube, Vimeo & Self-hosted Videos", "presto-player"),
    description: __(
      "Embed videos from all major sources with a fully customizable player.",
      "presto-player"
    ),
    type: "free",
  },
  {
    id: "presets_branding",
    title: __("Player Presets & Branding", "presto-player"),
    description: __(
      "Customize controls, colors, and poster images. Save reusable presets across your site.",
      "presto-player"
    ),
    type: "free",
  },
  {
    id: "builder_lms",
    title: __("Page Builder & LMS Integrations", "presto-player"),
    description: __(
      "Works with Elementor, Divi, Beaver Builder, LearnDash, TutorLMS, and LifterLMS.",
      "presto-player"
    ),
    type: "free",
  },
  {
    id: "bunny_hosting",
    title: __("Bunny.net Private Video Hosting", "presto-player"),
    description: __(
      "CDN-powered hosting with HLS adaptive streaming, private URLs, and transcoding.",
      "presto-player"
    ),
    type: "premium",
  },
  {
    id: "analytics",
    title: __("Video Analytics & Engagement Insights", "presto-player"),
    description: __(
      "Track per-user views, watch time, and engagement. Includes Google Analytics.",
      "presto-player"
    ),
    type: "premium",
  },
  {
    id: "playlists_chapters",
    title: __("Playlists & Video Chapters", "presto-player"),
    description: __(
      "Netflix-style bingeable playlists and clickable timestamp markers.",
      "presto-player"
    ),
    type: "premium",
  },
  {
    id: "more_pro_features",
    title: __("And much more", "presto-player"),
    description: __(
      "Popups, email capture, watermarks, CTAs, captions, and advanced playback.",
      "presto-player"
    ),
    type: "premium",
  },
];

const PremiumFeatures = ({ goToNextStep, goToPreviousStep }) => {
  const {
    isProUnlicensed,
    isPremium,
    licenseSettingsHref,
    externalUpgradeLink,
  } = useUpgradeCTA();
  const { completeOnboarding, isSubmitting } = useCompleteOnboarding();

  const handleUpgradeClick = isProUnlicensed
    ? () => completeOnboarding(licenseSettingsHref)
    : () => window.open(externalUpgradeLink, "_blank", "noopener noreferrer");

  const upgradeLabel = isProUnlicensed
    ? __("Activate License", "presto-player")
    : __("Upgrade to Pro", "presto-player");

  const heading = __("What's included with Presto Player", "presto-player");

  const subtitle = isPremium
    ? __(
        "Your Pro license is active — every feature below is ready to use.",
        "presto-player"
      )
    : isProUnlicensed
      ? __(
          "Your Pro features are ready — activate your license to start using them.",
          "presto-player"
        )
      : __(
          "A quick tour of everything you can do — included features are ready to use, and you can unlock the rest anytime.",
          "presto-player"
        );

  return (
    <Container direction="column" className="gap-5">
      <Container direction="column" gap="xs">
        <Title size="lg" tag="h3" title={heading} />
        <Text size={14} weight={400} color="secondary">
          {subtitle}
        </Text>
      </Container>

      <Container direction="column" gap="none">
        {FEATURES.map((feature, index) => {
          const isFeatureUnlocked = feature.type === "free" || isPremium;

          return (
            <div key={feature.id}>
              <Container
                direction="row"
                align="start"
                gap="sm"
                className="py-4 px-1"
              >
                {isFeatureUnlocked ? (
                  <div className="w-6 h-6 rounded-full bg-brand-background-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Check
                      className="size-3.5 text-brand-primary-600"
                      strokeWidth={2.5}
                    />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full border border-solid border-border-subtle bg-background-secondary flex items-center justify-center shrink-0 mt-0.5">
                    <Lock className="size-3.5 text-text-tertiary" />
                  </div>
                )}

                <Container.Item className="flex-grow min-w-0">
                  <Container
                    direction="row"
                    align="center"
                    gap="xs"
                    className="flex-wrap"
                  >
                    <Text size={14} weight={600} color="primary">
                      {feature.title}
                    </Text>
                    {feature.type === "free" ? (
                      <Badge
                        label={__("Included", "presto-player")}
                        size="sm"
                        variant="neutral"
                        disableHover
                        className="bg-brand-background-50 text-brand-primary-600 border-transparent"
                      />
                    ) : isPremium ? (
                      <Badge
                        label={__("Unlocked", "presto-player")}
                        size="sm"
                        variant="inverse"
                        disableHover
                        className="bg-brand-primary-600 text-white border-transparent"
                      />
                    ) : (
                      <Badge
                        label={__("Pro", "presto-player")}
                        size="sm"
                        variant="inverse"
                        disableHover
                        className="bg-brand-primary-600 text-white border-transparent"
                      />
                    )}
                  </Container>
                  <Text
                    size={14}
                    weight={400}
                    color="secondary"
                    className="mt-0.5"
                  >
                    {feature.description}
                  </Text>
                </Container.Item>
              </Container>
              {index < FEATURES.length - 1 && (
                <hr className="border-t border-solid border-border-subtle border-b-0 m-0 w-full" />
              )}
            </div>
          );
        })}
      </Container>

      <hr className="border-t border-solid border-border-subtle border-b-0 m-0 w-full" />

      <Container direction="row" align="center" className="justify-between">
        <Button
          icon={<ChevronLeft />}
          variant="outline"
          onClick={goToPreviousStep}
        >
          {__("Back", "presto-player")}
        </Button>
        <Container direction="row" align="center" gap="sm">
          <Button
            className="text-text-tertiary"
            variant="ghost"
            onClick={goToNextStep}
          >
            {__("Skip", "presto-player")}
          </Button>
          {!isPremium && (
            <Button
              icon={<ExternalLink className="w-5 h-5" />}
              iconPosition="right"
              size="md"
              tag="button"
              type="button"
              variant="ghost"
              onClick={handleUpgradeClick}
              disabled={isProUnlicensed && isSubmitting}
            >
              {upgradeLabel}
              {!isProUnlicensed && (
                <span className="sr-only">
                  {__("(opens in a new tab)", "presto-player")}
                </span>
              )}
            </Button>
          )}
          <Button
            iconPosition="right"
            icon={<ChevronRight />}
            onClick={goToNextStep}
          >
            {__("Next", "presto-player")}
          </Button>
        </Container>
      </Container>
    </Container>
  );
};

export default PremiumFeatures;
