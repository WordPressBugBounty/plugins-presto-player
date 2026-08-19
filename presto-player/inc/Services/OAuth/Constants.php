<?php
/**
 * OAuth-related constants.
 *
 * @package PrestoPlayer
 * @subpackage Services\OAuth
 */

namespace PrestoPlayer\Services\OAuth;

/**
 * Central place for OAuth scopes, TTLs and REST path fragments.
 */
class Constants {

	/**
	 * Read-only abilities scope.
	 *
	 * @var string
	 */
	public const SCOPE_READ = 'presto:read';

	/**
	 * Create / update abilities scope.
	 *
	 * @var string
	 */
	public const SCOPE_WRITE = 'presto:write';

	/**
	 * Delete (destructive) abilities scope.
	 *
	 * @var string
	 */
	public const SCOPE_DESTRUCTIVE = 'presto:destructive';

	/**
	 * Settings / license / admin operations scope.
	 *
	 * @var string
	 */
	public const SCOPE_ADMIN = 'presto:admin';

	/**
	 * Access token lifetime in seconds (1 hour).
	 *
	 * @var int
	 */
	public const ACCESS_TOKEN_TTL = 3600;

	/**
	 * Refresh token lifetime in seconds (30 days).
	 *
	 * @var int
	 */
	public const REFRESH_TOKEN_TTL = 2592000;

	/**
	 * Absolute refresh-token lifetime in seconds (90 days). A rotation chain is
	 * refused once it passes this cap measured from the original authorization,
	 * so a client that keeps refreshing can't hold a grant forever.
	 *
	 * @var int
	 */
	public const REFRESH_TOKEN_ABSOLUTE_TTL = 7776000;

	/**
	 * Authorization code lifetime in seconds (10 minutes).
	 *
	 * @var int
	 */
	public const AUTH_CODE_TTL = 600;

	/**
	 * REST namespace shared by every Presto Player route.
	 *
	 * @var string
	 */
	public const REST_NAMESPACE = 'presto-player/v1';

	/**
	 * Base path segment under the namespace for OAuth endpoints.
	 *
	 * @var string
	 */
	public const OAUTH_BASE = 'oauth';

	/**
	 * Site-relative path for the browser-facing consent screen. Served outside
	 * the REST stack (via parse_request) so WordPress core's REST cookie-nonce
	 * check can't log the user out on GET or 403 the consent POST.
	 *
	 * @var string
	 */
	public const AUTHORIZE_PATH = '/presto-player/oauth/authorize';

	/**
	 * The WordPress capability a user must have to grant the given OAuth scope.
	 *
	 * Read/write map to edit_posts; the privileged destructive/admin scopes
	 * require manage_options, so an Editor can't consent a client into deleting
	 * content or changing settings.
	 *
	 * @param string $scope Scope identifier.
	 * @return string Capability name.
	 */
	public static function capabilityForScope( $scope ) {
		switch ( $scope ) {
			case self::SCOPE_ADMIN:
			case self::SCOPE_DESTRUCTIVE:
				return 'manage_options';
			default:
				return 'edit_posts';
		}
	}

	/**
	 * Resolve the full list of allowed OAuth scopes.
	 *
	 * Pro (or third parties) can append their own identifiers via the
	 * `presto_player_oauth_scopes` filter. The four built-in scopes are always
	 * present in the return value regardless of filter mutations.
	 *
	 * @return array<int, string>
	 */
	public static function allowedScopes() {
		$default = array(
			self::SCOPE_READ,
			self::SCOPE_WRITE,
			self::SCOPE_DESTRUCTIVE,
			self::SCOPE_ADMIN,
		);

		/**
		 * Filters the list of allowed OAuth scope identifiers.
		 *
		 * @param array<int, string> $scopes Default scope identifiers.
		 */
		$filtered = apply_filters( 'presto_player_oauth_scopes', $default );
		if ( ! is_array( $filtered ) ) {
			$filtered = array();
		}

		return array_values( array_unique( array_merge( $default, array_filter( array_map( 'strval', $filtered ) ) ) ) );
	}
}
