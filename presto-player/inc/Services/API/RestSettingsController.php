<?php
/**
 * REST controller overrides for plugin settings.
 *
 * @package PrestoPlayer
 * @subpackage Services\API
 */

namespace PrestoPlayer\Services\API;

use PrestoPlayer\Support\Utility;

/**
 * Customises core's settings REST controller to validate Presto Player options.
 */
class RestSettingsController extends \WP_REST_Settings_Controller {


	/**
	 * Constructor.
	 *
	 * @since 4.7.0
	 */
	public function __construct() {
		$this->namespace = 'presto-player/v1';
		$this->rest_base = 'settings';
	}

	/**
	 * Register controller
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Retrieves all of the registered options for the Settings API.
	 *
	 * @since 4.7.0
	 *
	 * @return array Array of registered options.
	 */
	protected function get_registered_options() {
		$rest_options = array();

		foreach ( get_registered_settings() as $name => $args ) {
			if ( ! in_array( $name, array( 'presto_player_branding', 'presto_player_youtube', 'presto_player_presets', 'presto_player_audio_presets', 'presto_player_instant_video_width', 'presto_player_media_hub_sync_default', 'presto_player_performance', 'presto-player_usage_optin' ) ) ) {
				continue;
			}

			if ( empty( $args['show_in_rest'] ) ) {
				continue;
			}

			$rest_args = array();

			if ( is_array( $args['show_in_rest'] ) ) {
				$rest_args = $args['show_in_rest'];
			}

			$defaults = array(
				'name'   => ! empty( $rest_args['name'] ) ? $rest_args['name'] : $name,
				'schema' => array(),
			);

			$rest_args = array_merge( $defaults, $rest_args );

			$default_schema = array(
				'type'        => empty( $args['type'] ) ? null : $args['type'],
				'description' => empty( $args['description'] ) ? '' : $args['description'],
				'default'     => isset( $args['default'] ) ? $args['default'] : null,
			);

			$rest_args['schema']      = array_merge( $default_schema, $rest_args['schema'] );
			$rest_args['option_name'] = $name;

			// Skip over settings that don't have a defined type in the schema.
			if ( empty( $rest_args['schema']['type'] ) ) {
				continue;
			}

			/*
			 * Allow the supported types for settings, as we don't want invalid types
			 * to be updated with arbitrary values that we can't do decent sanitizing for.
			 */
			if ( ! in_array( $rest_args['schema']['type'], array( 'number', 'integer', 'string', 'boolean', 'array', 'object' ), true ) ) {
				continue;
			}

			$rest_args['schema'] = rest_default_additional_properties_to_false( $rest_args['schema'] );

			$rest_options[ $rest_args['name'] ] = $rest_args;
		}

		return $rest_options;
	}

	/**
	 * Reject invalid player_css before delegating the update to core.
	 *
	 * The previous `rest_pre_update_setting` filter approach short-circuited with
	 * `wp_die()`, which emits HTML and breaks `apiFetch`. Returning a `WP_Error`
	 * from that filter also fails silently because core treats any truthy return
	 * as "filter handled the update" and swallows the value with a 200 OK.
	 * Overriding `update_item` is the only place we can return a JSON 400 the
	 * client can act on.
	 *
	 * @param \WP_REST_Request $request Full data about the request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function update_item( $request ) {
		$branding = $request->get_param( 'presto_player_branding' );
		if ( is_array( $branding ) && array_key_exists( 'player_css', $branding ) ) {
			$css_validation_result = $this->validateCustomCSS( $branding['player_css'] );
			if ( is_wp_error( $css_validation_result ) ) {
				return $css_validation_result;
			}
		}

		return parent::update_item( $request );
	}

	/**
	 * Reject HTML markup inside the custom player CSS payload.
	 *
	 * Shares its detection with `Utility::hasHtmlMarkup` / `Utility::sanitizeCSS`
	 * so the REST 400 path and the render-time strip stay in lock-step.
	 *
	 * @param mixed $css CSS string from the request payload.
	 *
	 * @return true|\WP_Error True if the input is markup-free, otherwise WP_Error.
	 */
	protected function validateCustomCSS( $css ) {
		if ( Utility::hasHtmlMarkup( $css ) ) {
			return new \WP_Error(
				'rest_custom_css_illegal_markup',
				__( 'Markup is not allowed in CSS.', 'presto-player' ),
				array( 'status' => 400 )
			);
		}
		return true;
	}
}
