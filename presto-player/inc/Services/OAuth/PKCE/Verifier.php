<?php
/**
 * PKCE S256 verifier.
 *
 * @package PrestoPlayer
 * @subpackage Services\OAuth\PKCE
 */

namespace PrestoPlayer\Services\OAuth\PKCE;

/**
 * Static helpers for verifying PKCE code challenges (RFC 7636).
 */
class Verifier {

	/**
	 * Verify a code_verifier against a stored S256 challenge.
	 *
	 * Per RFC 7636 §4.6: base64url(sha256(verifier)) == challenge.
	 * Comparison is timing-safe.
	 *
	 * @param string $challenge Stored code_challenge.
	 * @param string $verifier  Client-supplied code_verifier.
	 * @return bool True when the verifier matches the challenge.
	 */
	public static function verifyS256( string $challenge, string $verifier ): bool {
		if ( '' === $challenge || '' === $verifier ) {
			return false;
		}

		if ( ! preg_match( '/^[A-Za-z0-9\-._~]{43,128}$/', $verifier ) ) {
			return false;
		}

		$computed = self::base64UrlEncode( hash( 'sha256', $verifier, true ) );

		return hash_equals( $challenge, $computed );
	}

	/**
	 * Encode bytes as base64url without padding.
	 *
	 * @param string $input Raw binary input.
	 * @return string Base64url-encoded string.
	 */
	public static function base64UrlEncode( string $input ): string {
		$base64 = base64_encode( $input ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
		return rtrim( strtr( $base64, '+/', '-_' ), '=' );
	}
}
