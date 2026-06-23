<?php
/**
 * Ajax action handlers.
 *
 * @package PrestoPlayer
 */

namespace PrestoPlayer\Services;

use PrestoPlayer\Models\ReusableVideo;


/**
 * Registers all blocks
 */
class AjaxActions {

	/**
	 * Register actions
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'wp_ajax_presto_fetch_videos', array( $this, 'fetchVideos' ) );
	}

	/**
	 * Fetch videos for dynamic
	 *
	 * @return void
	 */
	public function fetchVideos() {
		// Verify nonce.
		$nonce = isset( $_REQUEST['_wpnonce'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['_wpnonce'] ) ) : '';
		if ( ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
			wp_send_json_error();
		}

		// Need to edit posts.
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error();
		}

		$args = array();

		if ( ! empty( $_POST['search'] ) ) {
			$args['s'] = sanitize_text_field( wp_unslash( $_POST['search'] ) );
		}

		if ( ! empty( $_POST['post_id'] ) ) {
			$args['post__in'][0] = absint( wp_unslash( $_POST['post_id'] ) ); // Convert single post_id into array.
		}

		$videos = ( new ReusableVideo() )->fetch( $args );

		wp_send_json_success( $videos );
	}
}
