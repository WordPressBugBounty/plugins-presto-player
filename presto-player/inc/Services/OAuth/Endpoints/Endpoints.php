<?php
/**
 * Endpoints (grouped OAuth classes).
 *
 * @package PrestoPlayer
 * @subpackage Services\OAuth\Endpoints
 */

namespace PrestoPlayer\Services\OAuth\Endpoints;

use PrestoPlayer\Contracts\Service;
use PrestoPlayer\Services\OAuth\Consent\ConsentController;
use PrestoPlayer\Services\OAuth\Constants;
use PrestoPlayer\Services\OAuth\Helpers\Tokens;
use PrestoPlayer\Services\OAuth\PKCE\Verifier;
use PrestoPlayer\Services\OAuth\Storage\ClientRepository;
use PrestoPlayer\Services\OAuth\Storage\RateLimiter;
use PrestoPlayer\Services\OAuth\Storage\ScopeHelper;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * REST registration + request handling for /oauth/authorize.
 */
class AuthorizeEndpoint implements Service {

	/**
	 * Hook the REST registration.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'parse_request', array( $this, 'maybeServeAuthorize' ) );
	}

	/**
	 * Serve the consent screen outside the REST stack.
	 *
	 * The consent GET/POST is browser-facing (cookie auth, HTML, redirects), so
	 * it must not go through register_rest_route: WordPress core's
	 * rest_cookie_check_errors would log the user out on a nonce-less GET (→
	 * login redirect loop) and 403 the consent POST (its nonce is the consent
	 * nonce, not wp_rest). Matching the request path in parse_request — exactly
	 * how DiscoveryEndpoint serves .well-known — sidesteps all of that.
	 *
	 * @param \WP $wp Current WP request object (unused but supplied by hook).
	 * @return void
	 */
	public function maybeServeAuthorize( $wp ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter
		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		if ( '' === $request_uri ) {
			return;
		}

		$path = untrailingslashit( (string) wp_parse_url( $request_uri, PHP_URL_PATH ) );
		if ( '' === $path ) {
			return;
		}

		$home_path = untrailingslashit( (string) wp_parse_url( home_url( '/' ), PHP_URL_PATH ) );
		if ( '' !== $home_path && ( $path === $home_path || 0 === strpos( $path, $home_path . '/' ) ) ) {
			$path = substr( $path, strlen( $home_path ) );
		}

		if ( Constants::AUTHORIZE_PATH !== $path ) {
			return;
		}

		$method = isset( $_SERVER['REQUEST_METHOD'] ) ? strtoupper( sanitize_text_field( wp_unslash( $_SERVER['REQUEST_METHOD'] ) ) ) : 'GET';
		if ( 'POST' === $method ) {
			$this->handlePost();
		} else {
			$this->handleGet();
		}
	}

	/**
	 * GET handler — validate, gate on login + scope capability, render consent.
	 *
	 * @return void
	 */
	public function handleGet() {
		$params = $this->collectParams();
		$client = $this->validateClientAndRedirect( $params );

		if ( null === $client ) {
			$this->renderUntrustedRedirectError();
			return;
		}

		$validation = $this->validateRequestParams( $params, $client );
		if ( is_string( $validation ) ) {
			$this->redirectWithError( $params['redirect_uri'], $validation, $params['state'] );
			return;
		}

		if ( ! is_user_logged_in() ) {
			$this->redirectToLogin( $params );
			return;
		}

		if ( ! current_user_can( $this->requiredCapabilityForScopes( $params['scope'] ) ) ) {
			$this->redirectWithError( $params['redirect_uri'], 'access_denied', $params['state'] );
			return;
		}

		$controller = new ConsentController();
		$controller->renderConsent(
			array_merge(
				$params,
				array(
					'client_name' => isset( $client['client_name'] ) ? $client['client_name'] : $client['client_id'],
				)
			)
		);
		$this->terminate();
	}

	/**
	 * POST handler — verify nonce, branch on allow/deny.
	 *
	 * @return void
	 */
	public function handlePost() {
		$params = $this->collectParams();
		$client = $this->validateClientAndRedirect( $params );

		if ( null === $client ) {
			$this->renderUntrustedRedirectError();
			return;
		}

		$validation = $this->validateRequestParams( $params, $client );
		if ( is_string( $validation ) ) {
			$this->redirectWithError( $params['redirect_uri'], $validation, $params['state'] );
			return;
		}

		if ( ! is_user_logged_in() ) {
			$this->redirectToLogin( $params );
			return;
		}

		if ( ! current_user_can( $this->requiredCapabilityForScopes( $params['scope'] ) ) ) {
			$this->redirectWithError( $params['redirect_uri'], 'access_denied', $params['state'] );
			return;
		}

		$controller = new ConsentController();
		$controller->handleConsentSubmit( $params );
		$this->terminate();
	}

	/**
	 * The highest capability required by any requested scope.
	 *
	 * @param string $scope Space-separated requested scope string.
	 * @return string Capability name (manage_options if any scope needs it, else edit_posts).
	 */
	protected function requiredCapabilityForScopes( $scope ) {
		$cap = 'edit_posts';
		foreach ( $this->parseScopes( $scope ) as $requested ) {
			if ( 'manage_options' === Constants::capabilityForScope( $requested ) ) {
				return 'manage_options';
			}
		}
		return $cap;
	}

	/**
	 * Pull the spec-required params from the query string.
	 *
	 * The consent form carries these as query args on its action URL (see
	 * ConsentController::buildFormAction), so they live in $_GET for both the
	 * initial consent view and the submit. The nonce + allow/deny decision are
	 * read from $_POST and verified in ConsentController::handleConsentSubmit.
	 *
	 * @return array<string, string>
	 */
	protected function collectParams() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only param collection; the consent nonce is verified in ConsentController.
		$source = wp_unslash( $_GET );

		$scope = isset( $source['scope'] ) ? (string) $source['scope'] : '';
		if ( '' === trim( $scope ) ) {
			$scope = Constants::SCOPE_READ;
		}

		$get = static function ( $key ) use ( $source ) {
			return isset( $source[ $key ] ) ? sanitize_text_field( (string) $source[ $key ] ) : '';
		};

		// state is opaque and echoed back for CSRF checks; redirect_uri is
		// exact-matched against the registered allowlist. sanitize_text_field()
		// would corrupt otherwise-valid values, so these are kept verbatim.
		$raw = static function ( $key ) use ( $source ) {
			// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- opaque/allowlist-matched value, intentionally verbatim.
			return isset( $source[ $key ] ) ? (string) $source[ $key ] : '';
		};

		return array(
			'response_type'         => $get( 'response_type' ),
			'client_id'             => $get( 'client_id' ),
			'redirect_uri'          => $raw( 'redirect_uri' ),
			'state'                 => $raw( 'state' ),
			'code_challenge'        => $get( 'code_challenge' ),
			'code_challenge_method' => $get( 'code_challenge_method' ),
			'scope'                 => sanitize_text_field( $scope ),
		);
	}

	/**
	 * Resolve the client record and ensure the redirect_uri is registered.
	 *
	 * Returning null means we cannot trust the redirect_uri and MUST render
	 * an inline HTML error rather than forwarding the user there.
	 *
	 * @param array<string, string> $params Collected params.
	 * @return array<string, mixed>|null Client row or null when redirect_uri is untrusted.
	 */
	protected function validateClientAndRedirect( array $params ) {
		if ( '' === $params['client_id'] || '' === $params['redirect_uri'] ) {
			return null;
		}

		$repo   = new \PrestoPlayer\Services\OAuth\Storage\ClientRepository();
		$client = $repo->find( $params['client_id'] );

		if ( ! $client ) {
			return null;
		}

		$allowed = $this->extractRedirectUris( $client );
		if ( ! in_array( $params['redirect_uri'], $allowed, true ) ) {
			return null;
		}

		return $client;
	}

	/**
	 * Normalize the redirect_uris column into an array of strings.
	 *
	 * @param array<string, mixed> $client Client row.
	 * @return string[]
	 */
	protected function extractRedirectUris( array $client ) {
		if ( empty( $client['redirect_uris'] ) ) {
			return array();
		}
		if ( is_array( $client['redirect_uris'] ) ) {
			return array_values( array_filter( array_map( 'strval', $client['redirect_uris'] ) ) );
		}
		$decoded = json_decode( (string) $client['redirect_uris'], true );
		if ( is_array( $decoded ) ) {
			return array_values( array_filter( array_map( 'strval', $decoded ) ) );
		}
		return array();
	}

	/**
	 * Validate spec-required params now that client + redirect_uri are trusted.
	 *
	 * Returns null on success, or an OAuth error code (string) on failure.
	 *
	 * @param array<string, string> $params Collected params.
	 * @param array<string, mixed>  $client Resolved client row.
	 * @return string|null OAuth error code or null when valid.
	 */
	protected function validateRequestParams( array $params, array $client ) {
		if ( 'code' !== $params['response_type'] ) {
			return 'unsupported_response_type';
		}

		// state is deliberately not required: OAuth 2.1 makes it optional when PKCE
		// is in play and S256 is mandatory below, and several MCP clients never send
		// one. An absent state binds as an empty segment in the consent nonce, the
		// same on the render and on the submit.

		if ( '' === $params['code_challenge'] ) {
			return 'invalid_request';
		}

		if ( ! preg_match( '/^[A-Za-z0-9_-]{43,128}$/', $params['code_challenge'] ) ) {
			return 'invalid_request';
		}

		if ( '' === $params['code_challenge_method'] || 'S256' !== $params['code_challenge_method'] ) {
			return 'invalid_request';
		}

		$registered = $this->extractRegisteredScopes( $client );

		foreach ( $this->parseScopes( $params['scope'] ) as $scope ) {
			if ( ! in_array( $scope, Constants::allowedScopes(), true ) ) {
				return 'invalid_scope';
			}
			// Confine the request to the scope this client registered for.
			if ( ! in_array( $scope, $registered, true ) ) {
				return 'invalid_scope';
			}
		}

		return null;
	}

	/**
	 * Parse the client's registered scope column into an array.
	 *
	 * Registration always stores a non-empty scope, so an empty column means a
	 * row we didn't write — fall back to `presto:read` only.
	 *
	 * @param array<string, mixed> $client Resolved client row.
	 * @return string[]
	 */
	protected function extractRegisteredScopes( array $client ) {
		$raw = isset( $client['scope'] ) ? (string) $client['scope'] : '';
		if ( '' === trim( $raw ) ) {
			return array( Constants::SCOPE_READ );
		}
		return $this->parseScopes( $raw );
	}

	/**
	 * Split space-separated scope string into an array.
	 *
	 * @param string $scope Raw scope string.
	 * @return string[]
	 */
	protected function parseScopes( $scope ) {
		$parts = preg_split( '/\s+/', trim( (string) $scope ) );
		if ( ! is_array( $parts ) ) {
			return array();
		}
		return array_values(
			array_filter(
				$parts,
				static function ( $s ) {
					return '' !== (string) $s;
				}
			)
		);
	}

	/**
	 * Redirect the browser to wp-login.php, preserving the current URL.
	 *
	 * @param array<string, string> $params Original params (used for hint only).
	 * @return void
	 */
	protected function redirectToLogin( array $params ) {
		unset( $params );

		// Build the return URL from the site's own host (home_url), never from
		// the attacker-controllable Host header, then append only the current
		// request path/query. wp_login_url + wp_safe_redirect still validate the
		// final redirect_to host on login completion.
		$base        = home_url();
		$scheme      = wp_parse_url( $base, PHP_URL_SCHEME ) ? wp_parse_url( $base, PHP_URL_SCHEME ) : 'https';
		$host        = wp_parse_url( $base, PHP_URL_HOST );
		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput

		$current   = esc_url_raw( $scheme . '://' . $host . $request_uri );
		$login_url = wp_login_url( $current );

		if ( wp_safe_redirect( $login_url ) ) {
			$this->terminate();
		}
	}

	/**
	 * Redirect to the validated redirect_uri carrying an OAuth error.
	 *
	 * @param string $redirect_uri Already-validated absolute URI.
	 * @param string $error        OAuth error code.
	 * @param string $state        Opaque state, echoed back when the client sent one.
	 * @return void
	 */
	protected function redirectWithError( $redirect_uri, $error, $state ) {
		$descriptions = array(
			'invalid_request'           => __( 'Missing or invalid OAuth parameter.', 'presto-player' ),
			'unsupported_response_type' => __( 'Only response_type=code is supported.', 'presto-player' ),
			'invalid_scope'             => __( 'One or more requested scopes are not recognized.', 'presto-player' ),
			'access_denied'             => __( 'The user denied the authorization request.', 'presto-player' ),
		);

		$query = array(
			'error'             => $error,
			'error_description' => isset( $descriptions[ $error ] ) ? $descriptions[ $error ] : $error,
		);

		// RFC 6749 §4.1.2.1: only echo state back if the request carried one.
		if ( '' !== (string) $state ) {
			$query['state'] = $state;
		}

		$url = add_query_arg( array_map( 'rawurlencode', $query ), $redirect_uri );
		if ( $this->externalRedirect( $url ) ) {
			$this->terminate();
		}
	}

	/**
	 * Render an inline HTML page when redirect_uri itself cannot be trusted.
	 *
	 * Per OAuth 2.1, we MUST NOT forward to an untrusted URL — show the
	 * user a self-hosted error page instead.
	 *
	 * @return void
	 */
	protected function renderUntrustedRedirectError() {
		status_header( 400 );
		nocache_headers();
		if ( ! headers_sent() ) {
			header( 'Content-Type: text/html; charset=utf-8' );
			header( 'X-Frame-Options: DENY' );
			header( "Content-Security-Policy: frame-ancestors 'none'" );
		}

		$title   = __( 'Authorization request rejected', 'presto-player' );
		$message = __( 'The OAuth client or redirect URI is not recognized. Stop the authorization attempt and contact the application owner.', 'presto-player' );

		echo '<!doctype html><html><head><meta charset="utf-8"><title>' . esc_html( $title ) . '</title>';
		echo '<meta name="viewport" content="width=device-width,initial-scale=1">';
		echo '<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f6f7f7;color:#1d2327;margin:0;padding:48px 24px;display:flex;justify-content:center}main{max-width:520px;background:#fff;border:1px solid #c3c4c7;border-radius:8px;padding:32px}h1{font-size:20px;margin:0 0 16px}p{line-height:1.5;margin:0}</style>';
		echo '</head><body><main><h1>' . esc_html( $title ) . '</h1><p>' . esc_html( $message ) . '</p></main></body></html>';
		$this->terminate();
	}

	/**
	 * Perform a redirect to a URL that has already been validated against
	 * the client's registered redirect_uris.
	 *
	 * Uses wp_safe_redirect when the target is same-host (cheapest path),
	 * otherwise wp_redirect — both are acceptable because validation has
	 * already happened upstream.
	 *
	 * @param string $url Absolute URL.
	 * @return bool Whether the redirect was performed (false when short-circuited, e.g. in tests).
	 */
	protected function externalRedirect( $url ) {
		$site_host   = wp_parse_url( home_url(), PHP_URL_HOST );
		$target_host = wp_parse_url( $url, PHP_URL_HOST );

		if ( $site_host && $target_host && strtolower( $site_host ) === strtolower( $target_host ) ) {
			return wp_safe_redirect( $url );
		}
		return wp_redirect( $url ); // phpcs:ignore WordPress.Security.SafeRedirect.wp_redirect_wp_redirect
	}

	/**
	 * Stop request processing after a terminal response (consent HTML, error
	 * page, or a redirect that has already been sent). Isolated so tests can
	 * observe the emitted output/redirect instead of the process being killed.
	 *
	 * @return void
	 */
	protected function terminate() {
		exit;
	}
}

/**
 * Discovery service entry point.
 */
class DiscoveryEndpoint implements Service {

	/**
	 * Hook into WordPress.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'parse_request', array( $this, 'maybeServeWellKnown' ) );
		add_action( 'rest_api_init', array( $this, 'registerRestRoutes' ) );
	}

	/**
	 * Intercept .well-known requests before WP's template handler runs.
	 *
	 * @param \WP $wp Current WP request object (unused but supplied by hook).
	 * @return void
	 */
	public function maybeServeWellKnown( $wp ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter
		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		if ( '' === $request_uri ) {
			return;
		}

		$path = (string) wp_parse_url( $request_uri, PHP_URL_PATH );
		if ( '' === $path ) {
			return;
		}

		$path = untrailingslashit( $path );

		$home_path = untrailingslashit( (string) wp_parse_url( home_url( '/' ), PHP_URL_PATH ) );
		if ( '' !== $home_path && ( $path === $home_path || 0 === strpos( $path, $home_path . '/' ) ) ) {
			$path = substr( $path, strlen( $home_path ) );
		}

		if ( '/.well-known/oauth-authorization-server' === $path ) {
			$this->serveOauthServerMetadata();
		} elseif ( '/.well-known/oauth-protected-resource' === $path ) {
			$this->serveProtectedResourceMetadata();
		}
	}

	/**
	 * Register the /mcp/info REST route.
	 *
	 * @return void
	 */
	public function registerRestRoutes() {
		register_rest_route(
			Constants::REST_NAMESPACE,
			'/mcp/info',
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array( $this, 'getMcpInfo' ),
				// Intentionally public: an MCP client needs this pre-auth to discover
				// the OAuth metadata URL in the first place. Payload is non-sensitive
				// (plugin name/version, ability count, discovery URL) — no site or
				// user data.
				'permission_callback' => '__return_true',
			)
		);
	}

	/**
	 * RFC 8414 — OAuth 2.0 Authorization Server Metadata.
	 *
	 * @return void
	 */
	protected function serveOauthServerMetadata() {
		$base = $this->oauthBaseUrl();

		$payload = array(
			'issuer'                                => $this->siteIssuer(),
			'authorization_endpoint'                => home_url( Constants::AUTHORIZE_PATH ),
			'token_endpoint'                        => $base . '/token',
			'registration_endpoint'                 => $base . '/register',
			'revocation_endpoint'                   => $base . '/revoke',
			'scopes_supported'                      => $this->supportedScopes(),
			'response_types_supported'              => array( 'code' ),
			'grant_types_supported'                 => array( 'authorization_code', 'refresh_token' ),
			'code_challenge_methods_supported'      => array( 'S256' ),
			'token_endpoint_auth_methods_supported' => array( 'none', 'client_secret_basic', 'client_secret_post' ),
		);

		$this->emitJson( $payload );
	}

	/**
	 * RFC 9728 — Protected Resource Metadata.
	 *
	 * @return void
	 */
	protected function serveProtectedResourceMetadata() {
		$payload = array(
			'resource'                 => rest_url( Constants::REST_NAMESPACE . '/mcp' ),
			'authorization_servers'    => array( $this->siteIssuer() ),
			'scopes_supported'         => $this->supportedScopes(),
			'bearer_methods_supported' => array( 'header' ),
		);

		$this->emitJson( $payload );
	}

	/**
	 * MCP server descriptor.
	 *
	 * @return \WP_REST_Response
	 */
	public function getMcpInfo() {
		$payload = array(
			'name'            => 'Presto Player',
			'version'         => $this->pluginVersion(),
			'abilities_count' => $this->countPrestoAbilities(),
			'auth'            => array(
				'type'      => 'oauth2',
				'discovery' => home_url( '/.well-known/oauth-authorization-server' ),
			),
			'fallback_auth'   => array( 'application_password' ),
		);

		return new \WP_REST_Response( $payload, 200 );
	}

	/**
	 * Echo JSON payload and terminate the request.
	 *
	 * @param array<string, mixed> $payload Data to encode.
	 * @return void
	 */
	protected function emitJson( array $payload ) {
		if ( ! headers_sent() ) {
			header( 'Content-Type: application/json; charset=utf-8' );
			header( 'Cache-Control: public, max-age=3600' );
		}
		echo wp_json_encode( $payload ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		exit;
	}

	/**
	 * Site issuer URL — no trailing slash, used for the `issuer` claim.
	 *
	 * @return string
	 */
	protected function siteIssuer() {
		return untrailingslashit( home_url( '/' ) );
	}

	/**
	 * Base URL for OAuth REST endpoints (no trailing slash).
	 *
	 * @return string
	 */
	protected function oauthBaseUrl() {
		return untrailingslashit( rest_url( Constants::REST_NAMESPACE . '/' . Constants::OAUTH_BASE ) );
	}

	/**
	 * Canonical scope list advertised by the discovery documents. Deferred to
	 * Constants so what we advertise can't drift from what /register accepts.
	 *
	 * @return string[]
	 */
	protected function supportedScopes() {
		return Constants::allowedScopes();
	}

	/**
	 * Current Presto Player plugin version.
	 *
	 * @return string
	 */
	protected function pluginVersion() {
		if ( defined( 'PRESTO_PLAYER_VERSION' ) ) {
			return (string) constant( 'PRESTO_PLAYER_VERSION' );
		}

		if ( defined( 'PRESTO_PLAYER_PLUGIN_FILE' ) ) {
			if ( ! function_exists( 'get_plugin_data' ) ) {
				require_once ABSPATH . 'wp-admin/includes/plugin.php';
			}
			$data = get_plugin_data( PRESTO_PLAYER_PLUGIN_FILE, false, false );
			if ( ! empty( $data['Version'] ) ) {
				return (string) $data['Version'];
			}
		}

		return '1.0.0';
	}

	/**
	 * Count registered abilities namespaced under presto-player/ or presto-player-pro/.
	 *
	 * @return int
	 */
	protected function countPrestoAbilities() {
		if ( ! function_exists( 'wp_get_abilities' ) ) {
			return 0;
		}

		$abilities = wp_get_abilities();
		if ( ! is_array( $abilities ) ) {
			return 0;
		}

		$count = 0;
		foreach ( $abilities as $ability ) {
			$name = is_object( $ability ) && method_exists( $ability, 'get_name' )
				? (string) $ability->get_name()
				: '';

			if ( 0 === strpos( $name, 'presto-player/' ) || 0 === strpos( $name, 'presto-player-pro/' ) ) {
				++$count;
			}
		}

		return $count;
	}
}

/**
 * POST /presto-player/v1/oauth/register
 *
 * Open per RFC 7591 spec; protected by a per-IP rate limit (10/hour).
 */
class RegisterEndpoint implements Service {

	/**
	 * Allowed custom URI schemes for native / desktop clients.
	 *
	 * @var string[]
	 */
	public const ALLOWED_CUSTOM_SCHEMES = array( 'claude', 'cursor', 'vscode' );

	/**
	 * Max number of redirect_uris a single registration may submit.
	 *
	 * @var int
	 */
	public const MAX_REDIRECT_URIS = 10;

	/**
	 * Max length of a single redirect_uri.
	 *
	 * Kept well under the TEXT column the authorization code stores its copy in, so a
	 * registered URI can never truncate on the way through and fail the hash_equals()
	 * match at the token endpoint.
	 *
	 * @var int
	 */
	public const MAX_REDIRECT_URI_LENGTH = 2000;

	/**
	 * Max number of registrations a single IP can perform per hour.
	 *
	 * @var int
	 */
	public const RATE_LIMIT_PER_HOUR = 10;

	/**
	 * How many buckets client IPs are hashed into for rate limiting.
	 *
	 * Caps the number of rate-limit rows this unauthenticated endpoint can create.
	 *
	 * @var int
	 */
	public const RATE_LIMIT_BUCKETS = 256;

	/**
	 * Site-wide registration ceiling per hour, across all IPs.
	 *
	 * @var int
	 */
	public const GLOBAL_RATE_LIMIT_PER_HOUR = 100;

	/**
	 * Transient key for the site-wide hourly registration counter.
	 *
	 * @var string
	 */
	public const GLOBAL_RATE_LIMIT_KEY = 'presto_oauth_reg_global';

	/**
	 * Default grant types when caller omits the field.
	 *
	 * @var string[]
	 */
	public const DEFAULT_GRANT_TYPES = array( 'authorization_code', 'refresh_token' );

	/**
	 * Default response types when caller omits the field.
	 *
	 * @var string[]
	 */
	public const DEFAULT_RESPONSE_TYPES = array( 'code' );

	/**
	 * Allowed values for token_endpoint_auth_method.
	 *
	 * @var string[]
	 */
	public const ALLOWED_AUTH_METHODS = array( 'none', 'client_secret_basic', 'client_secret_post' );

	/**
	 * Client repository used to persist new clients.
	 *
	 * @var ClientRepository|null
	 */
	protected $clients;

	/**
	 * Constructor.
	 *
	 * @param ClientRepository|null $clients Optional injected repository (DICE supplies this).
	 */
	public function __construct( ?ClientRepository $clients = null ) {
		$this->clients = $clients;
	}

	/**
	 * Hook into WordPress.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'rest_api_init', array( $this, 'registerRoute' ) );
	}

	/**
	 * Register the REST route.
	 *
	 * @return void
	 */
	public function registerRoute() {
		register_rest_route(
			Constants::REST_NAMESPACE,
			'/' . Constants::OAUTH_BASE . '/register',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'handleRegister' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	/**
	 * Handle a DCR request.
	 *
	 * @param WP_REST_Request $request Incoming request.
	 * @return WP_REST_Response
	 */
	public function handleRegister( WP_REST_Request $request ) {
		$ip = $this->getClientIp();

		// Atomic check-and-bump (single conditional UPDATE per call) so concurrent
		// registrations on this open endpoint can't read-modify-write past the
		// per-IP / global ceilings. hit() counts every attempt, so a flood of
		// invalid bodies still consumes both budgets instead of slipping the limit.
		$under_ip     = RateLimiter::hit( $this->rateLimitKey( $ip ), self::RATE_LIMIT_PER_HOUR );
		// Only charge the shared global budget when the per-IP check passed, so a
		// single flooding IP (already capped) can't drain the global ceiling and
		// 429 everyone else.
		$under_global = $under_ip && RateLimiter::hit( self::GLOBAL_RATE_LIMIT_KEY, self::GLOBAL_RATE_LIMIT_PER_HOUR );
		if ( ! $under_ip || ! $under_global ) {
			return $this->errorResponse(
				'too_many_requests',
				__( 'Rate limit exceeded. Try again later.', 'presto-player' ),
				429
			);
		}

		$body = $request->get_json_params();
		if ( ! is_array( $body ) ) {
			$body = $request->get_params();
		}
		if ( ! is_array( $body ) ) {
			$body = array();
		}

		$validated = $this->validate( $body );
		if ( is_wp_error( $validated ) ) {
			return $this->errorResponse(
				(string) $validated->get_error_code(),
				$validated->get_error_message(),
				400
			);
		}

		$record = $this->repository()->create( $validated );
		if ( empty( $record ) || empty( $record['client_id'] ) ) {
			return $this->errorResponse(
				'server_error',
				__( 'Client registration could not be completed. Try again later.', 'presto-player' ),
				500
			);
		}

		$response = array(
			'client_id'                  => $record['client_id'],
			'client_id_issued_at'        => ! empty( $record['created_at'] ) ? strtotime( $record['created_at'] . ' UTC' ) : time(),
			'client_name'                => $validated['client_name'],
			'redirect_uris'              => $validated['redirect_uris'],
			'grant_types'                => $validated['grant_types'],
			'response_types'             => $validated['response_types'],
			'token_endpoint_auth_method' => $validated['token_endpoint_auth_method'],
			'scope'                      => $validated['scope'],
		);

		if ( 'confidential' === $validated['client_type'] && ! empty( $record['client_secret'] ) ) {
			$response['client_secret'] = $record['client_secret'];
		}

		if ( ! empty( $validated['client_uri'] ) ) {
			$response['client_uri'] = $validated['client_uri'];
		}
		if ( ! empty( $validated['logo_uri'] ) ) {
			$response['logo_uri'] = $validated['logo_uri'];
		}
		if ( ! empty( $validated['software_id'] ) ) {
			$response['software_id'] = $validated['software_id'];
		}

		return new WP_REST_Response( $response, 200 );
	}

	/**
	 * Validate and normalise the incoming body.
	 *
	 * @param array<string, mixed> $body Raw decoded JSON body.
	 * @return array<string, mixed>|WP_Error Normalised metadata array on success, WP_Error on failure.
	 */
	protected function validate( array $body ) {
		$redirect_uris = isset( $body['redirect_uris'] ) ? $body['redirect_uris'] : null;
		if ( ! is_array( $redirect_uris ) || empty( $redirect_uris ) ) {
			return new WP_Error( 'invalid_redirect_uri', __( 'redirect_uris is required and must be a non-empty array.', 'presto-player' ) );
		}

		if ( count( $redirect_uris ) > self::MAX_REDIRECT_URIS ) {
			return new WP_Error( 'invalid_redirect_uri', __( 'Too many redirect_uris.', 'presto-player' ) );
		}

		$clean_uris = array();
		foreach ( $redirect_uris as $uri ) {
			if ( ! is_string( $uri ) || '' === trim( $uri ) ) {
				return new WP_Error( 'invalid_redirect_uri', __( 'Every redirect_uri must be a non-empty string.', 'presto-player' ) );
			}
			$uri = trim( $uri );
			if ( strlen( $uri ) > self::MAX_REDIRECT_URI_LENGTH ) {
				return new WP_Error(
					'invalid_redirect_uri',
					sprintf(
						/* translators: %d: the maximum number of characters allowed. */
						__( 'Each redirect_uri must be %d characters or fewer.', 'presto-player' ),
						self::MAX_REDIRECT_URI_LENGTH
					)
				);
			}
			if ( ! $this->isValidRedirectUri( $uri ) ) {
				return new WP_Error(
					'invalid_redirect_uri',
					/* translators: %s: the offending redirect URI. */
					sprintf( __( 'Invalid redirect_uri: %s', 'presto-player' ), $uri )
				);
			}
			$clean_uris[] = $uri;
		}

		$client_name = isset( $body['client_name'] ) ? sanitize_text_field( (string) $body['client_name'] ) : '';
		if ( '' === $client_name ) {
			return new WP_Error( 'invalid_client_metadata', __( 'client_name is required.', 'presto-player' ) );
		}
		if ( strlen( $client_name ) > 191 ) {
			return new WP_Error( 'invalid_client_metadata', __( 'client_name must be 191 characters or fewer.', 'presto-player' ) );
		}

		$client_uri = '';
		if ( ! empty( $body['client_uri'] ) ) {
			$candidate = esc_url_raw( (string) $body['client_uri'] );
			if ( ! $candidate || strlen( $candidate ) > self::MAX_REDIRECT_URI_LENGTH || ! wp_http_validate_url( $candidate ) ) {
				return new WP_Error( 'invalid_client_metadata', __( 'client_uri must be a valid URL.', 'presto-player' ) );
			}
			$client_uri = $candidate;
		}

		$logo_uri = '';
		if ( ! empty( $body['logo_uri'] ) ) {
			$candidate = esc_url_raw( (string) $body['logo_uri'] );
			if ( ! $candidate || strlen( $candidate ) > self::MAX_REDIRECT_URI_LENGTH || ! wp_http_validate_url( $candidate ) ) {
				return new WP_Error( 'invalid_client_metadata', __( 'logo_uri must be a valid URL.', 'presto-player' ) );
			}
			$logo_uri = $candidate;
		}

		$known_scopes = Constants::allowedScopes();

		// scope is OPTIONAL per RFC 7591, and there's no way to re-register from the
		// UI — defaulting to read-only locked a client that omitted it out of every
		// write scope discovery advertises, permanently. Read + write is the useful
		// default, but deliberately NOT the full ceiling: /register is
		// unauthenticated, so an omitted scope must not silently ask an admin to
		// approve destructive + admin. A client that needs those still asks for them
		// explicitly, and consent gates them either way.
		$scope_input = isset( $body['scope'] ) ? trim( (string) $body['scope'] ) : '';
		if ( '' === $scope_input ) {
			$scope_input = Constants::SCOPE_READ . ' ' . Constants::SCOPE_WRITE;
		}
		// Any advertised scope may be *registered* — registration only records a
		// ceiling, it grants nothing. The actual gate is consent: authorize
		// requires manage_options for presto:destructive / presto:admin (see
		// requiredCapabilityForScopes), so no token for those can be issued
		// unless an administrator approves it on the consent screen.
		$requested_scopes = preg_split( '/\s+/', $scope_input );
		$requested_scopes = is_array( $requested_scopes ) ? $requested_scopes : array();
		$requested_scopes = array_values( array_filter( array_map( 'strval', $requested_scopes ) ) );
		foreach ( $requested_scopes as $scope ) {
			if ( ! in_array( $scope, $known_scopes, true ) ) {
				return new WP_Error(
					'invalid_scope',
					/* translators: %s: the offending scope. */
					sprintf( __( 'Unknown scope: %s', 'presto-player' ), $scope )
				);
			}
		}
		$scope = implode( ' ', $requested_scopes );

		$grant_types = isset( $body['grant_types'] ) && is_array( $body['grant_types'] )
			? array_values( array_map( 'sanitize_text_field', $body['grant_types'] ) )
			: self::DEFAULT_GRANT_TYPES;
		if ( empty( $grant_types ) ) {
			$grant_types = self::DEFAULT_GRANT_TYPES;
		}
		foreach ( $grant_types as $grant_type ) {
			if ( ! in_array( $grant_type, self::DEFAULT_GRANT_TYPES, true ) ) {
				return new WP_Error(
					'invalid_client_metadata',
					/* translators: %s: the offending grant type. */
					sprintf( __( 'Unsupported grant_type: %s', 'presto-player' ), $grant_type )
				);
			}
		}

		$response_types = isset( $body['response_types'] ) && is_array( $body['response_types'] )
			? array_values( array_map( 'sanitize_text_field', $body['response_types'] ) )
			: self::DEFAULT_RESPONSE_TYPES;
		if ( empty( $response_types ) ) {
			$response_types = self::DEFAULT_RESPONSE_TYPES;
		}
		foreach ( $response_types as $response_type ) {
			if ( ! in_array( $response_type, self::DEFAULT_RESPONSE_TYPES, true ) ) {
				return new WP_Error(
					'invalid_client_metadata',
					/* translators: %s: the offending response type. */
					sprintf( __( 'Unsupported response_type: %s', 'presto-player' ), $response_type )
				);
			}
		}

		$auth_method = isset( $body['token_endpoint_auth_method'] )
			? sanitize_text_field( (string) $body['token_endpoint_auth_method'] )
			: 'none';
		if ( ! in_array( $auth_method, self::ALLOWED_AUTH_METHODS, true ) ) {
			return new WP_Error(
				'invalid_client_metadata',
				/* translators: %s: the offending auth method. */
				sprintf( __( 'Unsupported token_endpoint_auth_method: %s', 'presto-player' ), $auth_method )
			);
		}

		$client_type = ( 'none' === $auth_method ) ? 'public' : 'confidential';

		$software_id = '';
		if ( ! empty( $body['software_id'] ) ) {
			$software_id = sanitize_text_field( (string) $body['software_id'] );
			if ( strlen( $software_id ) > 191 ) {
				return new WP_Error( 'invalid_client_metadata', __( 'software_id must be 191 characters or fewer.', 'presto-player' ) );
			}
		}

		return array(
			'redirect_uris'              => $clean_uris,
			'client_name'                => $client_name,
			'client_uri'                 => $client_uri,
			'logo_uri'                   => $logo_uri,
			'scope'                      => $scope,
			'grant_types'                => $grant_types,
			'response_types'             => $response_types,
			'token_endpoint_auth_method' => $auth_method,
			'client_type'                => $client_type,
			'software_id'                => $software_id,
		);
	}

	/**
	 * Validate a single redirect URI.
	 *
	 * Loopback IPs (127.0.0.1, [::1], any port) and the configured custom schemes are
	 * allowed even though wp_http_validate_url() would otherwise reject them.
	 *
	 * @param string $uri Candidate URI.
	 * @return bool
	 */
	protected function isValidRedirectUri( $uri ) {
		$parts = wp_parse_url( $uri );
		if ( ! is_array( $parts ) || empty( $parts['scheme'] ) ) {
			return false;
		}

		if ( isset( $parts['fragment'] ) && '' !== $parts['fragment'] ) {
			return false;
		}

		$scheme = strtolower( $parts['scheme'] );

		if ( in_array( $scheme, self::ALLOWED_CUSTOM_SCHEMES, true ) ) {
			return true;
		}

		if ( 'http' === $scheme || 'https' === $scheme ) {
			$host = isset( $parts['host'] ) ? strtolower( $parts['host'] ) : '';
			// RFC 8252 8.3: only literal loopback IPs are allowed over plaintext http;
			// the "localhost" name can resolve off-loopback and is intentionally excluded.
			if ( '127.0.0.1' === $host || '[::1]' === $host ) {
				return true;
			}
			if ( 'https' === $scheme ) {
				return (bool) wp_http_validate_url( $uri );
			}
			return false;
		}

		return false;
	}

	/**
	 * Resolve the client's IP for rate-limiting.
	 *
	 * @return string
	 */
	protected function getClientIp() {
		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : 'unknown';
		if ( '' === $ip ) {
			$ip = 'unknown';
		}
		return $ip;
	}

	/**
	 * Cache key used for the rate-limit window.
	 *
	 * Registration is unauthenticated, and a key derived from the raw IP would let
	 * anyone with a /64 of IPv6 create one wp_options row per request. Hashing the
	 * IP into a fixed number of buckets caps the table at BUCKETS rows no matter how
	 * many addresses show up. Buckets are shared, but DCR is a once-per-client
	 * operation, and the global ceiling already limits a flood either way.
	 *
	 * @param string $ip Client IP.
	 * @return string
	 */
	protected function rateLimitKey( $ip ) {
		$bucket = hexdec( substr( md5( $ip ), 0, 4 ) ) % self::RATE_LIMIT_BUCKETS;
		return 'presto_oauth_reg_' . $bucket;
	}


	/**
	 * Lazily resolve the client repository.
	 *
	 * @return ClientRepository
	 */
	protected function repository() {
		if ( null === $this->clients ) {
			$this->clients = new ClientRepository();
		}
		return $this->clients;
	}

	/**
	 * Build an RFC 7591-compliant error response.
	 *
	 * @param string $code        Error code (machine-readable).
	 * @param string $description Human-readable description.
	 * @param int    $status      HTTP status.
	 * @return WP_REST_Response
	 */
	protected function errorResponse( $code, $description, $status ) {
		return new WP_REST_Response(
			array(
				'error'             => (string) $code,
				'error_description' => (string) $description,
			),
			(int) $status
		);
	}
}

/**
 * Per-IP throttling for the unauthenticated OAuth endpoints.
 *
 * /token and /revoke both hash a client secret with wp_check_password() before they
 * can reject a request, so an unauthenticated flood is CPU exhaustion without any
 * guessing involved. Registration already had a limiter; these get the same one.
 */
trait ThrottlesUnauthenticated {

	/**
	 * Whether this request is within the per-IP budget (and count it).
	 *
	 * Constants can't live in a trait until PHP 8.2, and we support 7.4, so the
	 * budget (120/hour) and bucket count (256, to keep the options table bounded)
	 * are inlined here.
	 *
	 * @param string $prefix Endpoint-specific key prefix, so the budgets are separate.
	 * @return bool
	 */
	protected function underThrottle( $prefix ) {
		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : 'unknown';
		if ( '' === $ip ) {
			$ip = 'unknown';
		}

		$bucket = hexdec( substr( md5( $ip ), 0, 4 ) ) % 256;

		return RateLimiter::hit( $prefix . $bucket, 120 );
	}
}

/**
 * REST controller for POST /oauth/revoke.
 *
 * Per RFC 7009 §2.2, the endpoint always returns 200 OK on a syntactically
 * valid request — regardless of whether the token existed — to avoid leaking
 * information to attackers.
 */
class RevokeEndpoint implements Service {

	use ThrottlesUnauthenticated;

	/**
	 * Client repository.
	 *
	 * @var \PrestoPlayer\Services\OAuth\Storage\ClientRepository|null
	 */
	protected $clients;

	/**
	 * Token repository.
	 *
	 * @var \PrestoPlayer\Services\OAuth\Storage\TokenRepository|null
	 */
	protected $tokens;

	/**
	 * Constructor.
	 *
	 * @param \PrestoPlayer\Services\OAuth\Storage\ClientRepository|null $clients Client repo.
	 * @param \PrestoPlayer\Services\OAuth\Storage\TokenRepository|null  $tokens  Token repo.
	 */
	public function __construct( $clients = null, $tokens = null ) {
		$this->clients = $clients;
		$this->tokens  = $tokens;
	}

	/**
	 * Hook into WordPress.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'rest_api_init', array( $this, 'registerRoute' ) );
	}

	/**
	 * Register the REST route.
	 *
	 * @return void
	 */
	public function registerRoute() {
		register_rest_route(
			Constants::REST_NAMESPACE,
			'/' . Constants::OAUTH_BASE . '/revoke',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'handle' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	/**
	 * Handle the revocation request.
	 *
	 * @param WP_REST_Request $request Incoming request.
	 * @return WP_REST_Response
	 */
	public function handle( WP_REST_Request $request ) {
		if ( ! $this->underThrottle( 'presto_oauth_revoke_' ) ) {
			return $this->error( 'too_many_requests', __( 'Rate limit exceeded. Try again later.', 'presto-player' ), 429 );
		}

		$token = (string) $request->get_param( 'token' );

		if ( '' === $token ) {
			return $this->error( 'invalid_request', __( 'Missing token parameter.', 'presto-player' ), 400 );
		}

		$client_id = sanitize_text_field( (string) $request->get_param( 'client_id' ) );
		$client    = $this->authenticateClient( $request, $client_id );
		if ( $client instanceof WP_REST_Response ) {
			return $client;
		}

		if ( ! $this->tokens ) {
			return $this->successEmpty();
		}

		$row = $this->tokens->findByPlaintext( $token );
		if ( $row && isset( $row['client_id'] ) && hash_equals( (string) $row['client_id'], (string) $client['client_id'] ) ) {
			$hash       = isset( $row['token_hash'] ) ? (string) $row['token_hash'] : '';
			$token_type = isset( $row['token_type'] ) ? (string) $row['token_type'] : '';

			if ( '' !== $hash ) {
				$this->tokens->revoke( $hash );
				if ( 'refresh' === $token_type ) {
					$this->tokens->revokeChain( $hash );
				}
			}
		}

		return $this->successEmpty();
	}

	/**
	 * Authenticate the client via basic auth header or form params.
	 *
	 * @param WP_REST_Request $request   Request.
	 * @param string          $client_id Client id from body.
	 * @return array<string, mixed>|WP_REST_Response Client row or error response.
	 */
	protected function authenticateClient( WP_REST_Request $request, string $client_id ) {
		if ( ! $this->clients ) {
			return $this->error( 'invalid_client', __( 'Client storage unavailable.', 'presto-player' ), 401, true );
		}

		$basic = $this->extractBasicAuth( $request );
		if ( null !== $basic ) {
			if ( '' !== $client_id && ! hash_equals( $basic['client_id'], $client_id ) ) {
				return $this->error( 'invalid_client', __( 'Client credentials mismatch.', 'presto-player' ), 401, true );
			}
			$client_id = $basic['client_id'];
		}

		if ( '' === $client_id ) {
			return $this->error( 'invalid_client', __( 'Client authentication required.', 'presto-player' ), 401, true );
		}

		$client = $this->clients->find( $client_id );
		if ( ! $client ) {
			return $this->error( 'invalid_client', __( 'Unknown client.', 'presto-player' ), 401, true );
		}

		$type = isset( $client['client_type'] ) ? (string) $client['client_type'] : '';
		$hash = isset( $client['client_secret_hash'] ) ? (string) $client['client_secret_hash'] : '';
		if ( 'confidential' === $type || '' !== $hash ) {
			$secret = null !== $basic ? $basic['client_secret'] : (string) $request->get_param( 'client_secret' );
			if ( '' === $secret || '' === $hash || ! wp_check_password( $secret, $hash ) ) {
				return $this->error( 'invalid_client', __( 'Client authentication failed.', 'presto-player' ), 401, true );
			}
		}

		return $client;
	}

	/**
	 * Pull HTTP Basic credentials from the Authorization header.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return array<string, string>|null { client_id, client_secret } or null when not present.
	 */
	protected function extractBasicAuth( WP_REST_Request $request ) {
		$header = $request->get_header( 'authorization' );
		if ( ! $header ) {
			return null;
		}
		if ( 0 !== stripos( $header, 'Basic ' ) ) {
			return null;
		}
		$decoded = base64_decode( substr( $header, 6 ), true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
		if ( false === $decoded || false === strpos( $decoded, ':' ) ) {
			return null;
		}
		[ $id, $secret ] = explode( ':', $decoded, 2 );
		return array(
			'client_id'     => rawurldecode( $id ),
			'client_secret' => rawurldecode( $secret ),
		);
	}

	/**
	 * Empty 200 response per RFC 7009 §2.2.
	 *
	 * @return WP_REST_Response
	 */
	protected function successEmpty(): WP_REST_Response {
		$response = new WP_REST_Response( null, 200 );
		$response->header( 'Cache-Control', 'no-store' );
		$response->header( 'Pragma', 'no-cache' );
		return $response;
	}

	/**
	 * Build an RFC 6749 error response.
	 *
	 * @param string $code        OAuth error code.
	 * @param string $description Human-readable description.
	 * @param int    $status      HTTP status code.
	 * @param bool   $challenge   Whether to add a WWW-Authenticate challenge.
	 * @return WP_REST_Response
	 */
	protected function error( string $code, string $description, int $status, bool $challenge = false ): WP_REST_Response {
		$response = new WP_REST_Response(
			array(
				'error'             => $code,
				'error_description' => $description,
			),
			$status
		);
		$response->header( 'Cache-Control', 'no-store' );
		$response->header( 'Pragma', 'no-cache' );
		if ( $challenge ) {
			$response->header( 'WWW-Authenticate', sprintf( 'Basic realm="OAuth", error="%s"', $code ) );
		}
		return $response;
	}
}

/**
 * REST controller for POST /oauth/token.
 */
class TokenEndpoint implements Service {

	use ThrottlesUnauthenticated;

	/**
	 * Client repository.
	 *
	 * @var \PrestoPlayer\Services\OAuth\Storage\ClientRepository|null
	 */
	protected $clients;

	/**
	 * Authorization code repository.
	 *
	 * @var \PrestoPlayer\Services\OAuth\Storage\CodeRepository|null
	 */
	protected $codes;

	/**
	 * Token repository.
	 *
	 * @var \PrestoPlayer\Services\OAuth\Storage\TokenRepository|null
	 */
	protected $tokens;

	/**
	 * Inject the storage repositories.
	 *
	 * @param \PrestoPlayer\Services\OAuth\Storage\ClientRepository|null $clients Client repo.
	 * @param \PrestoPlayer\Services\OAuth\Storage\CodeRepository|null   $codes   Code repo.
	 * @param \PrestoPlayer\Services\OAuth\Storage\TokenRepository|null  $tokens  Token repo.
	 */
	public function __construct( $clients = null, $codes = null, $tokens = null ) {
		$this->clients = $clients;
		$this->codes   = $codes;
		$this->tokens  = $tokens;
	}

	/**
	 * Hook into WordPress.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'rest_api_init', array( $this, 'registerRoute' ) );
	}

	/**
	 * Register the REST route.
	 *
	 * @return void
	 */
	public function registerRoute() {
		register_rest_route(
			Constants::REST_NAMESPACE,
			'/' . Constants::OAUTH_BASE . '/token',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'handle' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	/**
	 * Dispatch by grant_type.
	 *
	 * @param WP_REST_Request $request Incoming request.
	 * @return WP_REST_Response
	 */
	public function handle( WP_REST_Request $request ) {
		if ( ! $this->underThrottle( 'presto_oauth_token_' ) ) {
			return $this->error( 'too_many_requests', __( 'Rate limit exceeded. Try again later.', 'presto-player' ), 429 );
		}

		$grant_type = sanitize_text_field( (string) $request->get_param( 'grant_type' ) );

		if ( 'authorization_code' === $grant_type ) {
			return $this->handleAuthorizationCode( $request );
		}
		if ( 'refresh_token' === $grant_type ) {
			return $this->handleRefreshToken( $request );
		}

		return $this->error( 'unsupported_grant_type', __( 'The grant type is not supported.', 'presto-player' ), 400 );
	}

	/**
	 * Handles the authorization_code grant.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	protected function handleAuthorizationCode( WP_REST_Request $request ) {
		$code          = (string) $request->get_param( 'code' );
		$redirect_uri  = (string) $request->get_param( 'redirect_uri' );
		$client_id     = sanitize_text_field( (string) $request->get_param( 'client_id' ) );
		$code_verifier = (string) $request->get_param( 'code_verifier' );

		if ( '' === $code || '' === $redirect_uri || '' === $client_id || '' === $code_verifier ) {
			return $this->error( 'invalid_request', __( 'Missing required parameter.', 'presto-player' ), 400 );
		}

		$auth = $this->authenticateClient( $request, $client_id );
		if ( $auth instanceof WP_REST_Response ) {
			return $auth;
		}
		$client = $auth;

		if ( ! $this->codes ) {
			return $this->error( 'invalid_grant', __( 'Storage unavailable.', 'presto-player' ), 400 );
		}

		$code_row = $this->codes->consume( $code );
		if ( ! $code_row ) {
			return $this->error( 'invalid_grant', __( 'Authorization code is invalid or expired.', 'presto-player' ), 400 );
		}

		if ( ! hash_equals( (string) $code_row['client_id'], $client_id ) ) {
			return $this->error( 'invalid_grant', __( 'Authorization code was issued to a different client.', 'presto-player' ), 400 );
		}

		if ( ! hash_equals( (string) $code_row['redirect_uri'], $redirect_uri ) ) {
			return $this->error( 'invalid_grant', __( 'Redirect URI mismatch.', 'presto-player' ), 400 );
		}

		$challenge = isset( $code_row['code_challenge'] ) ? (string) $code_row['code_challenge'] : '';
		$method    = isset( $code_row['code_challenge_method'] ) ? (string) $code_row['code_challenge_method'] : '';
		// Defense-in-depth: only S256 is verified; reject anything else rather than silently passing.
		if ( '' === $challenge || 'S256' !== $method || ! Verifier::verifyS256( $challenge, $code_verifier ) ) {
			return $this->error( 'invalid_grant', __( 'PKCE verification failed.', 'presto-player' ), 400 );
		}

		$scopes  = ScopeHelper::toArray( isset( $code_row['scopes'] ) ? $code_row['scopes'] : '' );
		$user_id = isset( $code_row['user_id'] ) ? (int) $code_row['user_id'] : 0;

		// Defense-in-depth: the code's scopes must be a subset of the client's registered scopes.
		if ( ! $this->scopesWithin( $scopes, $this->registeredScopes( $client ) ) ) {
			return $this->error( 'invalid_scope', __( 'Requested scope exceeds the client registration.', 'presto-player' ), 400 );
		}

		if ( ! $this->tokens || $user_id <= 0 ) {
			return $this->error( 'invalid_grant', __( 'Unable to issue tokens.', 'presto-player' ), 400 );
		}

		// Stamp the absolute lifetime once at authorization; every rotated
		// descendant inherits this same cap.
		$absolute_expires_at = gmdate( 'Y-m-d H:i:s', time() + Constants::REFRESH_TOKEN_ABSOLUTE_TTL );
		$refresh_token       = $this->tokens->issueRefresh( $client_id, $user_id, $scopes, Constants::REFRESH_TOKEN_TTL, null, $absolute_expires_at );
		$access_token        = '' !== $refresh_token
			? $this->tokens->issueAccess( $client_id, $user_id, $scopes, Constants::ACCESS_TOKEN_TTL, Tokens::hash( $refresh_token ) )
			: '';

		// An empty token means the hash never persisted; don't hand out a broken token.
		if ( '' === $access_token || '' === $refresh_token ) {
			return $this->error( 'server_error', __( 'Could not issue tokens.', 'presto-player' ), 500 );
		}

		if ( $this->clients ) {
			$this->clients->touch( $client_id );
		}

		unset( $client );

		return $this->successTokenResponse( $access_token, $refresh_token, $scopes );
	}

	/**
	 * Handles the refresh_token grant.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	protected function handleRefreshToken( WP_REST_Request $request ) {
		$refresh_token = (string) $request->get_param( 'refresh_token' );
		$client_id     = sanitize_text_field( (string) $request->get_param( 'client_id' ) );

		if ( '' === $refresh_token || '' === $client_id ) {
			return $this->error( 'invalid_request', __( 'Missing required parameter.', 'presto-player' ), 400 );
		}

		$auth = $this->authenticateClient( $request, $client_id );
		if ( $auth instanceof WP_REST_Response ) {
			return $auth;
		}
		$client = $auth;

		if ( ! $this->tokens ) {
			return $this->error( 'invalid_grant', __( 'Storage unavailable.', 'presto-player' ), 400 );
		}

		$row = $this->tokens->findByPlaintext( $refresh_token );
		if ( ! $row ) {
			// OAuth 2.1 reuse detection: replaying an already-rotated (revoked)
			// refresh token signals theft, so revoke the live descendant family.
			$reused = $this->tokens->findByPlaintext( $refresh_token, true );
			if ( $reused && 'refresh' === ( isset( $reused['token_type'] ) ? (string) $reused['token_type'] : '' ) && ! empty( $reused['revoked_at'] ) ) {
				$this->tokens->revokeChain( (string) $reused['token_hash'] );
			}
			return $this->error( 'invalid_grant', __( 'Refresh token is invalid or expired.', 'presto-player' ), 400 );
		}

		$token_type = isset( $row['token_type'] ) ? (string) $row['token_type'] : '';
		if ( 'refresh' !== $token_type ) {
			return $this->error( 'invalid_grant', __( 'Token is not a refresh token.', 'presto-player' ), 400 );
		}

		if ( ! hash_equals( (string) $row['client_id'], $client_id ) ) {
			return $this->error( 'invalid_grant', __( 'Refresh token was issued to a different client.', 'presto-player' ), 400 );
		}

		if ( ! empty( $row['expires_at'] ) && strtotime( (string) $row['expires_at'] . ' UTC' ) <= time() ) {
			return $this->error( 'invalid_grant', __( 'Refresh token has expired.', 'presto-player' ), 400 );
		}

		// Absolute cap: once the original authorization is older than the cap,
		// no amount of sliding refreshes keeps it alive. Rows issued before this
		// column existed carry null and are grandfathered in.
		if ( ! empty( $row['absolute_expires_at'] ) && strtotime( (string) $row['absolute_expires_at'] . ' UTC' ) <= time() ) {
			return $this->error( 'invalid_grant', __( 'Authorization has expired; please re-authorize.', 'presto-player' ), 400 );
		}

		$scopes   = ScopeHelper::toArray( isset( $row['scopes'] ) ? $row['scopes'] : '' );
		$user_id  = isset( $row['user_id'] ) ? (int) $row['user_id'] : 0;
		$old_hash = isset( $row['token_hash'] ) ? (string) $row['token_hash'] : Tokens::hash( $refresh_token );

		// Defense-in-depth: the token's scopes must be a subset of the client's registered scopes.
		if ( ! $this->scopesWithin( $scopes, $this->registeredScopes( $client ) ) ) {
			return $this->error( 'invalid_scope', __( 'Requested scope exceeds the client registration.', 'presto-player' ), 400 );
		}

		if ( $user_id <= 0 ) {
			return $this->error( 'invalid_grant', __( 'Unable to issue tokens.', 'presto-player' ), 400 );
		}

		// Atomic single-use gate: only the request that actually flips revoked_at
		// (exactly one row affected) is allowed to mint the next token pair, so two
		// concurrent uses of the same refresh token cannot both rotate.
		if ( 1 !== (int) $this->tokens->revoke( $old_hash ) ) {
			return $this->error( 'invalid_grant', __( 'Refresh token has already been used.', 'presto-player' ), 400 );
		}
		$this->tokens->revokeChain( $old_hash );

		$inherited_absolute = isset( $row['absolute_expires_at'] ) ? (string) $row['absolute_expires_at'] : null;
		$new_refresh_token  = $this->tokens->issueRefresh( $client_id, $user_id, $scopes, Constants::REFRESH_TOKEN_TTL, $old_hash, $inherited_absolute );
		$access_token      = '' !== $new_refresh_token
			? $this->tokens->issueAccess( $client_id, $user_id, $scopes, Constants::ACCESS_TOKEN_TTL, Tokens::hash( $new_refresh_token ) )
			: '';

		// An empty token means the hash never persisted; don't hand out a broken token.
		if ( '' === $access_token || '' === $new_refresh_token ) {
			return $this->error( 'server_error', __( 'Could not issue tokens.', 'presto-player' ), 500 );
		}

		if ( $this->clients ) {
			$this->clients->touch( $client_id );
		}

		return $this->successTokenResponse( $access_token, $new_refresh_token, $scopes );
	}

	/**
	 * Authenticate the client via basic auth header or form params.
	 *
	 * Returns the client row on success, or a WP_REST_Response error.
	 *
	 * @param WP_REST_Request $request   Incoming request.
	 * @param string          $client_id Client id from the request body.
	 * @return array<string, mixed>|WP_REST_Response Client row, or error response.
	 */
	protected function authenticateClient( WP_REST_Request $request, string $client_id ) {
		if ( ! $this->clients ) {
			return $this->error( 'invalid_client', __( 'Client storage unavailable.', 'presto-player' ), 401, true );
		}

		$basic = $this->extractBasicAuth( $request );
		if ( null !== $basic ) {
			if ( '' !== $client_id && ! hash_equals( $basic['client_id'], $client_id ) ) {
				return $this->error( 'invalid_client', __( 'Client credentials mismatch.', 'presto-player' ), 401, true );
			}
			$client_id = $basic['client_id'];
		}

		if ( '' === $client_id ) {
			return $this->error( 'invalid_client', __( 'Client authentication required.', 'presto-player' ), 401, true );
		}

		$client = $this->clients->find( $client_id );
		if ( ! $client ) {
			return $this->error( 'invalid_client', __( 'Unknown client.', 'presto-player' ), 401, true );
		}

		$type = isset( $client['client_type'] ) ? (string) $client['client_type'] : '';
		$hash = isset( $client['client_secret_hash'] ) ? (string) $client['client_secret_hash'] : '';
		if ( 'confidential' === $type || '' !== $hash ) {
			$secret = null !== $basic ? $basic['client_secret'] : (string) $request->get_param( 'client_secret' );
			if ( '' === $secret || '' === $hash || ! wp_check_password( $secret, $hash ) ) {
				return $this->error( 'invalid_client', __( 'Client authentication failed.', 'presto-player' ), 401, true );
			}
		}

		return $client;
	}

	/**
	 * Pull HTTP Basic credentials from the Authorization header.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return array<string, string>|null { client_id, client_secret } or null if not present.
	 */
	protected function extractBasicAuth( WP_REST_Request $request ) {
		$header = $request->get_header( 'authorization' );
		if ( ! $header ) {
			return null;
		}
		if ( 0 !== stripos( $header, 'Basic ' ) ) {
			return null;
		}
		$decoded = base64_decode( substr( $header, 6 ), true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
		if ( false === $decoded || false === strpos( $decoded, ':' ) ) {
			return null;
		}
		[ $id, $secret ] = explode( ':', $decoded, 2 );
		return array(
			'client_id'     => rawurldecode( $id ),
			'client_secret' => rawurldecode( $secret ),
		);
	}

	/**
	 * Build a successful token response per RFC 6749 §5.1.
	 *
	 * @param string             $access_token  Plaintext access token.
	 * @param string             $refresh_token Plaintext refresh token.
	 * @param array<int, string> $scopes        Granted scopes.
	 * @return WP_REST_Response
	 */
	protected function successTokenResponse( string $access_token, string $refresh_token, array $scopes ): WP_REST_Response {
		$body = array(
			'access_token'  => $access_token,
			'token_type'    => 'Bearer',
			'expires_in'    => Constants::ACCESS_TOKEN_TTL,
			'refresh_token' => $refresh_token,
			'scope'         => ScopeHelper::toString( $scopes ),
		);

		$response = new WP_REST_Response( $body, 200 );
		$response->header( 'Cache-Control', 'no-store' );
		$response->header( 'Pragma', 'no-cache' );
		return $response;
	}

	/**
	 * Whether every scope in $requested is contained in $allowed.
	 *
	 * @param string[] $requested Requested or granted scopes.
	 * @param string[] $allowed   Allowed (registered) scopes.
	 * @return bool
	 */
	protected function scopesWithin( array $requested, array $allowed ) {
		foreach ( $requested as $scope ) {
			if ( ! in_array( $scope, $allowed, true ) ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Parse a client's registered scope column into an array.
	 *
	 * A client that registered no scope is treated as `presto:read` only.
	 *
	 * @param array<string, mixed> $client Resolved client row.
	 * @return string[]
	 */
	protected function registeredScopes( array $client ) {
		$raw = isset( $client['scope'] ) ? (string) $client['scope'] : '';
		if ( '' === trim( $raw ) ) {
			return array( Constants::SCOPE_READ );
		}
		return ScopeHelper::toArray( $raw );
	}

	/**
	 * Build an RFC 6749 error response.
	 *
	 * @param string $code        OAuth error code.
	 * @param string $description Human-readable description.
	 * @param int    $status      HTTP status code.
	 * @param bool   $challenge   Add a WWW-Authenticate challenge (for invalid_client).
	 * @return WP_REST_Response
	 */
	protected function error( string $code, string $description, int $status, bool $challenge = false ): WP_REST_Response {
		$response = new WP_REST_Response(
			array(
				'error'             => $code,
				'error_description' => $description,
			),
			$status
		);
		$response->header( 'Cache-Control', 'no-store' );
		$response->header( 'Pragma', 'no-cache' );
		if ( $challenge ) {
			$response->header( 'WWW-Authenticate', sprintf( 'Basic realm="OAuth", error="%s"', $code ) );
		}
		return $response;
	}
}
