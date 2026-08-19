<?php
/**
 * Authentication (grouped OAuth classes).
 *
 * @package PrestoPlayer
 * @subpackage Services\OAuth\Authentication
 */

namespace PrestoPlayer\Services\OAuth\Authentication;

use PrestoPlayer\Contracts\Service;
use PrestoPlayer\Services\Abilities\Ability;
use PrestoPlayer\Services\OAuth\Constants;
use PrestoPlayer\Services\OAuth\Storage\ClientRepository;
use PrestoPlayer\Services\OAuth\Storage\ScopeHelper;
use PrestoPlayer\Services\OAuth\Storage\TokenRepository;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * Authenticates incoming REST requests carrying an OAuth access token.
 *
 * Hooks into `rest_authentication_errors` at priority 99 so that any earlier
 * authentication method (cookies, application passwords) gets a chance first.
 * When no other auth produced a logged-in user and the request carries a
 * Bearer token, this class validates it and sets the current user.
 *
 * The successfully-authenticated request context (scopes, client_id, token_id)
 * is stashed in a static property so {@see ScopeGuard} can consult it later
 * during per-ability permission checks.
 */
class BearerAuthenticator implements Service {

	/**
	 * Active Bearer authentication context for the current request.
	 *
	 * Keys: 'scopes' (array), 'client_id' (string), 'token_id' (string), 'user_id' (int).
	 *
	 * @var array<string, mixed>|null
	 */
	protected static $active_context = null;

	/**
	 * Token repository — supplies the lookup-by-plaintext primitive.
	 *
	 * @var TokenRepository
	 */
	protected $tokens;

	/**
	 * Client repository — touched on every successful authentication.
	 *
	 * @var ClientRepository
	 */
	protected $clients;

	/**
	 * DI-friendly constructor. Falls back to default repository implementations
	 * when nothing is injected so this service stays usable from manual wiring.
	 *
	 * @param TokenRepository|null  $tokens  Token repository.
	 * @param ClientRepository|null $clients Client repository.
	 */
	public function __construct( $tokens = null, $clients = null ) {
		$this->tokens  = $tokens instanceof TokenRepository ? $tokens : new TokenRepository();
		$this->clients = $clients instanceof ClientRepository ? $clients : new ClientRepository();
	}

	/**
	 * Hook into WordPress.
	 *
	 * Priority 99 lets cookie / application password auth run first; we only
	 * step in when nothing else produced a logged-in user.
	 *
	 * @return void
	 */
	public function register() {
		add_filter( 'rest_authentication_errors', array( $this, 'authenticate' ), 99 );
		add_filter( 'rest_pre_dispatch', array( $this, 'restrictToNamespace' ), 10, 3 );
	}

	/**
	 * Confine Bearer-authenticated requests to the OAuth-governed surface.
	 *
	 * A Bearer token is only meant to drive the MCP transport and the abilities
	 * catalog — the routes where OAuth scopes are actually enforced (via
	 * {@see ScopeGuard}). The rest of the `presto-player/v1` namespace contains
	 * write-capable controllers (videos, presets, settings, license, plugin
	 * installer) gated purely by `current_user_can()`, so allowing the whole
	 * namespace would let a `presto:read` token reach privileged writes once
	 * `wp_set_current_user()` set an admin. We therefore restrict to the MCP /
	 * abilities routes rather than the entire namespace.
	 *
	 * Gates on the request-global {@see BearerAuthenticator::isBearerAuth()}
	 * signal (not instance state) so the check stays correct even if this
	 * service is resolved as a non-shared binding.
	 *
	 * @param mixed            $result  Existing dispatch result.
	 * @param \WP_REST_Server  $server  REST server instance.
	 * @param \WP_REST_Request $request Current request.
	 * @return mixed
	 */
	public function restrictToNamespace( $result, $server, $request ) {
		if ( ! static::isBearerAuth() ) {
			return $result;
		}

		if ( $this->isAllowedBearerRoute( $request->get_route() ) ) {
			return $result;
		}

		return new \WP_Error(
			'rest_forbidden',
			__( 'This token is not permitted to access this route.', 'presto-player' ),
			array( 'status' => 403 )
		);
	}

	/**
	 * Whether a route is part of the OAuth-governed surface a Bearer token may use.
	 *
	 * Limited to the MCP transport route (and its sub-paths), the abilities
	 * catalog, and the OAuth endpoints needed to manage the session itself.
	 *
	 * @param string $route Requested REST route path.
	 * @return bool
	 */
	protected function isAllowedBearerRoute( $route ) {
		$route     = '/' . ltrim( (string) $route, '/' );
		$namespace = '/' . Constants::REST_NAMESPACE;
		$mcp_base  = $namespace . '/mcp';

		if ( $mcp_base === $route || 0 === strpos( $route, $mcp_base . '/' ) ) {
			return true;
		}

		if ( $namespace . '/abilities' === $route ) {
			return true;
		}

		// OAuth endpoints (token, revoke, register) stay reachable so a client
		// holding a Presto token can always refresh or drop its session. They
		// are public routes with their own client-secret / throttle checks, so
		// the bearer-set user grants nothing extra there.
		$oauth_base = $namespace . '/' . Constants::OAUTH_BASE;
		if ( $oauth_base === $route || 0 === strpos( $route, $oauth_base . '/' ) ) {
			return true;
		}

		return false;
	}

	/**
	 * REST authentication filter callback.
	 *
	 * Contract:
	 * - return `null` to defer to the next auth method,
	 * - return `true` to mark the request as authenticated,
	 * - return `WP_Error` to hard-fail authentication.
	 *
	 * @param mixed $result Existing result from earlier filters.
	 * @return mixed
	 */
	public function authenticate( $result ) {
		if ( null !== $result && ! $this->isNotLoggedInError( $result ) ) {
			return $result;
		}

		$header = $this->readAuthorizationHeader();
		if ( '' === $header ) {
			return $result;
		}

		$token = $this->extractBearerToken( $header );
		if ( '' === $token ) {
			return $result;
		}

		$row = $this->tokens->findByPlaintext( $token );
		if ( ! is_array( $row ) || empty( $row['user_id'] ) || ! isset( $row['token_type'] ) || 'access' !== $row['token_type'] ) {
			return $this->rejectOrDefer( $token, $result );
		}

		$user_id = (int) $row['user_id'];
		wp_set_current_user( $user_id );

		static::$active_context = array(
			'scopes'    => ScopeHelper::toArray( isset( $row['scopes'] ) ? $row['scopes'] : '' ),
			'client_id' => isset( $row['client_id'] ) ? (string) $row['client_id'] : '',
			'token_id'  => isset( $row['token_hash'] ) ? (string) $row['token_hash'] : '',
			'user_id'   => $user_id,
		);

		if ( ! empty( static::$active_context['client_id'] ) ) {
			$this->clients->touch( static::$active_context['client_id'] );
		}

		return true;
	}

	/**
	 * Decide what to do with a Bearer token that isn't a live Presto access token.
	 *
	 * A Bearer value we've never issued belongs to some other auth plugin (JWT,
	 * headless frontends, etc.) — defer so their handler can claim it. Only a
	 * token that IS ours but stale (expired / revoked / wrong type) hard-fails,
	 * and only on our own namespace; the OAuth endpoints stay open even then so
	 * the client can refresh or revoke its way back to a working session.
	 *
	 * @param string $token  Bearer token from the request.
	 * @param mixed  $result Existing result from earlier filters.
	 * @return mixed
	 */
	protected function rejectOrDefer( $token, $result ) {
		$known = $this->tokens->findByPlaintext( $token, true );
		if ( ! is_array( $known ) ) {
			return $result;
		}

		$route = $this->currentRestRoute();
		if ( 0 === strpos( $route, '/' . Constants::REST_NAMESPACE . '/' ) && ! $this->isOauthRoute( $route ) ) {
			return new \WP_Error(
				'rest_invalid_bearer_token',
				__( 'Bearer token invalid or expired', 'presto-player' ),
				array( 'status' => 401 )
			);
		}

		return $result;
	}

	/**
	 * Whether a route is one of our OAuth endpoints.
	 *
	 * @param string $route Requested REST route path.
	 * @return bool
	 */
	protected function isOauthRoute( $route ) {
		$oauth_base = '/' . Constants::REST_NAMESPACE . '/' . Constants::OAUTH_BASE;
		return $oauth_base === $route || 0 === strpos( $route, $oauth_base . '/' );
	}

	/**
	 * Current REST route path.
	 *
	 * `rest_authentication_errors` fires without the request object, so read
	 * the route from the query var (set for both pretty and plain permalinks),
	 * falling back to the request path.
	 *
	 * @return string
	 */
	protected function currentRestRoute() {
		$route = '';

		if ( isset( $GLOBALS['wp']->query_vars['rest_route'] ) && '' !== $GLOBALS['wp']->query_vars['rest_route'] ) {
			$route = (string) $GLOBALS['wp']->query_vars['rest_route'];
		} elseif ( ! empty( $_SERVER['REQUEST_URI'] ) ) {
			$path   = (string) wp_parse_url( sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ), PHP_URL_PATH );
			$prefix = '/' . rest_get_url_prefix() . '/';
			$pos    = strpos( $path, $prefix );
			if ( false !== $pos ) {
				$route = substr( $path, $pos + strlen( $prefix ) - 1 );
			}
		}

		return '/' . ltrim( $route, '/' );
	}

	/**
	 * Read the Authorization header across the various PHP SAPIs.
	 *
	 * PHP-FPM frequently strips the Authorization header on its way through
	 * mod_rewrite. The common workaround is an .htaccess rule:
	 *
	 *   RewriteEngine On
	 *   RewriteCond %{HTTP:Authorization} ^(.*)
	 *   RewriteRule .* - [E=HTTP_AUTHORIZATION:%1]
	 *
	 * which lands the value in `REDIRECT_HTTP_AUTHORIZATION`. We sniff every
	 * known location so the middleware works on Apache, nginx + FPM, LiteSpeed,
	 * and the WP built-in server.
	 *
	 * @return string Raw header value or empty string when absent.
	 */
	protected function readAuthorizationHeader() {
		if ( ! empty( $_SERVER['HTTP_AUTHORIZATION'] ) ) {
			return trim( sanitize_text_field( wp_unslash( $_SERVER['HTTP_AUTHORIZATION'] ) ) );
		}

		if ( ! empty( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) ) {
			return trim( sanitize_text_field( wp_unslash( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) ) );
		}

		$env_value = getenv( 'REDIRECT_HTTP_AUTHORIZATION' );
		if ( is_string( $env_value ) && '' !== $env_value ) {
			return trim( $env_value );
		}

		if ( function_exists( 'apache_request_headers' ) ) {
			$apache = apache_request_headers();
			if ( is_array( $apache ) ) {
				$value = $this->pickHeader( $apache, 'authorization' );
				if ( '' !== $value ) {
					return $value;
				}
			}
		}

		if ( function_exists( 'getallheaders' ) ) {
			$all = getallheaders();
			if ( is_array( $all ) ) {
				$value = $this->pickHeader( $all, 'authorization' );
				if ( '' !== $value ) {
					return $value;
				}
			}
		}

		return '';
	}

	/**
	 * Case-insensitive lookup over a header bag.
	 *
	 * @param array<string, mixed> $headers Header name => value map.
	 * @param string               $needle  Lowercased header name to find.
	 * @return string
	 */
	protected function pickHeader( array $headers, $needle ) {
		foreach ( $headers as $name => $value ) {
			if ( strtolower( (string) $name ) === $needle ) {
				return trim( (string) $value );
			}
		}
		return '';
	}

	/**
	 * Pull the token portion out of a `Bearer <token>` header.
	 *
	 * @param string $header Authorization header value.
	 * @return string Token or empty string when the scheme is not Bearer.
	 */
	protected function extractBearerToken( $header ) {
		if ( ! preg_match( '/^\s*Bearer\s+([A-Za-z0-9\-_]+)\s*$/i', $header, $matches ) ) {
			return '';
		}
		return $matches[1];
	}

	/**
	 * Detect the WordPress "not logged in" sentinel so we know nobody else has
	 * authenticated this request yet.
	 *
	 * @param mixed $result Filter result.
	 * @return bool
	 */
	protected function isNotLoggedInError( $result ) {
		if ( ! is_wp_error( $result ) ) {
			return false;
		}
		return 'rest_not_logged_in' === $result->get_error_code();
	}

	/**
	 * Read the active Bearer authentication context.
	 *
	 * @return array<string, mixed>|null
	 */
	public static function getActiveContext() {
		return static::$active_context;
	}

	/**
	 * Whether the current request was authenticated via Bearer token.
	 *
	 * @return bool
	 */
	public static function isBearerAuth() {
		return null !== static::$active_context;
	}

	/**
	 * Reset the static context — primarily intended for test teardown.
	 *
	 * @return void
	 */
	public static function resetActiveContext() {
		static::$active_context = null;
	}
}

/**
 * Returns a 401 + Bearer challenge on unauthenticated MCP requests.
 *
 * Hooks `rest_pre_dispatch`, which runs before route matching and before the
 * MCP transport's own permission callback. The request path is inspected and,
 * when it targets the protected MCP transport route (but not the public
 * discovery sub-routes), an authentication check is performed. The check
 * succeeds when either a cookie/application-password session is active or a
 * valid Bearer token established a context via {@see BearerAuthenticator}.
 */
class ChallengeResponder implements Service {

	/**
	 * Hook into WordPress.
	 *
	 * Priority 100 lets {@see BearerAuthenticator} (on `rest_authentication_errors`)
	 * resolve any presented token first, so its context is populated before the
	 * dispatch filter consults it.
	 *
	 * @return void
	 */
	public function register() {
		add_filter( 'rest_pre_dispatch', array( $this, 'maybeChallenge' ), 100, 3 );
	}

	/**
	 * Short-circuit unauthenticated MCP requests with a 401 challenge.
	 *
	 * @param mixed           $result  Existing pre-dispatch result (null when nothing hijacked the request).
	 * @param WP_REST_Server  $server  REST server instance (unused).
	 * @param WP_REST_Request $request Incoming request.
	 * @return mixed Original result, or a WP_REST_Response carrying the 401 challenge.
	 */
	public function maybeChallenge( $result, $server, $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter
		if ( null !== $result ) {
			return $result;
		}

		if ( ! $request instanceof WP_REST_Request ) {
			return $result;
		}

		if ( ! $this->isProtectedMcpRoute( $request->get_route() ) ) {
			return $result;
		}

		if ( $this->isAuthenticated() ) {
			return $result;
		}

		return $this->challengeResponse();
	}

	/**
	 * Whether the request path targets the protected MCP transport route.
	 *
	 * Matches the transport base (`/presto-player/v1/mcp`) and any session
	 * sub-path, while leaving the public discovery sub-routes (`/mcp/info`)
	 * and every OAuth endpoint reachable without a token.
	 *
	 * @param string $route Requested REST route path.
	 * @return bool
	 */
	protected function isProtectedMcpRoute( $route ) {
		$route = '/' . ltrim( (string) $route, '/' );
		$base  = '/' . Constants::REST_NAMESPACE . '/mcp';

		if ( $base !== $route && 0 !== strpos( $route, $base . '/' ) ) {
			return false;
		}

		// Public discovery descriptor stays open.
		if ( $base . '/info' === $route ) {
			return false;
		}

		return true;
	}

	/**
	 * Whether the current request is authenticated.
	 *
	 * Accepts an active WordPress session (cookie / application password) or a
	 * Bearer token that {@see BearerAuthenticator} already validated for this
	 * request.
	 *
	 * @return bool
	 */
	protected function isAuthenticated() {
		if ( is_user_logged_in() ) {
			return true;
		}

		return BearerAuthenticator::isBearerAuth();
	}

	/**
	 * Build the 401 response carrying the RFC 9728 Bearer challenge.
	 *
	 * @return WP_REST_Response
	 */
	protected function challengeResponse() {
		$response = new WP_REST_Response(
			array(
				'code'    => 'presto_player_mcp_unauthorized',
				'message' => __( 'Authentication required to access the Presto Player MCP endpoint.', 'presto-player' ),
				'data'    => array( 'status' => 401 ),
			),
			401
		);

		$response->header( 'WWW-Authenticate', $this->challengeHeader() );
		$response->header( 'Cache-Control', 'no-store' );

		return $response;
	}

	/**
	 * Compose the `WWW-Authenticate: Bearer` header value.
	 *
	 * Includes a realm plus the `resource_metadata` pointer to the RFC 9728
	 * protected-resource document so clients can auto-discover the auth server.
	 *
	 * @return string
	 */
	protected function challengeHeader() {
		$metadata = home_url( '/.well-known/oauth-protected-resource' );

		return sprintf(
			'Bearer realm="%1$s", resource_metadata="%2$s"',
			esc_url_raw( untrailingslashit( home_url( '/' ) ) ),
			esc_url_raw( $metadata )
		);
	}
}

/**
 * Enforces OAuth scope requirements on individual abilities.
 *
 * Integration note:
 * `Ability::getConfig()` calls {@see ScopeGuard::wrapPermissionCallback()}
 * on the `permission_callback` it returns, so every concrete ability picks up
 * the scope guard transparently.
 *
 * Scope hierarchy:
 *   presto:admin       > everything
 *   presto:destructive > presto:write > presto:read
 *
 * `presto:admin` is a superset that grants every other scope. `presto:write`
 * implies `presto:read` (writers can read). `presto:destructive` is treated as
 * the highest non-admin tier and implies write + read. The hierarchy is
 * deliberately small and intentional — keep it lean unless a real need arises.
 */
class ScopeGuard {

	/**
	 * Map of scope → set of scopes it satisfies (including itself).
	 *
	 * Computed once via {@see self::hierarchy()} so callers don't pay the cost
	 * on every check.
	 *
	 * @var array<string, array<string, bool>>|null
	 */
	protected static $hierarchy_cache = null;

	/**
	 * Determine the scope required to invoke a given ability.
	 *
	 * @param Ability $ability Ability instance.
	 * @return string One of the `Constants::SCOPE_*` values.
	 */
	public static function requiredScopeForAbility( Ability $ability ) {
		$annotations = $ability->getAnnotations();

		if ( ! is_array( $annotations ) ) {
			$annotations = array();
		}

		if ( ! empty( $annotations['admin'] ) ) {
			return Constants::SCOPE_ADMIN;
		}

		if ( ! empty( $annotations['destructive'] ) ) {
			return Constants::SCOPE_DESTRUCTIVE;
		}

		if ( ! empty( $annotations['readonly'] ) ) {
			return Constants::SCOPE_READ;
		}

		return Constants::SCOPE_WRITE;
	}

	/**
	 * Check whether the active token (if any) covers the required scope.
	 *
	 * When the request is not Bearer-authenticated (e.g. cookie auth from
	 * wp-admin) we delegate to the underlying WordPress capability check by
	 * returning true — the ability's existing permission callback still
	 * runs and gates access via `current_user_can()`.
	 *
	 * @param string $required Required scope (e.g. `presto:write`).
	 * @return bool
	 */
	public static function tokenHasScope( $required ) {
		$context = BearerAuthenticator::getActiveContext();
		if ( null === $context ) {
			return true;
		}

		$granted = isset( $context['scopes'] ) && is_array( $context['scopes'] ) ? $context['scopes'] : array();
		if ( empty( $granted ) ) {
			return false;
		}

		$hierarchy = self::hierarchy();

		foreach ( $granted as $scope ) {
			$scope = is_string( $scope ) ? $scope : '';
			if ( '' === $scope ) {
				continue;
			}
			if ( isset( $hierarchy[ $scope ][ $required ] ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Combine scope lookup with enforcement.
	 *
	 * Returns `true` when the call is allowed, or a `WP_Error` with HTTP 403
	 * that the REST stack will surface verbatim to the caller.
	 *
	 * @param Ability $ability Ability being invoked.
	 * @return true|\WP_Error
	 */
	public static function assertScope( Ability $ability ) {
		$required = self::requiredScopeForAbility( $ability );
		if ( self::tokenHasScope( $required ) ) {
			return true;
		}

		return new \WP_Error(
			'insufficient_scope',
			sprintf(
				/* translators: %s: required OAuth scope. */
				__( 'Token missing required scope: %s', 'presto-player' ),
				$required
			),
			array( 'status' => 403 )
		);
	}

	/**
	 * Wrap an existing permission callback with a scope pre-check.
	 *
	 * Returns a new closure that:
	 *   1. Runs the scope check against the active Bearer context (if any).
	 *      - On failure, returns the `WP_Error` straight away.
	 *   2. Falls through to the original permission callback for the usual
	 *      capability check.
	 *
	 * @param callable $original Existing permission callback.
	 * @param Ability  $ability  Ability instance (for scope lookup).
	 * @return callable
	 */
	public static function wrapPermissionCallback( callable $original, Ability $ability ) {
		return function ( ...$args ) use ( $original, $ability ) {
			$scope_result = self::assertScope( $ability );
			if ( is_wp_error( $scope_result ) ) {
				return $scope_result;
			}
			return call_user_func_array( $original, $args );
		};
	}

	/**
	 * Build the scope-implies map.
	 *
	 * The map is keyed by the granted scope; the inner map enumerates every
	 * required scope it satisfies. This shape makes `tokenHasScope()` a
	 * single isset() lookup per granted scope.
	 *
	 * @return array<string, array<string, bool>>
	 */
	protected static function hierarchy() {
		if ( null !== self::$hierarchy_cache ) {
			return self::$hierarchy_cache;
		}

		$read        = Constants::SCOPE_READ;
		$write       = Constants::SCOPE_WRITE;
		$destructive = Constants::SCOPE_DESTRUCTIVE;
		$admin       = Constants::SCOPE_ADMIN;

		self::$hierarchy_cache = array(
			$read        => array(
				$read => true,
			),
			$write       => array(
				$read  => true,
				$write => true,
			),
			$destructive => array(
				$read        => true,
				$write       => true,
				$destructive => true,
			),
			$admin       => array(
				$read        => true,
				$write       => true,
				$destructive => true,
				$admin       => true,
			),
		);

		return self::$hierarchy_cache;
	}
}
