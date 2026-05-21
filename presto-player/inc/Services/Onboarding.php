<?php
/**
 * Onboarding wizard tracking service.
 *
 * @package PrestoPlayer
 * @subpackage Services
 */

namespace PrestoPlayer\Services;

/**
 * Stores onboarding completion state and exposes REST endpoints for the wizard UI.
 */
class Onboarding {

	/**
	 * Option key for onboarding completion status.
	 *
	 * @var string
	 */
	private $status_option = 'presto_player_onboarding_completed';

	/**
	 * Register hooks and REST routes.
	 */
	public function register() {
		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
		add_action( 'admin_init', array( $this, 'maybe_redirect_to_onboarding' ) );
		add_action( 'admin_init', array( $this, 'suppress_partner_redirects' ), 1 );
	}

	/**
	 * Suppress activation redirects from partner plugins while PP onboarding is in progress.
	 * Runs at priority 1 so it fires before partner plugins' own admin_init hooks.
	 */
	public function suppress_partner_redirects() {
		if ( $this->is_completed() ) {
			return;
		}
		// Each branch is gated so we only touch the DB when something is
		// actually pending — without this, every admin pageload during
		// onboarding does 3 reads + 2 timeout-table SELECTs from delete_option.
		if ( false !== get_option( '__suredash_do_redirect', false ) ) {
			update_option( '__suredash_do_redirect', false );
		}
		if ( false !== get_option( 'suremails_do_redirect', false ) ) {
			update_option( 'suremails_do_redirect', false );
		}
		// OttoKit — transient-based redirect (no filter available).
		if ( false !== get_transient( 'st-redirect-after-activation' ) ) {
			delete_transient( 'st-redirect-after-activation' );
		}
	}

	/**
	 * Register REST API routes for onboarding.
	 */
	public function register_rest_routes() {
		register_rest_route(
			'presto-player/v1',
			'/onboarding/set-status',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'set_status' ),
				'permission_callback' => function () {
					return current_user_can( 'manage_options' );
				},
			)
		);

		register_rest_route(
			'presto-player/v1',
			'/onboarding/get-status',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_status' ),
				'permission_callback' => function () {
					return current_user_can( 'manage_options' );
				},
			)
		);

		register_rest_route(
			'presto-player/v1',
			'/onboarding/save-user-info',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'save_user_info' ),
				'permission_callback' => function () {
					return current_user_can( 'manage_options' );
				},
				'args'                => array(
					'firstName' => array(
						'type'              => 'string',
						'required'          => false,
						'sanitize_callback' => 'sanitize_text_field',
					),
					'lastName'  => array(
						'type'              => 'string',
						'required'          => false,
						'sanitize_callback' => 'sanitize_text_field',
					),
					'email'     => array(
						'type'              => 'string',
						'required'          => true,
						'format'            => 'email',
						'sanitize_callback' => 'sanitize_email',
						'validate_callback' => function ( $value ) {
							return is_string( $value ) && is_email( $value );
						},
					),
					// Explicit boolean. REST coerces '0', '', 'false' to false correctly;
					// PHP's (bool) cast on the string 'false' would coerce it to true.
					'optIn'     => array(
						'type'     => 'boolean',
						'required' => false,
						'default'  => false,
					),
				),
			)
		);
	}

	/**
	 * Set onboarding completion status.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response
	 */
	public function set_status( $request ) {
		$completed = sanitize_text_field( $request->get_param( 'completed' ) );

		if ( 'yes' === $completed ) {
			update_option( $this->status_option, 'yes' );
		}

		return new \WP_REST_Response( array( 'success' => true ), 200 );
	}

	/**
	 * Get onboarding completion status.
	 *
	 * @return \WP_REST_Response
	 */
	public function get_status() {
		$status = get_option( $this->status_option, 'no' );

		return new \WP_REST_Response(
			array(
				'success' => true,
				'status'  => $status,
			),
			200
		);
	}

	/**
	 * Check if onboarding is completed.
	 *
	 * @return bool
	 */
	public function is_completed() {
		return 'yes' === get_option( $this->status_option, 'no' );
	}

	/**
	 * Redirect to onboarding on first activation.
	 */
	public function maybe_redirect_to_onboarding() {
		$redirect = get_transient( 'presto_player_activation_redirect' );

		if ( ! $redirect ) {
			return;
		}

		delete_transient( 'presto_player_activation_redirect' );

		// Don't redirect if onboarding is already completed.
		if ( $this->is_completed() ) {
			return;
		}

		// Don't redirect on multisite network activation.
		if ( is_network_admin() ) {
			return;
		}

		// Don't redirect during AJAX or REST requests.
		if ( wp_doing_ajax() || defined( 'REST_REQUEST' ) ) {
			return;
		}

		// Don't redirect if activating multiple plugins.
		if ( isset( $_GET['activate-multi'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return;
		}

		wp_safe_redirect(
			admin_url( 'admin.php?page=presto-dashboard&post_type=pp_video_block&tab=Onboarding' )
		);
		exit;
	}

	/**
	 * Save user info from onboarding and send lead to BSF Metrics Server.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response
	 */
	public function save_user_info( $request ) {
		$first_name = $request->get_param( 'firstName' );
		$last_name  = $request->get_param( 'lastName' );
		$email      = $request->get_param( 'email' );
		$opt_in     = (bool) $request->get_param( 'optIn' );

		$option_key = 'presto_player_onboarding_user_info';
		$user_info  = array(
			'first_name' => $first_name,
			'last_name'  => $last_name,
			'email'      => $email,
			'opt_in'     => $opt_in,
		);

		// Save locally with autoload=no — this option holds PII (email, name)
		// and should not be loaded into every pageload's autoload cache.
		if ( false === get_option( $option_key, false ) ) {
			add_option( $option_key, $user_info, '', false );
		} else {
			update_option( $option_key, $user_info );
		}

		// Set usage tracking opt-in for BSF Analytics and send lead to BSF Metrics Server.
		// Both depend on the user's opt-in choice — no PII leaves the site otherwise.
		if ( $opt_in ) {
			update_option( 'presto-player_usage_optin', 'yes' );
			$this->generate_lead( $first_name, $last_name, $email );
		}

		return new \WP_REST_Response( array( 'success' => true ), 200 );
	}

	/**
	 * Send lead data to BSF Metrics Server.
	 *
	 * Follows the BSF ecosystem pattern for lead generation.
	 * See: Astra Sites class-astra-sites-astra-onboarding.php::generate_lead()
	 *
	 * @param string $first_name First name.
	 * @param string $last_name  Last name.
	 * @param string $email      Email address.
	 */
	private function generate_lead( $first_name, $last_name, $email ) {
		if ( empty( $email ) ) {
			return;
		}

		$metrics_domain = trailingslashit(
			defined( 'BSF_METRICS_REMOTE_URL' )
				? BSF_METRICS_REMOTE_URL
				: apply_filters( 'nps_survey_api_domain', 'https://metrics.brainstormforce.com/' )
		);
		$lead_endpoint  = $metrics_domain . 'wp-json/bsf-metrics-server/presto-player/v1/subscribe';

		$lead_data = array(
			'email'      => $email,
			'first_name' => $first_name,
			'last_name'  => $last_name,
		);

		wp_safe_remote_post(
			$lead_endpoint,
			array(
				'method'   => 'POST',
				'body'     => wp_json_encode( $lead_data ),
				'headers'  => array(
					'Content-Type' => 'application/json',
				),
				'timeout'  => 5,
				'blocking' => false,
			)
		);
	}
}
