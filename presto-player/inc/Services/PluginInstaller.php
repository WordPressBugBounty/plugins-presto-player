<?php
/**
 * Onboarding plugin install/activate service.
 *
 * @package PrestoPlayer
 * @subpackage Services
 */

namespace PrestoPlayer\Services;

/**
 * REST-driven installer for the curated list of plugins recommended during onboarding.
 */
class PluginInstaller {

	/**
	 * Plugins this controller may install or activate, mapping wp.org slug to its canonical plugin file.
	 *
	 * Hard-coded to keep the /install-plugin and /activate-plugin REST routes scoped to the onboarding
	 * and recommendations surface — any other plugin lifecycle should go through wp-admin/plugins.php.
	 * Without this allowlist, a holder of an admin session could install or activate any plugin on disk.
	 */
	const ALLOWED_PLUGINS = array(
		'suredash'     => 'suredash/suredash.php',
		'surecart'     => 'surecart/surecart.php',
		'suretriggers' => 'suretriggers/suretriggers.php',
		'suremails'    => 'suremails/suremails.php',
		'sureforms'    => 'sureforms/sureforms.php',
		'suremembers'  => 'suremembers/suremembers.php',
	);

	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
		add_action( 'presto_player_after_plugin_activation', array( $this, 'suppress_plugin_redirects' ), 10, 2 );
	}

	/**
	 * Register REST API routes
	 */
	public function register_rest_routes() {
		$slug_arg = array(
			'type'              => 'string',
			'required'          => true,
			'sanitize_callback' => 'sanitize_text_field',
			'validate_callback' => array( $this, 'validate_plugin_slug' ),
		);

		register_rest_route(
			'presto-player/v1',
			'/activate-plugin',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'activate_plugin' ),
				'permission_callback' => function () {
					return current_user_can( 'activate_plugins' );
				},
				'args'                => array(
					'plugin_slug' => $slug_arg,
				),
			)
		);

		register_rest_route(
			'presto-player/v1',
			'/install-plugin',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'install_plugin' ),
				'permission_callback' => function () {
					return current_user_can( 'install_plugins' );
				},
				'args'                => array(
					'plugin' => $slug_arg,
				),
			)
		);

		register_rest_route(
			'presto-player/v1',
			'/plugin-status/(?P<slug>[a-zA-Z0-9_-]+)',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_plugin_status' ),
				'permission_callback' => function () {
					return current_user_can( 'install_plugins' );
				},
				'args'                => array(
					'slug' => $slug_arg,
				),
			)
		);
	}

	/**
	 * Reject plugin slugs that are not in ALLOWED_PLUGINS.
	 *
	 * @param mixed $value Slug supplied via REST.
	 * @return true|\WP_Error
	 */
	public function validate_plugin_slug( $value ) {
		if ( is_string( $value ) && isset( self::ALLOWED_PLUGINS[ $value ] ) ) {
			return true;
		}
		return new \WP_Error(
			'plugin_not_allowed',
			__( 'This plugin is not in the allowed list for this endpoint.', 'presto-player' ),
			array( 'status' => 403 )
		);
	}

	/**
	 * Activate an allowlisted plugin via REST API.
	 *
	 * The slug is validated against ALLOWED_PLUGINS by the route's args schema, and the plugin file
	 * path is derived from the allowlist rather than read from request input — so a client cannot
	 * smuggle in a different plugin file to activate.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function activate_plugin( $request ) {
		$plugin_slug = $request->get_param( 'plugin_slug' );
		$plugin_path = self::ALLOWED_PLUGINS[ $plugin_slug ];

		if ( ! function_exists( 'activate_plugin' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$activate = activate_plugin( $plugin_path );

		do_action( 'presto_player_after_plugin_activation', $plugin_path, $plugin_slug );

		if ( is_wp_error( $activate ) ) {
			return new \WP_Error(
				'activation_failed',
				$activate->get_error_message(),
				array( 'status' => 500 )
			);
		}

		return rest_ensure_response(
			array(
				'success' => true,
				'message' => __( 'Plugin activated successfully.', 'presto-player' ),
			)
		);
	}

	/**
	 * Suppress activation redirects from plugins installed during onboarding.
	 *
	 * Plugins like SureForms and SureMails set redirect flags on activation.
	 * This clears those flags so they don't hijack the onboarding flow.
	 *
	 * @param string $plugin_path Plugin file path.
	 * @param string $plugin_slug Plugin slug.
	 */
	public function suppress_plugin_redirects( $plugin_path, $plugin_slug ) {
		$redirect_flags = array(
			'sureforms'    => array(
				'type'  => 'option',
				'key'   => '__srfm_do_redirect',
				'value' => false,
			),
			'suremails'    => array(
				'type'  => 'option',
				'key'   => 'suremails_do_redirect',
				'value' => false,
			),
			'suretriggers' => array(
				'type' => 'transient',
				'key'  => 'st-redirect-after-activation',
			),
		);

		if ( ! isset( $redirect_flags[ $plugin_slug ] ) ) {
			return;
		}

		$flag = $redirect_flags[ $plugin_slug ];

		if ( 'option' === $flag['type'] ) {
			update_option( $flag['key'], $flag['value'] );
		} elseif ( 'transient' === $flag['type'] ) {
			delete_transient( $flag['key'] );
		}
	}

	/**
	 * Get plugin installation and activation status.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_plugin_status( $request ) {
		$plugin_slug = sanitize_text_field( $request->get_param( 'slug' ) );

		if ( empty( $plugin_slug ) ) {
			return new \WP_Error(
				'missing_plugin',
				__( 'Plugin slug is required.', 'presto-player' ),
				array( 'status' => 400 )
			);
		}

		$plugin_file = $this->get_plugin_file( $plugin_slug );
		$installed   = ! is_null( $plugin_file );
		$active      = $installed && is_plugin_active( $plugin_file );

		return rest_ensure_response(
			array(
				'installed'   => $installed,
				'active'      => $active,
				'plugin_file' => $plugin_file,
			)
		);
	}

	/**
	 * Install a plugin from WordPress.org repository.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function install_plugin( $request ) {
		$plugin_slug = sanitize_text_field( $request->get_param( 'plugin' ) );

		if ( empty( $plugin_slug ) ) {
			return new \WP_Error(
				'missing_plugin',
				__( 'Plugin slug is required.', 'presto-player' ),
				array( 'status' => 400 )
			);
		}

		// Check if already installed.
		$plugin_file = $this->get_plugin_file( $plugin_slug );
		if ( $plugin_file ) {
			return rest_ensure_response(
				array(
					'success'     => true,
					'message'     => __( 'Plugin is already installed.', 'presto-player' ),
					'plugin_file' => $plugin_file,
				)
			);
		}

		if ( ! function_exists( 'plugins_api' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin-install.php';
		}
		if ( ! class_exists( 'WP_Upgrader' ) ) {
			require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
		}
		if ( ! function_exists( 'request_filesystem_credentials' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}

		$api = plugins_api(
			'plugin_information',
			array(
				'slug'   => $plugin_slug,
				'fields' => array( 'sections' => false ),
			)
		);

		if ( is_wp_error( $api ) ) {
			return new \WP_Error(
				'plugin_not_found',
				/* translators: %s: plugin slug */
				sprintf( __( 'Plugin %s not found in repository.', 'presto-player' ), $plugin_slug ),
				array( 'status' => 404 )
			);
		}

		$upgrader = new \Plugin_Upgrader( new \Automatic_Upgrader_Skin() );
		$result   = $upgrader->install( $api->download_link ?? '' );

		if ( is_wp_error( $result ) ) {
			return new \WP_Error(
				'installation_failed',
				$result->get_error_message(),
				array( 'status' => 500 )
			);
		}

		if ( false === $result ) {
			return new \WP_Error(
				'installation_failed',
				__( 'Plugin installation failed.', 'presto-player' ),
				array( 'status' => 500 )
			);
		}

		$plugin_file = $this->get_plugin_file( $plugin_slug );

		return rest_ensure_response(
			array(
				'success'     => true,
				'message'     => __( 'Plugin installed successfully.', 'presto-player' ),
				'plugin_file' => $plugin_file,
			)
		);
	}

	/**
	 * Get plugin file path from slug.
	 *
	 * @param string $plugin_slug Plugin slug (directory name).
	 * @return string|null Plugin file path or null if not found.
	 */
	private function get_plugin_file( $plugin_slug ) {
		if ( ! function_exists( 'get_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$plugins = get_plugins();

		foreach ( $plugins as $plugin_file => $plugin_data ) {
			if ( dirname( $plugin_file ) === $plugin_slug ) {
				return $plugin_file;
			}
		}

		return null;
	}
}
