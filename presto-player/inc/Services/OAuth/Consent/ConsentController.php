<?php
/**
 * Consent screen renderer + submit handler for OAuth /authorize.
 *
 * Rendering is intentionally standalone (no theme or wp_head/wp_footer):
 * the consent page is a security UI and must not be influenced by theme
 * markup, third-party scripts, or admin chrome.
 *
 * @package PrestoPlayer
 * @subpackage Services\OAuth\Consent
 */

namespace PrestoPlayer\Services\OAuth\Consent;

use PrestoPlayer\Services\OAuth\Constants;

/**
 * Renders the consent screen and handles the POSTed user decision.
 */
class ConsentController {

	/**
	 * Human-readable copy for each known scope.
	 *
	 * @return array<string, string>
	 */
	protected function scopeDescriptions() {
		return array(
			Constants::SCOPE_READ        => __( 'View videos, presets, analytics, and settings', 'presto-player' ),
			Constants::SCOPE_WRITE       => __( 'Create and edit videos, presets, captions', 'presto-player' ),
			Constants::SCOPE_DESTRUCTIVE => __( 'Delete videos, presets, and submissions', 'presto-player' ),
			Constants::SCOPE_ADMIN       => __( 'Modify plugin settings and license', 'presto-player' ),
		);
	}

	/**
	 * Build the nonce action string for a given client/state pair.
	 *
	 * @param string $client_id Client identifier.
	 * @param string $state        OAuth opaque state.
	 * @param string $scope        Space-delimited scope shown on the consent screen.
	 * @param string $redirect_uri Redirect URI shown on the consent screen.
	 * @return string
	 */
	protected function nonceAction( $client_id, $state, $scope = '', $redirect_uri = '' ) {
		// Bind the nonce to the exact scope + redirect_uri that were displayed, so a
		// tampered POST that swaps the scope after the user consented fails to verify.
		$binding = wp_hash( $client_id . '|' . $state . '|' . trim( (string) $scope ) . '|' . $redirect_uri );
		return 'presto_oauth_consent_' . $binding;
	}

	/**
	 * Render the consent HTML page.
	 *
	 * Expects validated params from {@see AuthorizeEndpoint}:
	 *   - client_id, client_name, redirect_uri, scope, state,
	 *     code_challenge, code_challenge_method, response_type.
	 *
	 * @param array<string, string> $params Validated params.
	 * @return void
	 */
	public function renderConsent( array $params ) {
		$user = wp_get_current_user();

		$scope_slugs  = preg_split( '/\s+/', trim( (string) $params['scope'] ) );
		$scope_slugs  = is_array( $scope_slugs ) ? array_values(
			array_filter(
				$scope_slugs,
				static function ( $s ) {
					return '' !== (string) $s;
				}
			)
		) : array();
		$descriptions = $this->scopeDescriptions();

		$scopes = array();
		foreach ( $scope_slugs as $slug ) {
			$scopes[] = array(
				'slug'        => $slug,
				'description' => isset( $descriptions[ $slug ] ) ? $descriptions[ $slug ] : $slug,
			);
		}

		$client_name = isset( $params['client_name'] ) ? $params['client_name'] : $params['client_id'];
		$user_email  = $user && ! empty( $user->user_email ) ? $user->user_email : '';
		$site_name   = get_bloginfo( 'name' );

		// Registration is open and client_name is whatever the client called itself, so the
		// name alone can impersonate anything. The redirect target is the one thing an
		// attacker can't fake — it's where the token actually goes — so show it.
		$redirect_uri = isset( $params['redirect_uri'] ) ? (string) $params['redirect_uri'] : '';

		$action      = $this->nonceAction( $params['client_id'], $params['state'], $params['scope'], $params['redirect_uri'] );
		$nonce_field = wp_nonce_field( $action, '_wpnonce', true, false );
		$form_action = $this->buildFormAction( $params );

		status_header( 200 );
		nocache_headers();
		if ( ! headers_sent() ) {
			header( 'Content-Type: text/html; charset=utf-8' );
			header( 'X-Frame-Options: DENY' );
			header( "Content-Security-Policy: frame-ancestors 'none'" );
		}

		$template = __DIR__ . '/templates/consent.php';
		include $template;
	}

	/**
	 * Build the same-URL form action carrying every original query parameter.
	 *
	 * Hidden inputs add the user's decision (`allow`/`deny`) and the nonce.
	 *
	 * @param array<string, string> $params Validated params.
	 * @return string Absolute URL ready for the form's `action` attribute.
	 */
	protected function buildFormAction( array $params ) {
		$base = home_url( Constants::AUTHORIZE_PATH );
		$args = array(
			'response_type'         => $params['response_type'],
			'client_id'             => $params['client_id'],
			'redirect_uri'          => $params['redirect_uri'],
			'state'                 => $params['state'],
			'code_challenge'        => $params['code_challenge'],
			'code_challenge_method' => $params['code_challenge_method'],
			'scope'                 => $params['scope'],
		);
		return add_query_arg( array_map( 'rawurlencode', $args ), $base );
	}

	/**
	 * Process the POSTed consent decision.
	 *
	 * - Verifies the nonce keyed to the client+state.
	 * - On "deny": redirects back to redirect_uri with access_denied.
	 * - On "allow": issues a fresh authorization code and redirects with
	 *   ?code=...&state=... per RFC 6749 §4.1.2.
	 *
	 * @param array<string, string> $params Validated params (pre-checked by AuthorizeEndpoint).
	 * @return void
	 */
	public function handleConsentSubmit( array $params ) {
		$action      = $this->nonceAction( $params['client_id'], $params['state'], $params['scope'], $params['redirect_uri'] );
		$nonce_value = isset( $_POST['_wpnonce'] ) ? sanitize_text_field( wp_unslash( $_POST['_wpnonce'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- nonce verified on the next line.

		if ( ! wp_verify_nonce( $nonce_value, $action ) ) {
			$this->redirectError( $params['redirect_uri'], 'invalid_request', $params['state'], __( 'Nonce verification failed.', 'presto-player' ) );
			return;
		}

		$decision = isset( $_POST['allow'] ) ? 'allow' : ( isset( $_POST['deny'] ) ? 'deny' : '' ); // phpcs:ignore WordPress.Security.NonceVerification.Missing

		if ( 'deny' === $decision ) {
			$this->redirectError( $params['redirect_uri'], 'access_denied', $params['state'], __( 'The user denied the authorization request.', 'presto-player' ) );
			return;
		}

		if ( 'allow' !== $decision ) {
			$this->redirectError( $params['redirect_uri'], 'invalid_request', $params['state'], __( 'Missing consent decision.', 'presto-player' ) );
			return;
		}

		$scopes = preg_split( '/\s+/', trim( (string) $params['scope'] ) );
		$scopes = is_array( $scopes ) ? array_values(
			array_filter(
				$scopes,
				static function ( $s ) {
					return '' !== (string) $s;
				}
			)
		) : array();

		$repo = new \PrestoPlayer\Services\OAuth\Storage\CodeRepository();
		$code = $repo->issue(
			$params['client_id'],
			(int) get_current_user_id(),
			$scopes,
			$params['redirect_uri'],
			'' === $params['code_challenge'] ? null : $params['code_challenge'],
			'' === $params['code_challenge_method'] ? null : $params['code_challenge_method'],
			Constants::AUTH_CODE_TTL
		);

		// An empty code means the hash never persisted; don't redirect with a broken code.
		if ( '' === $code ) {
			$this->redirectError( $params['redirect_uri'], 'server_error', $params['state'], __( 'Could not issue the authorization code.', 'presto-player' ) );
			return;
		}

		$query = array( 'code' => rawurlencode( $code ) );
		if ( '' !== (string) $params['state'] ) {
			$query['state'] = rawurlencode( $params['state'] );
		}

		$url = add_query_arg( $query, $params['redirect_uri'] );

		$this->finalRedirect( $url );
		exit;
	}

	/**
	 * Build + emit the error redirect.
	 *
	 * @param string $redirect_uri Validated redirect URI.
	 * @param string $error        OAuth error code.
	 * @param string $state        Opaque state, echoed back when the client sent one.
	 * @param string $description  Human-readable error description.
	 * @return void
	 */
	protected function redirectError( $redirect_uri, $error, $state, $description ) {
		$query = array(
			'error'             => rawurlencode( $error ),
			'error_description' => rawurlencode( $description ),
		);

		// RFC 6749 §4.1.2.1: only echo state back if the request carried one.
		if ( '' !== (string) $state ) {
			$query['state'] = rawurlencode( $state );
		}

		$url = add_query_arg( $query, $redirect_uri );
		$this->finalRedirect( $url );
		exit;
	}

	/**
	 * Choose safe vs. allowlisted redirect.
	 *
	 * Same-host targets go through wp_safe_redirect. Cross-host targets
	 * use wp_redirect — safe here because redirect_uri was already
	 * validated against the client's allowlist.
	 *
	 * @param string $url Absolute URL.
	 * @return void
	 */
	protected function finalRedirect( $url ) {
		$site_host   = wp_parse_url( home_url(), PHP_URL_HOST );
		$target_host = wp_parse_url( $url, PHP_URL_HOST );

		if ( $site_host && $target_host && strtolower( $site_host ) === strtolower( $target_host ) ) {
			wp_safe_redirect( $url );
			return;
		}
		wp_redirect( $url ); // phpcs:ignore WordPress.Security.SafeRedirect.wp_redirect_wp_redirect
	}
}
