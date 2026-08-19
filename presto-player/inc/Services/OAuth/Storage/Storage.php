<?php
/**
 * Storage (grouped OAuth classes).
 *
 * @package PrestoPlayer
 * @subpackage Services\OAuth\Storage
 */

namespace PrestoPlayer\Services\OAuth\Storage;

use PrestoPlayer\Services\OAuth\Helpers\Tokens;

/**
 * $wpdb-backed repository.
 */
class ClientRepository {

	/**
	 * Fully qualified clients table name.
	 *
	 * @var string
	 */
	protected $table;

	/**
	 * Cache the table name once per request.
	 */
	public function __construct() {
		global $wpdb;
		$this->table = $wpdb->prefix . 'presto_oauth_clients';
	}

	/**
	 * Create a new client record.
	 *
	 * @param array<string, mixed> $metadata Client metadata (client_name, redirect_uris, client_type, scope, software_id).
	 * @return array<string, mixed> Stored row plus plaintext client_secret when applicable.
	 */
	public function create( array $metadata ) {
		global $wpdb;

		$client_name   = isset( $metadata['client_name'] ) ? (string) $metadata['client_name'] : '';
		$client_type   = isset( $metadata['client_type'] ) ? (string) $metadata['client_type'] : 'public';
		$software_id   = isset( $metadata['software_id'] ) ? (string) $metadata['software_id'] : null;
		$scope         = isset( $metadata['scope'] ) ? trim( (string) $metadata['scope'] ) : '';
		$redirect_uris = isset( $metadata['redirect_uris'] ) ? $metadata['redirect_uris'] : array();

		if ( ! is_array( $redirect_uris ) ) {
			return array();
		}

		if ( ! in_array( $client_type, array( 'public', 'confidential' ), true ) ) {
			$client_type = 'public';
		}

		$redirect_json = wp_json_encode( array_values( $redirect_uris ) );
		if ( false === $redirect_json ) {
			return array();
		}

		$client_id        = Tokens::generateOpaqueToken( 32 );
		$plaintext_secret = null;
		$secret_hash      = null;

		if ( 'confidential' === $client_type ) {
			$plaintext_secret = Tokens::generateOpaqueToken( 32 );
			$secret_hash      = wp_hash_password( $plaintext_secret );
		}

		$now = gmdate( 'Y-m-d H:i:s' );

		$row = array(
			'client_id'          => $client_id,
			'client_secret_hash' => $secret_hash,
			'client_name'        => $client_name,
			'client_type'        => $client_type,
			'redirect_uris'      => $redirect_json,
			'scope'              => $scope,
			'software_id'        => $software_id,
			'created_at'         => $now,
			'last_used_at'       => null,
		);

		$formats = array( '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s' );

		$inserted = $wpdb->insert( $this->table, $row, $formats ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
		if ( false === $inserted ) {
			return array();
		}

		$record = $this->find( $client_id );
		if ( null === $record ) {
			return array();
		}

		if ( null !== $plaintext_secret ) {
			$record['client_secret'] = $plaintext_secret;
		}

		return $record;
	}

	/**
	 * Look up a client by its public identifier.
	 *
	 * @param string $client_id Client identifier returned from {@see self::create()}.
	 * @return array<string, mixed>|null Row as associative array, or null when not found.
	 */
	public function find( string $client_id ) {
		global $wpdb;

		if ( '' === $client_id ) {
			return null;
		}

		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$this->table} WHERE client_id = %s LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$client_id
			),
			ARRAY_A
		); // phpcs:ignore WordPress.DB.DirectDatabaseQuery

		return $row ? $row : null;
	}

	/**
	 * Update the last_used_at timestamp on a successful token exchange.
	 *
	 * @param string $client_id Client identifier.
	 * @return void
	 */
	public function touch( string $client_id ) {
		global $wpdb;

		if ( '' === $client_id ) {
			return;
		}

		$wpdb->update( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$this->table,
			array( 'last_used_at' => gmdate( 'Y-m-d H:i:s' ) ),
			array( 'client_id' => $client_id ),
			array( '%s' ),
			array( '%s' )
		);
	}
}

/**
 * $wpdb-backed repository.
 */
class CodeRepository {

	/**
	 * Fully qualified codes table name.
	 *
	 * @var string
	 */
	protected $table;

	/**
	 * Cache the table name once per request.
	 */
	public function __construct() {
		global $wpdb;
		$this->table = $wpdb->prefix . 'presto_oauth_codes';
	}

	/**
	 * Issue a one-time authorization code.
	 *
	 * @param string             $client_id    Client identifier.
	 * @param int                $user_id      WordPress user id who granted consent.
	 * @param array<int, string> $scopes       Granted scopes.
	 * @param string             $redirect_uri Redirect URI used in /authorize.
	 * @param string|null        $challenge    PKCE code challenge, if any.
	 * @param string|null        $method       PKCE method ("S256" or "plain"), if any.
	 * @param int                $ttl          Lifetime in seconds.
	 * @return string Plaintext authorization code.
	 */
	public function issue(
		string $client_id,
		int $user_id,
		array $scopes,
		string $redirect_uri,
		?string $challenge,
		?string $method,
		int $ttl = 600
	) {
		global $wpdb;

		if ( $ttl < 1 ) {
			$ttl = 600;
		}

		$plaintext = Tokens::generateOpaqueToken( 32 );
		$hash      = Tokens::hash( $plaintext );

		$row = array(
			'code_hash'             => $hash,
			'client_id'             => $client_id,
			'user_id'               => $user_id,
			'scopes'                => ScopeHelper::toString( $scopes ),
			'code_challenge'        => $challenge,
			'code_challenge_method' => $method,
			'redirect_uri'          => $redirect_uri,
			'expires_at'            => gmdate( 'Y-m-d H:i:s', time() + $ttl ),
			'used_at'               => null,
		);

		$formats = array( '%s', '%s', '%d', '%s', '%s', '%s', '%s', '%s', '%s' );

		$inserted = $wpdb->insert( $this->table, $row, $formats ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
		if ( false === $inserted ) {
			// Persisting the hash failed; '' signals the caller not to hand out an unstored code.
			return '';
		}

		return $plaintext;
	}

	/**
	 * Atomically mark a code used and return its row.
	 *
	 * @param string $plaintext Code received from the client.
	 * @return array<string, mixed>|null Row data on success, null otherwise.
	 */
	public function consume( string $plaintext ) {
		global $wpdb;

		if ( '' === $plaintext ) {
			return null;
		}

		$hash = Tokens::hash( $plaintext );
		$now  = gmdate( 'Y-m-d H:i:s' );

		$affected = $wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->prepare(
				"UPDATE {$this->table} SET used_at = %s WHERE code_hash = %s AND used_at IS NULL AND expires_at > %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$now,
				$hash,
				$now
			)
		);

		if ( ! $affected ) {
			return null;
		}

		$row = $wpdb->get_row( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->prepare(
				"SELECT * FROM {$this->table} WHERE code_hash = %s LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$hash
			),
			ARRAY_A
		);

		return $row ? $row : null;
	}
}

/**
 * $wpdb-backed repository.
 */
class TokenRepository {

	/**
	 * Fully qualified tokens table name.
	 *
	 * @var string
	 */
	protected $table;

	/**
	 * Cache the table name once per request.
	 */
	public function __construct() {
		global $wpdb;
		$this->table = $wpdb->prefix . 'presto_oauth_tokens';
	}

	/**
	 * Issue a new access token.
	 *
	 * @param string             $client_id Client identifier.
	 * @param int                $user_id   WordPress user id.
	 * @param array<int, string> $scopes    Granted scopes.
	 * @param int                $ttl       Lifetime in seconds.
	 * @param string|null        $parent    Issuing refresh-token hash for chain revocation.
	 * @return string Plaintext access token.
	 */
	public function issueAccess( string $client_id, int $user_id, array $scopes, int $ttl, ?string $parent = null ) {
		return $this->insertToken( 'access', $client_id, $user_id, $scopes, $ttl, $parent );
	}

	/**
	 * Issue a refresh token, optionally chained to a parent token.
	 *
	 * @param string             $client_id Client identifier.
	 * @param int                $user_id   WordPress user id.
	 * @param array<int, string> $scopes    Granted scopes.
	 * @param int                $ttl       Lifetime in seconds.
	 * @param string|null        $parent    Parent refresh-token hash for rotation.
	 * @param string|null        $absolute_expires_at Absolute expiry (UTC 'Y-m-d H:i:s') carried across the whole rotation chain; null for no cap.
	 * @return string Plaintext refresh token.
	 */
	public function issueRefresh( string $client_id, int $user_id, array $scopes, int $ttl, ?string $parent = null, ?string $absolute_expires_at = null ) {
		return $this->insertToken( 'refresh', $client_id, $user_id, $scopes, $ttl, $parent, $absolute_expires_at );
	}

	/**
	 * Shared insertion path for both token types.
	 *
	 * @param string             $type     'access' or 'refresh'.
	 * @param string             $client_id Client identifier.
	 * @param int                $user_id   WordPress user id.
	 * @param array<int, string> $scopes   Granted scopes.
	 * @param int                $ttl      Lifetime in seconds.
	 * @param string|null        $parent   Parent refresh token hash.
	 * @param string|null        $absolute_expires_at Absolute expiry (UTC 'Y-m-d H:i:s'), or null for no cap.
	 * @return string Plaintext token.
	 */
	protected function insertToken( $type, $client_id, $user_id, array $scopes, $ttl, $parent, $absolute_expires_at = null ) {
		global $wpdb;

		if ( $ttl < 1 ) {
			$ttl = 3600;
		}

		$plaintext = Tokens::generateOpaqueToken( 32 );
		$hash      = Tokens::hash( $plaintext );
		$now       = gmdate( 'Y-m-d H:i:s' );

		$row = array(
			'token_hash'          => $hash,
			'token_type'          => $type,
			'client_id'           => $client_id,
			'user_id'             => (int) $user_id,
			'scopes'              => ScopeHelper::toString( $scopes ),
			'expires_at'          => gmdate( 'Y-m-d H:i:s', time() + $ttl ),
			'revoked_at'          => null,
			'created_at'          => $now,
			'parent_token_hash'   => $parent,
			'absolute_expires_at' => $absolute_expires_at,
		);

		$formats = array( '%s', '%s', '%s', '%d', '%s', '%s', '%s', '%s', '%s', '%s' );

		$inserted = $wpdb->insert( $this->table, $row, $formats ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
		if ( false === $inserted ) {
			// Persisting the hash failed; '' signals the caller not to hand out an unstored token.
			return '';
		}

		return $plaintext;
	}

	/**
	 * Look up a token by plaintext.
	 *
	 * @param string $token           Plaintext token from Authorization header.
	 * @param bool   $include_revoked Match revoked/expired rows too (for reuse detection).
	 * @return array<string, mixed>|null Row data or null.
	 */
	public function findByPlaintext( string $token, bool $include_revoked = false ) {
		global $wpdb;

		if ( '' === $token ) {
			return null;
		}

		$hash = Tokens::hash( $token );

		if ( $include_revoked ) {
			$row = $wpdb->get_row( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->prepare(
					"SELECT * FROM {$this->table} WHERE token_hash = %s LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
					$hash
				),
				ARRAY_A
			);

			return $row ? $row : null;
		}

		$now = gmdate( 'Y-m-d H:i:s' );

		$row = $wpdb->get_row( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->prepare(
				"SELECT * FROM {$this->table} WHERE token_hash = %s AND revoked_at IS NULL AND expires_at > %s LIMIT 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$hash,
				$now
			),
			ARRAY_A
		);

		return $row ? $row : null;
	}

	/**
	 * Revoke a single token by its hash.
	 *
	 * Returns the number of rows affected so callers can use it as an atomic
	 * single-use gate: a token already revoked by a concurrent request yields 0.
	 *
	 * @param string $token_hash sha256 hex of the token.
	 * @return int Rows affected (0 or 1).
	 */
	public function revoke( string $token_hash ) {
		global $wpdb;

		if ( '' === $token_hash ) {
			return 0;
		}

		$affected = $wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->prepare(
				"UPDATE {$this->table} SET revoked_at = %s WHERE token_hash = %s AND revoked_at IS NULL", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				gmdate( 'Y-m-d H:i:s' ),
				$token_hash
			)
		);

		return is_numeric( $affected ) ? (int) $affected : 0;
	}

	/**
	 * Revoke a refresh token and every descendant in its rotation chain.
	 *
	 * Walks the parent_token_hash chain breadth-first and issues a single bulk
	 * UPDATE per level. Bounded loop prevents accidental runaway on a corrupt
	 * graph.
	 *
	 * @param string $root_hash sha256 hex of the root refresh token.
	 * @return void
	 */
	public function revokeChain( string $root_hash ) {
		global $wpdb;

		if ( '' === $root_hash ) {
			return;
		}

		$this->revoke( $root_hash );

		$frontier = array( $root_hash );
		$visited  = array( $root_hash => true );
		$now      = gmdate( 'Y-m-d H:i:s' );
		$depth    = 0;

		while ( ! empty( $frontier ) && $depth < 64 ) {
			$placeholders = implode( ',', array_fill( 0, count( $frontier ), '%s' ) );

			$args = array_merge( array( $now ), $frontier );
			$wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->prepare(
					"UPDATE {$this->table} SET revoked_at = %s WHERE revoked_at IS NULL AND parent_token_hash IN ($placeholders)", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
					$args
				)
			);

			$select_args = $frontier;
			$next        = $wpdb->get_col( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->prepare(
					"SELECT token_hash FROM {$this->table} WHERE parent_token_hash IN ($placeholders)", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
					$select_args
				)
			);

			$frontier = array();
			if ( is_array( $next ) ) {
				foreach ( $next as $hash ) {
					if ( ! isset( $visited[ $hash ] ) ) {
						$visited[ $hash ] = true;
						$frontier[]       = $hash;
					}
				}
			}
			++$depth;
		}
	}
}

/**
 * Converts OAuth scopes between the space-separated string used in storage and
 * a plain PHP array used at runtime.
 */
class ScopeHelper {

	/**
	 * Serialize a scope array to the storage format.
	 *
	 * Duplicates and empty entries are dropped. Order is preserved for the
	 * first occurrence of each scope.
	 *
	 * @param array<int, string> $scopes List of scope strings.
	 * @return string Space-separated scope list.
	 */
	public static function toString( array $scopes ) {
		$clean = array();
		foreach ( $scopes as $scope ) {
			$scope = is_string( $scope ) ? trim( $scope ) : '';
			if ( '' === $scope ) {
				continue;
			}
			if ( ! in_array( $scope, $clean, true ) ) {
				$clean[] = $scope;
			}
		}
		return implode( ' ', $clean );
	}

	/**
	 * Parse a stored scope string back into an array.
	 *
	 * @param string|null $scopes Stored scope string.
	 * @return array<int, string> List of scope strings.
	 */
	public static function toArray( $scopes ) {
		if ( ! is_string( $scopes ) || '' === trim( $scopes ) ) {
			return array();
		}
		$parts = preg_split( '/\s+/', trim( $scopes ) );
		if ( false === $parts ) {
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
}

/**
 * Atomic fixed-window rate limiter for the open DCR endpoint.
 *
 * Stores each window's count in an autoloaded-off option and bumps it with a
 * single $wpdb conditional UPDATE so concurrent registrations on the open
 * endpoint can't read-modify-write past the ceiling. The window reset time is
 * encoded in the option value, so the count never slides forward mid-window
 * and survives a persistent object cache without relying on transient timeouts.
 */
class RateLimiter {

	/**
	 * Atomically bump a window's counter and report whether it stayed under the limit.
	 *
	 * Returns true when the registration is allowed (post-increment count is
	 * within $limit), false when the bump would exceed the ceiling. The whole
	 * read-bump is a single atomic option write per call, so racing callers
	 * serialize on the row and cannot overshoot.
	 *
	 * @param string $key   Logical window key (no option prefix).
	 * @param int    $limit Maximum hits allowed in the window.
	 * @param int    $ttl   Window length in seconds.
	 * @return bool True when the hit is within the limit.
	 */
	public static function hit( string $key, int $limit, int $ttl = HOUR_IN_SECONDS ) {
		global $wpdb;

		$limit  = max( 1, (int) $limit );
		$ttl    = max( 1, (int) $ttl );
		$option = 'presto_oauth_rl_' . md5( $key );
		$now    = time();
		$reset  = $now + $ttl;

		// add_option() is a race-free INSERT: exactly one concurrent caller wins
		// when the window doesn't exist yet, and it starts the window at 1.
		if ( add_option(
			$option,
			array(
				'count' => 1,
				'reset' => $reset,
			),
			'',
			false
		) ) {
			return 1 <= $limit;
		}

		// Compare-and-swap retry loop. A caller that loses the CAS re-reads and
		// tries again so its own hit is still counted, instead of being silently
		// dropped (which would let concurrent floods slip past the limit).
		for ( $attempt = 0; $attempt < 25; $attempt++ ) {
			wp_cache_delete( $option, 'options' );
			$raw = get_option( $option );

			if ( ! is_array( $raw ) || empty( $raw['reset'] ) || (int) $raw['reset'] <= $now ) {
				// Stale or malformed window: reset it to a fresh window of 1.
				update_option(
					$option,
					array(
						'count' => 1,
						'reset' => $reset,
					),
					false
				);
				return 1 <= $limit;
			}

			if ( (int) $raw['count'] >= $limit ) {
				// Ceiling already reached; do not increment past it.
				return false;
			}

			$expected = maybe_serialize( $raw );
			$next     = maybe_serialize(
				array(
					'count' => (int) $raw['count'] + 1,
					'reset' => (int) $raw['reset'],
				)
			);

			$updated = $wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->prepare(
					"UPDATE {$wpdb->options} SET option_value = %s WHERE option_name = %s AND option_value = %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
					$next,
					$option,
					$expected
				)
			);

			if ( $updated ) {
				wp_cache_delete( $option, 'options' );
				return true;
			}
			// Lost the CAS race: loop and retry with a fresh read.
		}

		// Exhausted retries under heavy contention: fail closed.
		return false;
	}
}

/**
 * Static installer + version gate for the OAuth tables.
 */
class Schema {

	/**
	 * Option key storing the current installed schema version.
	 *
	 * @var string
	 */
	public const VERSION_OPTION = 'presto_oauth_schema_version';

	/**
	 * Current schema version. Bump on any column / index change.
	 *
	 * @var string
	 */
	public const SCHEMA_VERSION = '1.3.0';

	/**
	 * Install tables only when the stored version differs from the code version.
	 *
	 * Cheap enough to run on every `init` because the option read is cached.
	 *
	 * @return void
	 */
	public static function installIfNeeded() {
		$installed = get_option( self::VERSION_OPTION );
		if ( self::SCHEMA_VERSION === $installed ) {
			return;
		}
		self::install();
	}

	/**
	 * Create / upgrade all three OAuth tables via dbDelta().
	 *
	 * Safe to call repeatedly; dbDelta diffs against the live schema.
	 *
	 * @return void
	 */
	public static function install() {
		global $wpdb;

		if ( ! function_exists( 'dbDelta' ) ) {
			require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		}

		$prefix          = $wpdb->prefix;
		$charset_collate = $wpdb->get_charset_collate();

		$clients_table = $prefix . 'presto_oauth_clients';
		$codes_table   = $prefix . 'presto_oauth_codes';
		$tokens_table  = $prefix . 'presto_oauth_tokens';

		$queries = array();

		$queries[] = "CREATE TABLE {$clients_table} (
			client_id VARCHAR(64) NOT NULL,
			client_secret_hash VARCHAR(255) NULL,
			client_name VARCHAR(191) NOT NULL,
			client_type VARCHAR(16) NOT NULL,
			redirect_uris LONGTEXT NOT NULL,
			scope TEXT NULL,
			software_id VARCHAR(191) NULL,
			created_at DATETIME NOT NULL,
			last_used_at DATETIME NULL,
			PRIMARY KEY  (client_id),
			KEY client_name (client_name)
		) {$charset_collate};";

		$queries[] = "CREATE TABLE {$codes_table} (
			code_hash VARCHAR(64) NOT NULL,
			client_id VARCHAR(64) NOT NULL,
			user_id BIGINT UNSIGNED NOT NULL,
			scopes TEXT NOT NULL,
			code_challenge VARCHAR(128) NULL,
			code_challenge_method VARCHAR(16) NULL,
			redirect_uri TEXT NOT NULL,
			expires_at DATETIME NOT NULL,
			used_at DATETIME NULL,
			PRIMARY KEY  (code_hash),
			KEY client_id (client_id),
			KEY expires_at (expires_at)
		) {$charset_collate};";

		$queries[] = "CREATE TABLE {$tokens_table} (
			token_hash VARCHAR(64) NOT NULL,
			token_type VARCHAR(16) NOT NULL,
			client_id VARCHAR(64) NOT NULL,
			user_id BIGINT UNSIGNED NOT NULL,
			scopes TEXT NOT NULL,
			expires_at DATETIME NOT NULL,
			revoked_at DATETIME NULL,
			created_at DATETIME NOT NULL,
			parent_token_hash VARCHAR(64) NULL,
			absolute_expires_at DATETIME NULL,
			PRIMARY KEY  (token_hash),
			KEY client_user (client_id, user_id),
			KEY expires_at (expires_at),
			KEY token_type (token_type),
			KEY parent_token_hash (parent_token_hash)
		) {$charset_collate};";

		foreach ( $queries as $sql ) {
			dbDelta( $sql );
		}

		update_option( self::VERSION_OPTION, self::SCHEMA_VERSION, false );
	}

	/**
	 * Drop every issued grant.
	 *
	 * Turning AI access off is the site owner's only revocation control, so it has
	 * to actually revoke: without this, switching the toggle back on would reinstate
	 * every token that was live before, for the rest of its 90-day lifetime. Clients
	 * are left registered — a client row on its own grants nothing until a fresh
	 * consent mints a new token.
	 *
	 * @return void
	 */
	public static function revokeAllGrants() {
		global $wpdb;

		$codes_table  = $wpdb->prefix . 'presto_oauth_codes';
		$tokens_table = $wpdb->prefix . 'presto_oauth_tokens';

		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$wpdb->query( "DELETE FROM {$codes_table}" );
		$wpdb->query( "DELETE FROM {$tokens_table}" );
		// phpcs:enable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	}

	/**
	 * Drop everything OAuth owns.
	 *
	 * Called from the plugin's "delete all data" uninstall path. Without it a
	 * reinstall would come back to a live grant table — registered clients and
	 * hashed refresh tokens that nobody consented to a second time.
	 *
	 * @return void
	 */
	public static function uninstall() {
		global $wpdb;

		// Table identifiers cannot be bound; these are $wpdb->prefix + literal names.
		foreach ( array( 'presto_oauth_codes', 'presto_oauth_tokens', 'presto_oauth_clients' ) as $table ) {
			$wpdb->query( 'DROP TABLE IF EXISTS ' . $wpdb->prefix . $table ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared
		}

		// Rate-limit windows, written as autoload=false options by RateLimiter::hit().
		$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE 'presto\\_oauth\\_rl\\_%'" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared

		delete_option( self::VERSION_OPTION );
	}

	/**
	 * Delete stale rows so the OAuth tables don't grow unbounded.
	 *
	 * Drops expired tokens, plus expired or already-used codes. Revoked-but-not-
	 * yet-expired tokens are deliberately kept so refresh-token reuse detection
	 * (TokenEndpoint::handleRefreshToken) can still match the revoked row and
	 * trigger revokeChain(); do not add `revoked_at IS NOT NULL` here without
	 * accounting for that signal. Intended to run on a daily cron; cheap enough
	 * to call ad hoc.
	 *
	 * @return void
	 */
	public static function prune() {
		global $wpdb;

		$now           = gmdate( 'Y-m-d H:i:s' );
		$codes_table   = $wpdb->prefix . 'presto_oauth_codes';
		$tokens_table  = $wpdb->prefix . 'presto_oauth_tokens';
		$clients_table = $wpdb->prefix . 'presto_oauth_clients';

		$wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->prepare(
				"DELETE FROM {$tokens_table} WHERE expires_at < %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$now
			)
		);

		$wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->prepare(
				"DELETE FROM {$codes_table} WHERE expires_at < %s OR used_at IS NOT NULL", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$now
			)
		);

		$abandoned_cutoff = gmdate( 'Y-m-d H:i:s', time() - MONTH_IN_SECONDS );
		$wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->prepare(
				"DELETE FROM {$clients_table} WHERE last_used_at IS NULL AND created_at < %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$abandoned_cutoff
			)
		);

		// Expired rate-limit windows. RateLimiter::hit() writes presto_oauth_rl_*
		// options (autoload=false) with a 'reset' timestamp; nothing else removes
		// them, so the open per-IP /register endpoint would grow wp_options without
		// bound. Sweep the windows whose reset has already passed.
		// Swept in batches: reading every matching row in one go is what would run the
		// cron out of memory on exactly the site that has too many of them.
		do {
			$rl_rows = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
				"SELECT option_id, option_value FROM {$wpdb->options} WHERE option_name LIKE 'presto\\_oauth\\_rl\\_%' LIMIT 500" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			);
			$batch   = count( (array) $rl_rows );
			$expired = array();
			foreach ( (array) $rl_rows as $row ) {
				$data = maybe_unserialize( $row->option_value );
				if ( ! is_array( $data ) || empty( $data['reset'] ) || (int) $data['reset'] <= time() ) {
					$expired[] = (int) $row->option_id;
				}
			}
			if ( $expired ) {
				$placeholders = implode( ', ', array_fill( 0, count( $expired ), '%d' ) );
				$wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
					$wpdb->prepare( "DELETE FROM {$wpdb->options} WHERE option_id IN ({$placeholders})", $expired ) // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				);
			}
			// A full batch with nothing expired means the rest are live windows too:
			// they all share one TTL, so scanning further pages just burns queries.
		} while ( 500 === $batch && $expired );
	}
}
