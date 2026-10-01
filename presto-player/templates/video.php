<?php
/**
 * Presto Player video template.
 *
 * This template renders the presto-player custom element with all necessary attributes.
 *
 * @package PrestoPlayer
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

// Hex-escape JSON like core's data-wp-context, so esc_attr() can't let entities round-trip into tags.
$presto_json_flags = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT;
?>
<figure class="wp-block-video presto-block-video <?php echo esc_attr( $data['class'] ); ?> presto-provider-<?php echo sanitize_html_class( $data['provider'] ); ?>" style="<?php echo esc_attr( $data['styles'] ); ?>">
	<presto-player 
		preset='<?php echo esc_attr( wp_json_encode( $data['preset'], $presto_json_flags ) ); ?>'
		branding='<?php echo esc_attr( wp_json_encode( $data['branding'], $presto_json_flags ) ); ?>'
		chapters='<?php echo esc_attr( wp_json_encode( $data['chapters'], $presto_json_flags ) ); ?>'
		overlays='<?php echo esc_attr( wp_json_encode( $data['overlays'], $presto_json_flags ) ); ?>'
		tracks='<?php echo esc_attr( wp_json_encode( $data['tracks'], $presto_json_flags ) ); ?>'
		block-attributes='<?php echo esc_attr( wp_json_encode( $data['blockAttributes'], $presto_json_flags ) ); ?>'
		analytics='<?php echo esc_attr( $data['analytics'] ); ?>'
		<?php echo $data['automations'] ? 'automations' : ''; ?>
		provider='<?php echo esc_attr( $data['provider'] ); ?>'
		<?php echo is_rtl() ? 'direction="rtl"' : ''; ?>
		id="presto-player-<?php echo (int) $presto_player_instance; ?>"
		src="<?php echo esc_attr( $data['src'] ); ?>"
		media-title="<?php echo esc_attr( $data['title'] ); ?>"
		css="<?php echo esc_attr( $data['css'] ); ?>"
		class="<?php echo esc_attr( $data['playerClass'] ); ?>"
		skin="<?php echo esc_attr( $data['skin'] ); ?>" 
		icon-url="<?php echo esc_url( PRESTO_PLAYER_PLUGIN_URL . 'img/sprite.svg' ); ?>" 
		preload="<?php echo esc_attr( $data['preload'] ); ?>" 
		poster="<?php echo esc_attr( $data['poster'] ); ?>"
		youtube="<?php echo esc_attr( wp_json_encode( $data['youtube'], $presto_json_flags ) ); ?>"
		provider-video-id="<?php echo esc_attr( $data['provider_video_id'] ?? '' ); ?>"
		video-id="<?php echo esc_attr( $data['id'] ?? 0 ); ?>"
		<?php echo ( $data['preset']['lazy_load_youtube'] ?? false ) ? 'lazy-load-youtube' : ''; ?>
		video-attributes='<?php echo esc_attr( wp_json_encode( ! empty( $data['videoAttributes'] ) ? $data['videoAttributes'] : new stdClass(), $presto_json_flags ) ); ?>'
		<?php echo $data['playsInline'] ? 'playsinline' : ''; ?>
		<?php echo $data['autoplay'] ? 'autoplay' : ''; ?>
		<?php do_action( 'presto_player/templates/player_tag', $data ); ?>>
		<?php
		if ( ! empty( $data['provider'] ) ) {
			require 'fallback.php';
		}
		?>
	</presto-player>
</figure>