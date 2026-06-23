<?php
/**
 * Player model.
 *
 * @package PrestoPlayer
 */

namespace PrestoPlayer\Models;

/**
 * Player model.
 */
class Player {

	/**
	 * Option key used to store branding settings.
	 *
	 * @var string
	 */
	public static $branding_key = 'presto_player_branding';

	/**
	 * Determine whether a post contains a Presto Player instance.
	 *
	 * @param int $id Post ID to inspect.
	 * @return bool True if the post contains a player, false otherwise.
	 */
	public static function postHasPlayer( $id ) {
		// Global is the most reliable between page builders.
		global $load_presto_js;
		if ( $load_presto_js ) {
			return true;
		}

		// Change to see if we have one of our blocks.
		$types = Block::getBlockTypes();
		foreach ( $types as $type ) {
			if ( has_block( $type, $id ) ) {
				return true;
			}
		}

		// Check for data-presto-config (player rendered).
		$wp_post = get_post( $id );
		if ( $wp_post instanceof \WP_Post ) {
			$post = $wp_post->post_content;
		}
		$has_player = false !== strpos( $post, '<presto-player' );
		if ( $has_player ) {
			return true;
		}

		// Check that we have a shortcode.
		if ( has_shortcode( $post, 'presto_player' ) ) {
			return true;
		}

		// Read-only request-context detection for page builders; no state change, so nonce verification does not apply.
		// phpcs:disable WordPress.Security.NonceVerification.Recommended
		// Enable on Elementor.
		if ( ! empty( $_GET['action'] ) && 'elementor' === $_GET['action'] ) {
			return true;
		}
		if ( isset( $_GET['elementor-preview'] ) ) {
			return true;
		}

		// Load for beaver builder.
		if ( isset( $_GET['fl_builder'] ) ) {
			return true;
		}
		// phpcs:enable WordPress.Security.NonceVerification.Recommended

		// Do we have the player.
		return $has_player;
	}

	/**
	 * Get get branding settings
	 *
	 * @return array
	 */
	public static function getBranding() {
		$defaults = array(
			'logo'       => '',
			'logo_width' => 150,
			'color'      => '#00b3ff',
		);
		return self::get_option( self::$branding_key, $defaults );
	}

	/**
	 * Revert to option default in case it's empty
	 *
	 * @param string $key      Option key to retrieve.
	 * @param array  $defaults Default value used when the stored option is empty.
	 * @return array The stored option value, or the defaults when empty.
	 */
	public static function get_option( $key, $defaults ) {
		$config = get_option( $key, $defaults );
		return ! empty( $config ) ? $config : $defaults;
	}
}
