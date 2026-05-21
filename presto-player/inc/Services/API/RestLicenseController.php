<?php
/**
 * License REST API Controller (free plugin).
 *
 * Owns the REST surface for license management used by the new admin
 * dashboard. Bridges to Pro's LicensedProduct model when present, so the
 * dashboard works against any Pro version that ships LicensedProduct
 * (i.e. every Pro version since the licensing feature was introduced).
 *
 * @package PrestoPlayer\Services\API
 */

namespace PrestoPlayer\Services\API;

/**
 * REST controller for /presto-player/v1/license/{status,activate,deactivate}.
 *
 * Bridge methods (`is_pro_installed`, `call_pro_activate`, `call_pro_deactivate`,
 * `get_pro_key`) are intentionally `protected` so unit tests can swap them via
 * Mockery partial mocks — the same pattern `License`'s `fetch()` uses. The
 * `PRO_LICENSED_PRODUCT` constant holds an FQCN string (not `::class`) on
 * purpose: the free plugin cannot `use` a class that the Pro plugin may not
 * have loaded. The IDE/static-analysis cost is the deliberate tradeoff for
 * cross-plugin reach.
 *
 * Naming: WP-facing methods (`register_routes`, `permissions_check`) are
 * snake_case as REST conventions require; bridge helpers follow the same
 * style for codebase consistency. CSRF is enforced by the WP REST cookie
 * auth flow itself — without `X-WP-Nonce`, requests authenticate as anon
 * and `current_user_can` returns false, so the explicit capability check
 * below is sufficient.
 */
class RestLicenseController {

	/**
	 * Fully-qualified class name of Pro's licensing model. Held as a string
	 * because we cannot import a Pro class from the free plugin.
	 */
	const PRO_LICENSED_PRODUCT = 'PrestoPlayer\Pro\Models\LicensedProduct';

	/**
	 * Error code returned when Pro is not installed. Shared with tests
	 * via class constant so the wire contract can't drift.
	 */
	const ERROR_PRO_NOT_INSTALLED = 'presto_player_pro_not_installed';

	/**
	 * REST namespace.
	 *
	 * @var string
	 */
	protected $namespace = 'presto-player';

	/**
	 * REST version segment.
	 *
	 * @var string
	 */
	protected $version = 'v1';

	/**
	 * REST base for this controller's routes.
	 *
	 * @var string
	 */
	protected $base = 'license';

	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Register REST routes.
	 *
	 * @return void
	 */
	public function register_routes() {
		register_rest_route(
			"{$this->namespace}/{$this->version}/{$this->base}",
			'/activate',
			array(
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'activate' ),
				'permission_callback' => array( $this, 'permissions_check' ),
				'args'                => array(
					'key' => array(
						'description'       => __( 'The license key to activate.', 'presto-player' ),
						'type'              => 'string',
						'required'          => true,
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
			)
		);

		register_rest_route(
			"{$this->namespace}/{$this->version}/{$this->base}",
			'/deactivate',
			array(
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'deactivate' ),
				'permission_callback' => array( $this, 'permissions_check' ),
			)
		);

		register_rest_route(
			"{$this->namespace}/{$this->version}/{$this->base}",
			'/status',
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array( $this, 'status' ),
				'permission_callback' => array( $this, 'permissions_check' ),
			)
		);
	}

	/**
	 * Capability gate. The WP REST cookie-auth flow requires `X-WP-Nonce`
	 * to authenticate; without it, this check returns false (anon user).
	 * That implicit nonce check is the CSRF protection — no second nonce
	 * verification needed here.
	 *
	 * @return bool
	 */
	public function permissions_check() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * POST /license/activate
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function activate( $request ) {
		if ( ! $this->is_pro_installed() ) {
			return $this->pro_not_installed_error();
		}

		$result = $this->call_pro_activate( (string) $request->get_param( 'key' ) );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		// Signal pro_license_activated to Usage::detect_pro_license_event(); mirrors
		// the transient the legacy form handler set so analytics stays consistent.
		set_transient( 'presto_player_pro_license_just_activated', 1, 60 );

		return rest_ensure_response(
			array(
				'status'  => 'success',
				'message' => sanitize_text_field( (string) $result ),
				'key'     => self::mask_key( $this->get_pro_key() ),
			)
		);
	}

	/**
	 * POST /license/deactivate
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function deactivate() {
		if ( ! $this->is_pro_installed() ) {
			return $this->pro_not_installed_error();
		}

		$result = $this->call_pro_deactivate();
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		// Signal pro_license_deactivated to Usage::detect_pro_license_event(); mirrors
		// the transient the legacy form handler set so analytics stays consistent.
		set_transient( 'presto_player_pro_license_just_deactivated', 1, 60 );

		return rest_ensure_response(
			array(
				'status'  => 'success',
				'message' => sanitize_text_field( (string) $result ),
			)
		);
	}

	/**
	 * GET /license/status
	 *
	 * @return \WP_REST_Response
	 */
	public function status() {
		if ( ! $this->is_pro_installed() ) {
			return rest_ensure_response(
				array(
					'active' => false,
					'key'    => '',
				)
			);
		}

		$key = $this->get_pro_key();
		return rest_ensure_response(
			array(
				'active' => '' !== $key,
				'key'    => '' !== $key ? self::mask_key( $key ) : '',
			)
		);
	}

	/**
	 * Mask a license key for client display.
	 *
	 * Format: 4-leading + 8 fixed asterisks + 4-trailing — enough for an
	 * owner to recognize their own key, not enough to correlate against
	 * leaked datasets or brute-force the suffix. Keys shorter than 12
	 * chars get a fixed-width 12-asterisk mask so length isn't leaked.
	 *
	 * Public static so tests can verify the format directly without
	 * reflection or mocks.
	 *
	 * @param string $key Raw key.
	 * @return string Masked key, or empty string for empty input.
	 */
	public static function mask_key( $key ) {
		$key = (string) $key;
		if ( '' === $key ) {
			return '';
		}
		if ( strlen( $key ) < 12 ) {
			return str_repeat( '*', 12 );
		}
		return substr( $key, 0, 4 ) . str_repeat( '*', 8 ) . substr( $key, -4 );
	}

	/**
	 * Whether Pro's `LicensedProduct` model is loadable on this request.
	 *
	 * Override in tests via partial mock to exercise the no-Pro branches.
	 *
	 * @return bool
	 */
	protected function is_pro_installed() {
		return class_exists( self::PRO_LICENSED_PRODUCT );
	}

	/**
	 * Bridge: LicensedProduct::activate(). Caller must guard via
	 * is_pro_installed() before invoking.
	 *
	 * @param string $key License key.
	 * @return string|\WP_Error Activation message on success, WP_Error otherwise.
	 */
	protected function call_pro_activate( $key ) {
		$class = self::PRO_LICENSED_PRODUCT;
		if ( ! method_exists( $class, 'activate' ) ) {
			return new \WP_Error(
				'pro_outdated',
				__( 'Please update Presto Player Pro to manage your license.', 'presto-player' ),
				array( 'status' => 500 )
			);
		}
		return $class::activate( $key );
	}

	/**
	 * Bridge: LicensedProduct::deactivate(). Caller must guard via
	 * is_pro_installed() before invoking.
	 *
	 * @return string|\WP_Error Deactivation message on success, WP_Error otherwise.
	 */
	protected function call_pro_deactivate() {
		$class = self::PRO_LICENSED_PRODUCT;
		if ( ! method_exists( $class, 'deactivate' ) ) {
			return new \WP_Error(
				'pro_outdated',
				__( 'Please update Presto Player Pro to manage your license.', 'presto-player' ),
				array( 'status' => 500 )
			);
		}
		return $class::deactivate();
	}

	/**
	 * Bridge: LicensedProduct::getKey(). Defensive guard kept here so the
	 * method is safe to call from a partial mock or future caller without
	 * an external is_pro_installed() check — the cost is one class_exists
	 * call.
	 *
	 * @return string Stored license key, or empty string when Pro is absent.
	 */
	protected function get_pro_key() {
		if ( ! $this->is_pro_installed() ) {
			return '';
		}
		$class = self::PRO_LICENSED_PRODUCT;
		if ( ! method_exists( $class, 'getKey' ) ) {
			return '';
		}
		return (string) $class::getKey();
	}

	/**
	 * Standard error returned when Pro is not installed.
	 *
	 * @return \WP_Error
	 */
	protected function pro_not_installed_error() {
		return new \WP_Error(
			self::ERROR_PRO_NOT_INSTALLED,
			__( 'Presto Player Pro is required to manage your license.', 'presto-player' ),
			array( 'status' => 400 )
		);
	}
}
