import { useState, useEffect, useRef } from "react";
import {
  Button,
  Title,
  Text,
  Checkbox,
  Badge,
  Loader,
  Container,
} from "@bsf/force-ui";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { toast } from "@bsf/force-ui";
import {
  checkPluginStatus,
  installPlugin,
  activatePluginBySlug,
} from "../../utils/pluginUtils";

const { __, sprintf } = wp.i18n;

const prestoData = window.prestoPlayer || {};
const addonList = prestoData?.onboarding?.addonList || [];

const AddonItem = ({ addon, status, isSelected, onToggle, processing }) => {
  const statusLabels = {
    active: __("Active", "presto-player"),
    inactive: processing
      ? __("Activating\u2026", "presto-player")
      : __("Inactive", "presto-player"),
    default: processing ? __("Installing\u2026", "presto-player") : "",
  };

  const statusVariants = {
    active: "green",
    inactive: "yellow",
    default: "neutral",
  };

  const loaderClasses = {
    active: "text-badge-color-green",
    inactive: "text-badge-color-yellow",
    default: "text-badge-color-gray",
  };

  const showLoader = isSelected && processing;

  return (
    <div className="p-3 bg-background-primary flex gap-2 rounded-md shadow-sm [&>div]:flex-row-reverse [&>div]:w-full [&>div]:justify-between">
      <span className="w-6 h-6 mt-1 flex-shrink-0">
        {addon?.logo && (
          <img
            className="w-full h-full rounded"
            src={addon.logo}
            alt={sprintf(
              /* translators: %s is the addon title */
              __("%s logo", "presto-player"),
              addon.title
            )}
          />
        )}
      </span>

      <Checkbox
        label={{
          description: (
            <Text
              size={14}
              weight={400}
              color="secondary"
              className="!text-text-secondary"
            >
              {addon.description}
            </Text>
          ),
          heading: (
            <span className="flex items-center gap-2">
              <span className="cursor-pointer">{addon.title}</span>
              {(status || showLoader) && (
                <Badge
                  size="xs"
                  icon={
                    showLoader && (
                      <Loader
                        className={`[&>svg]:size-3.5 ${
                          loaderClasses[status] || loaderClasses.default
                        }`}
                      />
                    )
                  }
                  variant={statusVariants[status] || statusVariants.default}
                  label={statusLabels[status] || statusLabels.default}
                />
              )}
            </span>
          ),
        }}
        size="sm"
        checked={isSelected}
        onChange={(checked) => onToggle(addon.slug, checked)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onToggle(addon.slug, !isSelected);
          }
        }}
        className="focus:border-border-interactive [&_p]:text-text-secondary"
      />
    </div>
  );
};

const Integrations = ({ goToNextStep, goToPreviousStep }) => {
  const [addonStatus, setAddonStatus] = useState({});
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [processing, setProcessing] = useState(false);
  const timerRef = useRef(null);

  // Fetch addon statuses on mount.
  useEffect(() => {
    const fetchStatuses = async () => {
      if (!addonList.length) return;

      const results = await Promise.all(
        addonList.map(async (addon) => {
          try {
            const result = await checkPluginStatus(addon.slug);
            if (!result.success) return null;

            const { installed, active } = result.data;
            let status = "";
            if (active) status = "active";
            else if (installed) status = "inactive";

            return { slug: addon.slug, status };
          } catch (error) {
            return null;
          }
        })
      );

      const statuses = {};
      const initialSelected = [];

      results.forEach((result) => {
        if (result) {
          statuses[result.slug] = result.status;
          // Check already-active plugins. Leave not-installed ones unchecked.
          if (result.status === "active") {
            initialSelected.push(result.slug);
          }
        }
      });

      setAddonStatus(statuses);
      setSelectedAddons(initialSelected);
    };

    fetchStatuses();
  }, []);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const handleAddonToggle = (addonSlug, checked) => {
    setSelectedAddons((prev) =>
      checked
        ? prev.includes(addonSlug)
          ? prev
          : [...prev, addonSlug]
        : prev.filter((slug) => slug !== addonSlug)
    );
  };

  const handleContinue = async () => {
    if (processing) return;

    const allActive = selectedAddons.every(
      (slug) => addonStatus[slug] === "active"
    );

    if (selectedAddons.length === 0 || allActive) {
      goToNextStep();
      return;
    }

    setProcessing(true);

    try {
      for (const addon of addonList) {
        const addonSlug = addon.slug;

        if (!selectedAddons.includes(addonSlug)) continue;

        setProcessing(addonSlug);

        const currentStatus = addonStatus[addonSlug];

        if (currentStatus === "active") continue;

        try {
          // If not installed, install first.
          if (!currentStatus) {
            const installResult = await installPlugin(addonSlug);
            if (!installResult.success) {
              throw new Error(installResult.error);
            }
          }

          // Activate (whether freshly installed or already inactive).
          if (currentStatus === "inactive" || !currentStatus) {
            const activateResult = await activatePluginBySlug(addonSlug);
            if (!activateResult.success) {
              throw new Error(activateResult.error);
            }
          }

          // Update status to active.
          setAddonStatus((prev) => ({
            ...prev,
            [addonSlug]: "active",
          }));
        } catch (error) {
          toast.error(__("Error!", "presto-player"), {
            description: sprintf(
              /* translators: %s is the addon title */
              __("Failed to set up %s.", "presto-player"),
              addon.title
            ),
          });
        }
      }

      // Navigate after short delay for status badge to update visually.
      timerRef.current = setTimeout(goToNextStep, 500);
    } catch (error) {
      toast.error(__("Error!", "presto-player"), {
        description:
          error.message || __("Failed to setup addons.", "presto-player"),
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Container direction="column" gap="none">
      <Container direction="column" gap="xs">
        <Title
          size="lg"
          tag="h3"
          title={__("Integrations and features", "presto-player")}
        />
        <Text size={14} weight={400} color="secondary" className="max-w-[35rem]">
          {__(
            "To help you get the most out of Presto Player, we recommend adding these powerful integrations:",
            "presto-player"
          )}
        </Text>
      </Container>

      <div className="p-2 bg-background-secondary flex flex-col gap-1 rounded-lg overflow-auto mt-8">
        {addonList.map((addon, index) => (
          <AddonItem
            key={addon.slug || index}
            addon={addon}
            status={addonStatus[addon.slug] || ""}
            isSelected={selectedAddons.includes(addon.slug)}
            onToggle={handleAddonToggle}
            processing={processing === addon.slug}
          />
        ))}
      </div>

      <Container
        direction="row"
        align="center"
        className={`justify-between mt-8 ${
          processing ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        <Button
          icon={<ChevronLeft />}
          variant="outline"
          onClick={goToPreviousStep}
          disabled={!!processing}
        >
          {__("Back", "presto-player")}
        </Button>
        <Container direction="row" align="center" gap="sm">
          <Button
            className="text-text-tertiary"
            variant="ghost"
            onClick={goToNextStep}
            disabled={!!processing}
          >
            {__("Skip", "presto-player")}
          </Button>
          <Button
            className={processing ? "cursor-not-allowed" : ""}
            icon={
              processing ? (
                <Loader size="sm" variant="secondary" />
              ) : (
                <ChevronRight />
              )
            }
            iconPosition="right"
            onClick={handleContinue}
          >
            {processing
              ? __("Setting up\u2026", "presto-player")
              : __("Continue", "presto-player")}
          </Button>
        </Container>
      </Container>
    </Container>
  );
};

export default Integrations;
