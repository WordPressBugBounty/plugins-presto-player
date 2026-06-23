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
	 * Send a freshly generated REST nonce as a JSON response.
	 *
	 * @return void
	 */
	public function generateNonce() {
		wp_send_json_success( wp_create_nonce( 'wp_rest' ) );
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
		// Verify nonce.
		if ( ! wp_verify_nonce( isset( $_POST['nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['nonce'] ) ) : '', 'wp_rest' ) ) {
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
