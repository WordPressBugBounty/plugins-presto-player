import wpApiFetch from "@wordpress/api-fetch";
import { toast } from "@bsf/force-ui";

const { __, sprintf } = wp.i18n;

/**
 * Activates a WordPress plugin via REST API
 *
 * @param {Object} plugin - The plugin object containing init and slug
 * @returns {Promise<boolean>} True if activation was successful
 *
 * @example
 * await activatePlugin({ init: "plugin/plugin.php", slug: "plugin", name: "My Plugin" })
 */
export const activatePlugin = async (plugin) => {
  try {
    const formData = new FormData();
    formData.append("plugin_init", plugin?.init);
    formData.append("plugin_slug", plugin?.slug);
    const response = await wpApiFetch({
      path: window.prestoPlayer.api.activatePlugin,
      method: "POST",
      body: formData,
    });

    if (response.success) {
      toast.success(
        sprintf(
          /* translators: %s: Plugin name */
          __("%s Plugin Activated Successfully..!", "presto-player"),
          plugin?.name
        )
      );
      return true;
    }
  } catch (error) {
    console.error(`Failed to activate ${plugin?.name}:`, error);
    return false;
  }
};

/**
 * Installs one or more WordPress plugins using the WordPress updates API
 *
 * @param {Array<Object>} pluginInstallList - Array of plugin objects to install
 * @returns {Promise<void>} Resolves when all plugins are installed and activated
 *
 * @example
 * await installPlugins([
 *   { slug: "plugin-1", init: "plugin-1/plugin-1.php", name: "Plugin 1" },
 *   { slug: "plugin-2", init: "plugin-2/plugin-2.php", name: "Plugin 2" }
 * ])
 */
export const installPlugins = async (pluginInstallList) => {
  return new Promise((resolve) => {
    if (!pluginInstallList?.length) {
      resolve();
      return;
    }

    const installPromises = pluginInstallList.map((plugin) => {
      return new Promise((resolveInstall, rejectInstall) => {
        try {
          toast.info(
            sprintf(
              /* translators: %s: Plugin name */
              __("Installing %s plugin. Please wait..", "presto-player"),
              plugin?.name
            )
          );
          wp.updates.queue.push({
            action: "install-plugin",
            data: {
              slug: plugin?.slug,
              init: plugin?.init,
              success: async () => {
                toast.success(
                  sprintf(
                    /* translators: %s: Plugin name */
                    __("%s plugin Installed Successfully..", "presto-player"),
                    plugin?.name
                  )
                );

                try {
                  await activatePlugin(plugin);
                  resolveInstall();
                } catch (activationError) {
                  console.error(
                    `Failed to activate ${plugin?.name}:`,
                    activationError
                  );
                  rejectInstall(activationError);
                }
              },
              error: (error) => {
                console.error(`Failed to install ${plugin?.name}:`, error);
                rejectInstall(error);
              },
            },
          });

          wp.updates.queueChecker();
        } catch (error) {
          console.error(`Error installing ${plugin?.name}:`, error);
          rejectInstall(error);
        }
      });
    });

    // Wait for all plugins to install & activate before resolving
    Promise.allSettled(installPromises).then(() => resolve());
  });
};

/**
 * Generates plugin suggestions based on current statuses
 * Prioritizes non-activated primary plugins, then fills with secondary plugins
 *
 * @param {Object} statuses - Object mapping plugin slugs to their status
 * @param {Array<Object>} primaryPlugins - Array of primary plugin objects
 * @param {Array<Object>} secondaryPlugins - Array of secondary plugin objects
 * @returns {Array<Object>} Array of plugin suggestions (max 4)
 *
 * @example
 * generateSuggestions(
 *   { "plugin-1": "active", "plugin-2": "inactive" },
 *   primaryPluginsData,
 *   secondaryPluginsData
 * )
 */
export const generateSuggestions = (
  statuses,
  primaryPlugins,
  secondaryPlugins
) => {
  const suggestions = [];

  // Add non-activated primary plugins
  primaryPlugins.forEach((plugin) => {
    if (statuses[plugin.slug] !== "active") {
      suggestions.push({
        ...plugin,
        status: statuses[plugin.slug],
      });
    }
  });

  // Fill remaining slots with secondary plugins
  secondaryPlugins.forEach((plugin) => {
    if (suggestions.length < 4 && statuses[plugin.slug] !== "active") {
      suggestions.push({
        ...plugin,
        status: statuses[plugin.slug],
      });
    }
  });

  // Fill remaining slots with activated primary plugins if needed
  if (suggestions.length < 4) {
    primaryPlugins.forEach((plugin) => {
      if (suggestions.length < 4 && statuses[plugin.slug] === "active") {
        suggestions.push({
          ...plugin,
          status: statuses[plugin.slug],
        });
      }
    });
  }

  return suggestions.slice(0, 4);
};

/**
 * Check if a plugin is installed and/or active via REST API.
 *
 * @param {string} slug - The plugin slug to check.
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export const checkPluginStatus = async (slug) => {
  try {
    const response = await wpApiFetch({
      path: `/presto-player/v1/plugin-status/${slug}`,
      method: "GET",
    });
    return { success: true, data: response };
  } catch (error) {
    console.error(`Error checking plugin status for ${slug}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Install a plugin from WordPress.org via REST API.
 *
 * @param {string} slug - The plugin slug to install.
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export const installPlugin = async (slug) => {
  try {
    const response = await wpApiFetch({
      path: "/presto-player/v1/install-plugin",
      method: "POST",
      data: { plugin: slug },
    });
    return { success: true, data: response };
  } catch (error) {
    console.error(`Error installing plugin ${slug}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Activate a plugin by slug via REST API.
 *
 * @param {string} slug - The plugin slug to activate.
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export const activatePluginBySlug = async (slug) => {
  try {
    const formData = new FormData();
    formData.append("plugin_slug", slug);
    formData.append("plugin_init", `${slug}/${slug}.php`);
    const response = await wpApiFetch({
      path: window.prestoPlayer.api.activatePlugin,
      method: "POST",
      body: formData,
    });
    return { success: true, data: response };
  } catch (error) {
    console.error(`Error activating plugin ${slug}:`, error);
    return { success: false, error: error.message };
  }
};
