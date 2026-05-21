import { Button, Text, Title, Container } from "@bsf/force-ui";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import useCompleteOnboarding from "../../hooks/useCompleteOnboarding";

const { __ } = wp.i18n;

const TIPS = [
  __("Use presets to keep a consistent player style across your site", "presto-player"),
  __("Add captions and chapters to improve accessibility and engagement", "presto-player"),
  __("Enable lazy loading in Settings → Performance for faster page loads", "presto-player"),
  __("Check the Analytics tab to track how your audience engages with videos", "presto-player"),
];

const Done = ({ goToPreviousStep }) => {
  const { completeOnboarding, isSubmitting } = useCompleteOnboarding();

  const handleCreateVideo = () =>
    completeOnboarding(
      window.prestoPlayer?.createMediaUrl ||
        "post-new.php?post_type=pp_video_block"
    );

  const handleGoToDashboard = () =>
    completeOnboarding(
      window.prestoPlayer?.dashboardUrl || "admin.php?page=presto-dashboard"
    );

  return (
    <Container direction="column" gap="lg" className="gap-6">
      <Container direction="column" gap="xs">
        <Title
          size="lg"
          tag="h3"
          title={__("You're All Set!", "presto-player")}
        />
        <Text size={14} weight={400} color="secondary">
          {__(
            "Your video player is configured and ready to use. Add videos to any page or post using Presto Player blocks, or manage your video library from the Media Hub.",
            "presto-player"
          )}
        </Text>
      </Container>

      <Container direction="column" gap="xs">
        <Text size={14} weight={600} color="primary">
          {__("Quick Tips to Get the Most Out of Presto Player:", "presto-player")}
        </Text>
        {TIPS.map((tip, index) => (
          <Container key={index} direction="row" align="center" gap="xs">
            <Check className="size-4 text-icon-interactive flex-shrink-0" />
            <Text size={14} weight={400} color="secondary">
              {tip}
            </Text>
          </Container>
        ))}
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
            variant="ghost"
            className="text-text-tertiary"
            onClick={handleGoToDashboard}
            disabled={isSubmitting}
          >
            {__("Go to Dashboard", "presto-player")}
          </Button>
          <Button
            iconPosition="right"
            icon={<ChevronRight />}
            onClick={handleCreateVideo}
            disabled={isSubmitting}
          >
            {__("Create Your First Video", "presto-player")}
          </Button>
        </Container>
      </Container>
    </Container>
  );
};

export default Done;
