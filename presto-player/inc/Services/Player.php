<?php
/**
 * Player progress AJAX service.
 *
 * @package PrestoPlayer
 */

namespace PrestoPlayer\Services;

use PrestoPlayer\Contracts\Service;

/**
 * Registers the AJAX endpoints used to track player progress.
 */
class Player implements Service {

	/**
	 * Nonce action the refresh endpoint issues for player tracking.
	 *
	 * Pro verifies this exact action in its analytics and email-capture AJAX
	 * handlers, so renaming it here breaks Pro. Keep both sides in sync.
	 *
	 * @var string
	 */
	const PROGRESS_NONCE_ACTION = 'presto_player_progress';

	/**
	 * Nonce action issued before the scoped one. Still handed out whenever an
	 * older Pro is active (its handlers verify wp_rest only), still carried by
	 * pages cached back then, and since 4.3.2 the email overlay sends the
	 * page's localized wp_rest nonce (Scripts.php) on every submit — so this
	 * can't be retired until that overlay moves off it.
	 *
	 * @var string
	 */
	const LEGACY_NONCE_ACTION = 'wp_rest';

	/**
	 * Register the AJAX hooks for this service.
	 *
	 * @return void
	 */
	public function register() {
		// Ajax percentage actions.
		add_action( 'wp_ajax_presto_player_progress_percent', array( $this, 'progressAjaxPercent' ) );
		add_action( 'wp_ajax_nopriv_presto_player_progress_percent', array( $this, 'progressAjaxPercent' ) );

		add_action( 'wp_ajax_nopriv_presto_refresh_progress_nonce', array( $this, 'generateNonce' ) );
		add_action( 'wp_ajax_presto_refresh_progress_nonce', array( $this, 'generateNonce' ) );
	}

	/**
	 * Send a freshly generated progress nonce as a JSON response.
	 *
	 * Prefers the progress-scoped action, because this endpoint is open to
	 * logged-out users and a general-purpose wp_rest nonce is a wider grant
	 * than progress tracking needs.
	 *
	 * It still falls back to wp_rest when Pro is active but predates 3.2.3,
	 * since those builds verify wp_rest only — scoping unconditionally is what
	 * took Pro analytics and email capture down in 4.3.1. Don't "tidy" this
	 * into an unconditional scoped nonce without dropping support for Pro
	 * older than 3.2.3.
	 *
	 * @return void
	 */
	public function generateNonce() {
		$pro_active = class_exists( '\PrestoPlayer\Pro\Plugin' );

		/**
		 * Whether the active Pro version verifies the scoped progress nonce.
		 *
		 * Pro returns true from the version that accepts
		 * self::PROGRESS_NONCE_ACTION. Older builds check wp_rest only and
		 * never register this filter, which is how we detect them.
		 *
		 * @param bool $verifies Whether Pro verifies the scoped nonce.
		 */
		$pro_verifies_scoped = (bool) apply_filters( 'presto_player_pro_verifies_scoped_nonce', false );

		wp_send_json_success( wp_create_nonce( self::refreshNonceAction( $pro_active, $pro_verifies_scoped ) ) );
	}

	/**
	 * Decide which nonce action the refresh endpoint should issue.
	 *
	 * The player sends this one nonce to both the free progress handler and
	 * Pro's analytics/email-capture handlers. Pro versions before the scoped
	 * nonce landed verify wp_rest only, so they get the legacy nonce — without
	 * it their analytics and email capture reject every request with a 403.
	 *
	 * @param bool $pro_active          Whether the Pro plugin is active.
	 * @param bool $pro_verifies_scoped Whether that Pro version verifies the scoped nonce.
	 * @return string Nonce action.
	 */
	public static function refreshNonceAction( $pro_active, $pro_verifies_scoped ) {
		if ( $pro_active && ! $pro_verifies_scoped ) {
			return self::LEGACY_NONCE_ACTION;
		}

		return self::PROGRESS_NONCE_ACTION;
	}

	/**
	 * Run ajax percent action.
	 *
	 * @return void
	 */
	public function progressAjaxPercent() {
		$response = $this->progressAction();
		if ( is_wp_error( $response ) ) {
			wp_send_json_error( $response->get_error_message(), $response->get_all_error_data( 'status' ) );
		}

		wp_send_json_success();
	}

	/**
	 * Run the progress action.
	 *
	 * @return bool|\WP_Error True on success, or a WP_Error describing the failure.
	 */
	public function progressAction() {
		// Verify nonce. wp_rest still arrives from old cached pages and whenever
		// the refresh endpoint falls back for an older Pro.
		$nonce = isset( $_POST['nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['nonce'] ) ) : '';
		if ( ! wp_verify_nonce( $nonce, self::PROGRESS_NONCE_ACTION ) && ! wp_verify_nonce( $nonce, self::LEGACY_NONCE_ACTION ) ) {
			return new \WP_Error( 'invalid', 'Nonce invalid', array( 'status' => 403 ) );
		}

		// Video id is required.
		if ( empty( $_POST['id'] ) ) {
			return new \WP_Error( 'invalid', 'You must provide a valid video id', array( 'status' => 400 ) );
		}

		// Must have a valid percentage.
		if ( ! isset( $_POST['percent'] ) ) {
			return new \WP_Error( 'invalid', 'You must provide a valid percentage', array( 'status' => 400 ) );
		}

		$id         = (int) $_POST['id'];
		$percent    = (int) $_POST['percent'];
		$visit_time = isset( $_POST['visit_time'] ) ? (int) $_POST['visit_time'] : false;

		/**
		 * Progress event, sends video id and percent progress.
		 */
		do_action( 'presto_player_progress', $id, $percent, $visit_time );

		// Success.
		return true;
	}
}
