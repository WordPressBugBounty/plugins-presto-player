<?php
/**
 * Token generation + hashing helpers.
 *
 * @package PrestoPlayer
 * @subpackage Services\OAuth\Helpers
 */

namespace PrestoPlayer\Services\OAuth\Helpers;

/**
 * Small static helpers for opaque token strings.
 */
class Tokens {

	/**
	 * Generate a cryptographically random base64url-safe opaque token.
	 *
	 * @param int $bytes Number of random bytes to draw (default 32 → ~43 char token).
	 * @return string Base64url-encoded random string with no padding.
	 */
	public static function generateOpaqueToken( $bytes = 32 ) {
		$bytes = (int) $bytes;
		if ( $bytes < 16 ) {
			$bytes = 16;
		}
		$raw    = random_bytes( $bytes );
		$base64 = base64_encode( $raw ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
		return rtrim( strtr( $base64, '+/', '-_' ), '=' );
	}

	/**
	 * Hash an opaque token for storage / lookup.
	 *
	 * Sha256 hex — fast, deterministic, suitable for indexed primary key lookups.
	 *
	 * @param string $token Plaintext token.
	 * @return string Hex-encoded sha256 digest (64 chars).
	 */
	public static function hash( $token ) {
		return hash( 'sha256', (string) $token );
	}
}
