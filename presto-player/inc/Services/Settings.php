<?php
/**
 * Plugin settings registration.
 *
 * @package presto-player
 */

namespace PrestoPlayer\Services;

use PrestoPlayer\Models\Setting;
use PrestoPlayer\Plugin;
use PrestoPlayer\Support\Utility;

/**
 * Settings service.
 */
class Settings {

	/**
	 * Register our settings
	 *
	 * @return void
	 */
	public function register() {
		// `init` covers admin, REST, front-end, AJAX, and cron in one shot — the
		// previous admin_init + rest_api_init pair double-registered on every
		// admin REST request and missed cron/front-end contexts entirely.
		add_action( 'init', array( $this, 'registerSettings' ) );

		// Default to "synced" when the option has never been stored. Covers the
		// window before register_setting()'s default is wired up by admin_init /
		// rest_api_init.
		add_filter(
			'default_option_presto_player_media_hub_sync_default',
			function ( $default_value, $option, $passed_default ) {
				if ( $passed_default ) {
					return $default_value;
				}
				return true;
			},
			10,
			3
		);

		// $wpdb writes option values via a `%s` placeholder, so PHP `false` lands
		// in wp_options as ''. That '' then fails the `type: boolean` REST schema
		// check and WP_REST_Settings_Controller swaps it out for `null` — which
		// the dashboard hook falls back to the `true` default, silently overriding
		// "Not Synced" on every page load. Unmarshal '' → false here so the
		// round-trip through the schema preserves user intent. Direction matters:
		// coercing '' → true (as an earlier fix did) masks legitimately saved
		// false values behind update_option()'s no-change short-circuit.
		add_filter(
			'option_presto_player_media_hub_sync_default',
			function ( $value ) {
				return '' === $value ? false : $value;
			}
		);
	}

	/**
	 * Sanitize the branding option array before storage.
	 *
	 * Single choke-point for every save path: WP core's `/wp/v2/settings`,
	 * the plugin's `presto-player/v1/settings`, and any direct
	 * `update_option('presto_player_branding', ...)` from PHP all route
	 * through `sanitize_option`, which invokes this callback. Per-property
	 * `sanitize_callback` entries on a nested object schema are silently
	 * ignored by core REST (only `type`/`minimum`/`maximum`/`format` run),
	 * so anything mission-critical lives here.
	 *
	 * Responsibilities:
	 *   - Strip HTML markup from `player_css` (defense in depth — the
	 *     render pipeline also runs `Utility::sanitizeCSS`).
	 *   - Constrain `logo` to http(s) URLs (blocks `data:` SVGs and
	 *     similar schemes that core's `esc_url_raw` would otherwise pass).
	 *   - Clamp `logo_width` to [1, 400] integers.
	 *   - Coerce `color` to a valid hex value, falling back to the brand
	 *     default when invalid (avoids the schema-validated `null` that
	 *     the REST round-trip would otherwise produce).
	 *   - Enforce the Pro gate on `logo` / `logo_width` so a non-Pro admin
	 *     can't bypass the UI gate via a direct REST call.
	 *
	 * @param mixed $value Raw value posted to the REST/admin form.
	 * @return array Sanitized branding option.
	 */
	public function sanitizeBranding( $value ) {
		if ( ! is_array( $value ) ) {
			return array();
		}

		if ( array_key_exists( 'player_css', $value ) && is_string( $value['player_css'] ) ) {
			$value['player_css'] = Utility::sanitizeCSS( $value['player_css'] );
		}

		if ( array_key_exists( 'logo', $value ) ) {
			$value['logo'] = is_string( $value['logo'] )
				? esc_url_raw( $value['logo'], array( 'http', 'https' ) )
				: '';
		}

		if ( array_key_exists( 'logo_width', $value ) ) {
			$width               = (int) $value['logo_width'];
			$value['logo_width'] = max( 1, min( 400, $width ) );
		}

		if ( array_key_exists( 'color', $value ) ) {
			$hex            = is_string( $value['color'] ) ? sanitize_hex_color( $value['color'] ) : null;
			$value['color'] = $hex ?? Setting::getDefaultColor();
		}

		if ( ! Plugin::isPro() ) {
			unset( $value['logo'], $value['logo_width'] );
		}

		return $value;
	}

	/**
	 * Sanitize usage tracking value to 'yes' or 'no'.
	 *
	 * @param mixed $value Input value. Accepts 'yes', 'no', boolean, or truthy/falsy values.
	 * @return string 'yes' or 'no'
	 */
	public function sanitize_usage_tracking( $value ) {
		if ( 'yes' === $value || 'no' === $value ) {
			return $value;
		}
		if ( ! is_scalar( $value ) ) {
			return 'no';
		}
		$bool = filter_var( $value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE );
		if ( null === $bool ) {
			$bool = (bool) $value;
		}
		return $bool ? 'yes' : 'no';
	}

	/**
	 * Register plugin settings for WP Settings API / REST.
	 *
	 * @return void
	 */
	public function registerSettings() {
		/**
		 * Analytics settings
		 */
		\register_setting(
			'presto_player',
			'presto_player_analytics',
			array(
				'type'         => 'object',
				'description'  => __( 'Analytics settings.', 'presto-player' ),
				'show_in_rest' => array(
					'name'   => 'presto_player_analytics',
					'type'   => 'object',
					'schema' => array(
						'additionalProperties' => false,
						'properties'           => array(
							'enable'     => array(
								'type' => 'boolean',
							),
							'purge_data' => array(
								'type' => 'boolean',
							),
						),
					),
				),
				'default'      => array(
					'enable'     => false,
					'purge_data' => true,
				),
			)
		);

		/**
		 * Branding settings
		 */
		\register_setting(
			'presto_player',
			'presto_player_branding',
			array(
				'type'              => 'object',
				'description'       => __( 'Branding settings.', 'presto-player' ),
				'sanitize_callback' => array( $this, 'sanitizeBranding' ),
				'show_in_rest'      => array(
					'name'   => 'presto_player_branding',
					'type'   => 'object',
					// Per-property `sanitize_callback` entries inside an object
					// schema are NOT invoked by core's REST controller — only
					// the type/minimum/maximum/format checks are. Everything
					// else is done in `sanitizeBranding` below so it actually
					// runs for every save path.
					'schema' => array(
						'additionalProperties' => false,
						'properties'           => array(
							'logo'       => array(
								'type' => 'string',
							),
							'logo_width' => array(
								'type'    => 'integer',
								'minimum' => 1,
								'maximum' => 400,
							),
							'color'      => array(
								'type' => 'string',
							),
							'player_css' => array(
								'type' => 'string',
							),
						),
					),
				),
				'default'           => array(
					'logo'       => '',
					'logo_width' => 150,
					'color'      => Setting::getDefaultColor(),
					'player_css' => '',
				),
			)
		);

		\register_setting(
			'presto_player',
			'presto_player_performance',
			array(
				'type'         => 'object',
				'description'  => __( 'Performance settings.', 'presto-player' ),
				'show_in_rest' => array(
					'name'   => 'presto_player_performance',
					'type'   => 'object',
					'schema' => array(
						'additionalProperties' => false,
						'properties'           => array(
							'module_enabled' => array(
								'type' => 'boolean',
							),
							'automations'    => array(
								'type' => 'boolean',
							),
						),
					),
				),
				'default'      => array(
					'module_enabled' => false,
					'automations'    => true,
				),
			)
		);

		/**
		 * Uninstall settings
		 */
		\register_setting(
			'presto_player',
			'presto_player_uninstall',
			array(
				'type'         => 'object',
				'description'  => __( 'Uninstall settings.', 'presto-player' ),
				'show_in_rest' => array(
					'name'   => 'presto_player_uninstall',
					'type'   => 'object',
					'schema' => array(
						'additionalProperties' => false,
						'properties'           => array(
							'uninstall_data' => array(
								'type' => 'boolean',
							),
						),
					),
				),
				'default'      => array(
					'uninstall_data' => false,
				),
			)
		);

		/**
		 * Analytics settings
		 */
		\register_setting(
			'presto_player',
			'presto_player_google_analytics',
			array(
				'type'         => 'object',
				'description'  => __( 'Google Analytics settings.', 'presto-player' ),
				'show_in_rest' => array(
					'name'   => 'presto_player_google_analytics',
					'type'   => 'object',
					'schema' => array(
						'additionalProperties' => false,
						'properties'           => array(
							'enable'           => array(
								'type' => 'boolean',
							),
							'use_existing_tag' => array(
								'type' => 'boolean',
							),
							'measurement_id'   => array(
								'type' => 'string',
							),
						),
					),
				),
				'default'      => array(
					'enable'           => false,
					'use_existing_tag' => false,
					'measurement_id'   => '',
				),
			)
		);

		/**
		 * General settings
		 */
		\register_setting(
			'presto_player',
			'presto_player_presets',
			array(
				'type'         => 'object',
				'description'  => __( 'Preset settings.', 'presto-player' ),
				'show_in_rest' => array(
					'name'   => 'presto_player_presets',
					'type'   => 'object',
					'schema' => array(
						'additionalProperties' => false,
						'properties'           => array(
							'default_player_preset' => array(
								'type'              => 'integer',
								'sanitize_callback' => 'intval',
							),
						),
					),
				),
				'default'      => array(
					'default_player_preset' => 1,
				),
			)
		);

		\register_setting(
			'presto_player',
			'presto_player_audio_presets',
			array(
				'type'         => 'object',
				'description'  => __( 'Preset settings.', 'presto-player' ),
				'show_in_rest' => array(
					'name'   => 'presto_player_audio_presets',
					'type'   => 'object',
					'schema' => array(
						'additionalProperties' => false,
						'properties'           => array(
							'default_player_preset' => array(
								'type'              => 'integer',
								'sanitize_callback' => 'intval',
							),
						),
					),
				),
				'default'      => array(
					'default_player_preset' => 1,
				),
			)
		);

		/**
		 * Youtube Settings
		 */
		\register_setting(
			'presto_player',
			'presto_player_youtube',
			array(
				'type'         => 'object',
				'description'  => __( 'Youtube settings.', 'presto-player' ),
				'show_in_rest' => array(
					'name'   => 'presto_player_youtube',
					'type'   => 'object',
					'schema' => array(
						'additionalProperties' => false,
						'properties'           => array(
							'nocookie'   => array(
								'type' => 'boolean',
							),
							'channel_id' => array(
								'type' => 'string',
							),
						),
					),
				),
				'default'      => array(
					'nocookie'   => false,
					'channel_id' => '',
				),
			)
		);

		/**
		 * Instant Video Width Setting
		 */
		\register_setting(
			'presto_player',
			'presto_player_instant_video_width',
			array(
				'type'         => 'string',
				'description'  => __( 'Instant video width.', 'presto-player' ),
				'show_in_rest' => array(
					'name'   => 'presto_player_instant_video_width',
					'type'   => 'string',
					'schema' => array(
						'type'    => 'string',
						'default' => '800px',
					),
				),
				'default'      => '800px',
			)
		);

		/**
		 * Set the default for media hub sync setting.
		 */
		\register_setting(
			'presto_player',
			'presto_player_media_hub_sync_default',
			array(
				'type'              => 'boolean',
				'description'       => __( 'Set the default for media hub sync setting.', 'presto-player' ),
				'sanitize_callback' => function ( $value ) {
					if ( null === $value || '' === $value ) {
						return true;
					}
					return rest_sanitize_boolean( $value );
				},
				'show_in_rest'      => array(
					'name'   => 'presto_player_media_hub_sync_default',
					'type'   => 'boolean',
					'schema' => array(
						'type'    => 'boolean',
						'default' => true,
					),
				),
				'default'           => true,
			)
		);

		/**
		 * Usage tracking setting.
		 *
		 * Stored as 'yes' or 'no'. Single source of truth for usage analytics opt-in.
		 */
		\register_setting(
			'presto_player',
			'presto-player_usage_optin',
			array(
				'type'              => 'string',
				'description'       => __( 'Usage tracking opt-in.', 'presto-player' ),
				'sanitize_callback' => array( $this, 'sanitize_usage_tracking' ),
				'show_in_rest'      => array(
					'name'   => 'presto-player_usage_optin',
					'type'   => 'string',
					'schema' => array(
						'type'    => 'string',
						'enum'    => array( 'yes', 'no' ),
						'default' => 'no',
					),
				),
				'default'           => 'no',
			)
		);
	}
}
