import React, { useState, useMemo } from "react";
const { __ } = wp.i18n;
import { Button, Loader, toast } from "@bsf/force-ui";
import PluginRecommendations from "./PluginRecommendations";
import Presto_Admin_Icons from "../utils/icons";
import {
  activatePlugin,
  installPlugins,
  generateSuggestions,
} from "../utils/pluginUtils";

const ExtendPlugins = ({ layout = "inline" }) => {
  // Plugin status data from WordPress
  const prestoPlayerData = window.prestoPlayer || {};

  // Primary plugin suggestions (always shown first)
  const primaryPluginsData = [
    {
      id: "1",
      badgeText: __("Free", "presto-player"),
      svg: Presto_Admin_Icons.sureforms,
      title: __("SureForms", "presto-player"),
      description: __("Launch powerful forms in minutes!", "presto-player"),
      slug: "sureforms",
      name: __("SureForms", "presto-player"),
      status: prestoPlayerData?.sureforms_status,
      init: "sureforms/sureforms.php",
    },
    {
      id: "2",
      badgeText: __("Free", "presto-player"),
      svg: Presto_Admin_Icons.surecart,
      title: __("SureCart", "presto-player"),
      description: __("The new way to sell on WordPress.", "presto-player"),
      slug: "surecart",
      name: __("SureCart", "presto-player"),
      status: prestoPlayerData?.surecart_status,
      init: "surecart/surecart.php",
    },
    {
      id: "3",
      badgeText: __("Free", "presto-player"),
      svg: Presto_Admin_Icons.ottokit,
      title: __("OttoKit", "presto-player"),
      description: __("Automate your WordPress setup.", "presto-player"),
      slug: "suretriggers",
      name: __("OttoKit", "presto-player"),
      status: prestoPlayerData?.suretriggers_status,
      init: "suretriggers/suretriggers.php",
    },
    {
      id: "4",
      badgeText: __("Free", "presto-player"),
      svg: Presto_Admin_Icons.suremembers,
      title: __("SureMembers", "presto-player"),
      description: __(
        "Membership tiers and content protection.",
        "presto-player"
      ),
      slug: "suremembers",
      name: __("SureMembers", "presto-player"),
      status: prestoPlayerData?.suremembers_status,
      init: "suremembers/suremembers.php",
    },
  ];

  // Secondary plugin suggestions (shown when primary ones are activated)
  const secondaryPluginsData = [
    {
      id: "5",
      badgeText: __("Free", "presto-player"),
      svg: Presto_Admin_Icons.suremails,
      title: "SureMails",
      description:
        __("Powerful email marketing for", "presto-player") + "WordPress.",
      slug: "suremails",
      name: __("SureMails", "presto-player"),
      status: prestoPlayerData?.suremails_status || "not-installed",
      init: "suremails/suremails.php",
    },
  ];

  // Track plugin statuses in state
  const [pluginStatuses, setPluginStatuses] = useState(() => {
    const statuses = {};
    [...primaryPluginsData, ...secondaryPluginsData].forEach((plugin) => {
      statuses[plugin.slug] = plugin.status;
    });
    return statuses;
  });

  const integrations = useMemo(
    () => generateSuggestions(pluginStatuses, primaryPluginsData, secondaryPluginsData),
    [pluginStatuses]
  );

  const updatePluginStatus = (pluginSlug, newStatus) => {
    setPluginStatuses((prevStatuses) => ({
      ...prevStatuses,
      [pluginSlug]: newStatus,
    }));
  };

  const [processingIntegration, setProcessingIntegration] = useState(null);

  const renderActionButton = (plugin) => {
    const isProcessing = processingIntegration === plugin.slug;

    const isPluginActive = plugin?.status === "active";
    const isPluginInActive = plugin?.status === "inactive";
    const isPluginNotInstalled = plugin?.status === "not-installed";

    if ("suremembers" === plugin.slug && isPluginNotInstalled) {
      return (
        <Button
          variant="secondary"
          size="xs"
          onClick={() =>
            window.open(
              "https://suremembers.com/?utm_source=plugin&utm_medium=dashboard&utm_campaign=plugin",
              "_blank"
            )
          }
        >
          {__("Learn More", "presto-player")}
        </Button>
      );
    }

    if (isPluginNotInstalled) {
      return (
        <Button
          variant="outline"
          className="no-underline border-border-subtle text-text-primary hover:no-underline"
          size="xs"
          onClick={async () => {
            if (
              processingIntegration &&
              processingIntegration !== plugin.slug
            ) {
              toast.info(
                __(
                  "Another plugin operation is in progress. Please wait.",
                  "presto-player"
                )
              );
              return;
            }
            setProcessingIntegration(plugin?.slug);
            try {
              await installPlugins([plugin]);
              updatePluginStatus(plugin?.slug, "active");
            } finally {
              setProcessingIntegration(null);
            }
          }}
          icon={isProcessing && <Loader variant="primary" />}
          iconPosition="left"
          disabled={isProcessing}
        >
          {__("Install & Activate", "presto-player")}
        </Button>
      );
    }

    if (isPluginInActive) {
      return (
        <Button
          variant="outline"
          className="no-underline bg-button-tertiary text-text-primary hover:no-underline border-border-subtle"
          size="xs"
          onClick={async () => {
            if (
              processingIntegration &&
              processingIntegration !== plugin.slug
            ) {
              toast.info(
                __(
                  "Another plugin operation is in progress. Please wait.",
                  "presto-player"
                )
              );
              return;
            }
            setProcessingIntegration(plugin?.slug);
            try {
              await activatePlugin(plugin);
              updatePluginStatus(plugin?.slug, "active");
            } finally {
              setProcessingIntegration(null);
            }
          }}
          disabled={isProcessing}
          icon={isProcessing && <Loader variant="primary" />}
          iconPosition="left"
        >
          {__("Activate", "presto-player")}
        </Button>
      );
    }

    if (isPluginActive) {
      return (
        <Button
          variant="outline"
          className="shadow-sm bg-badge-background-green text-text-primary border-border-subtle hover:no-underline"
          size="xs"
        >
          {__("Activated", "presto-player")}
        </Button>
      );
    }

    return null;
  };

  return (
    <PluginRecommendations
      integrations={integrations}
      renderActionButton={renderActionButton}
      layout={layout}
    />
  );
};

export default ExtendPlugins;
