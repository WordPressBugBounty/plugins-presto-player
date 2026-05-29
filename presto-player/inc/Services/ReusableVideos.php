<?php
/**
 * Reusable video admin notice and block renderer.
 *
 * @package PrestoPlayer
 * @subpackage Services
 */

namespace PrestoPlayer\Services;

use PrestoPlayer\Services\Scripts;

/**
 * Renders the Media Hub introduction notice and helpers for reusable video blocks.
 */
class ReusableVideos {

	/**
	 * Register shortcode.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'admin_notices', array( $this, 'notice' ) );
		add_action( 'admin_init', array( $this, 'dismissNotice' ) );
	}

	/**
	 * Render the Media Hub admin notice on the reusable video list screen.
	 *
	 * @return void
	 */
	public function notice() {
		global $typenow, $current_screen;

		if ( ! ( 'pp_video_block' === $typenow && 'edit' === $current_screen->base ) ) {
			return;
		}

		$notice_name = 'presto_player_reusable_notice';
		if ( AdminNotices::isDismissed( $notice_name ) ) {
			return;
		}
		?>
		<div class="notice" style="border-left-color: #7c3aed;">
			<p><strong><?php esc_html_e( 'What is the media hub?', 'presto-player' ); ?></strong></p>
			<p><?php esc_html_e( 'The media hub is a more flexible way to add media to your site. It allows you to save audio and videos which you can later use in any post or page on your site - either through the Block Editor, a page builder, or by using a shortcode or php function.', 'presto-player' ); ?></p>
			<p><a href="
			<?php
			echo esc_url(
				add_query_arg(
					array(
						'presto_action' => 'dismiss_notices',
						'presto_notice' => $notice_name,
						'_wpnonce'      => wp_create_nonce( AdminNotices::DISMISS_NONCE_ACTION ),
					)
				)
			);
			?>
						"><?php esc_html_e( 'Dismiss Notice', 'presto-player' ); ?></a></p>
		</div>
		<?php
	}

	/**
	 * Persist the dismissal of the Media Hub notice on admin_init.
	 *
	 * @return void
	 */
	public function dismissNotice() {
		// Permissions check.
		if ( ! current_user_can( 'update_options' ) ) {
			return;
		}

		// Not our notices, bail.
		if ( ! isset( $_GET['presto_action'] ) || 'dismiss_notice' !== $_GET['presto_action'] ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only branch guard; nonce verified before update below.
			return;
		}

		$notice = ! empty( $_GET['presto_notice'] ) ? sanitize_text_field( wp_unslash( $_GET['presto_notice'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Nonce verified before update below.

		if ( ! $notice ) {
			return;
		}

		// Notice is dismissed.
		update_option( 'presto_player_dismissed_notice_' . sanitize_text_field( $notice ), 1 );
	}

	/**
	 * Get reusable video block function.
	 *
	 * @param mixed $id The ID of the reusable block.
	 * @return string The content of the block.
	 */
	public static function get( $id ) {
		$content_post = get_post( $id );
		$content      = $content_post->post_content;
		return $content;
	}

	/**
	 * Render a reusable block by id.
	 *
	 * @param int $id The ID of the reusable block.
	 * @return string Rendered HTML.
	 */
	public static function getBlock( $id ) {
		$blocks = parse_blocks( self::get( $id ) );
		$out    = '';
		if ( is_feed() ) {
			foreach ( $blocks as $block ) {
				foreach ( $block['innerBlocks'] as $innerblock ) {
					$out .= self::getFeedHtml( $innerblock );
				}
			}
			return $out;
		}

		foreach ( $blocks as $block ) {
			$out .= render_block( $block );
		}

		return $out;
	}

	/**
	 * Display block function.
	 *
	 * @param mixed $id The ID of the reusable block.
	 */
	public static function display( $id ) {
		echo self::getBlock( $id ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Output is rendered block HTML from core's render_block().
	}

	/**
	 * Return fallback html for feeds.
	 *
	 * @param array $block array of block attributes.
	 */
	public static function getFeedHtml( $block ) {

		$html = '';
		if ( 'presto-player/vimeo' === $block['blockName'] ) {
			ob_start();
			?>
			<div class="presto-iframe-fallback-container">
				<iframe style="width: 100%" class="presto-fallback-iframe" id="presto-iframe-fallback-<?php echo (int) $block['attrs']['id']; ?>" src="<?php echo esc_attr( $block['attrs']['src'] ); ?>"></iframe>
			</div>
			<?php
			$html = ob_get_clean();
		} elseif ( 'presto-player/youtube' === $block['blockName'] ) {
			ob_start();
			?>
			<div class="presto-iframe-fallback-container">
				<iframe style="width: 100%" class="presto-fallback-iframe" id="presto-iframe-fallback-<?php echo (int) $block['attrs']['id']; ?>" src="<?php echo esc_attr( $block['attrs']['src'] ); ?>"></iframe>
			</div>
			<?php
			$html = ob_get_clean();
		} else {
			ob_start();
			?>
			<video controls preload="none">
				<source src="<?php echo esc_attr( $block['attrs']['src'] ); ?>" />
			</video>
			<?php
			$html = ob_get_clean();
		}
		return $html;
	}
}
