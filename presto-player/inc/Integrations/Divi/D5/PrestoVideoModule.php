<?php
/**
 * Registers the Presto Player video module for Divi 5.
 *
 * @package presto-player
 */

namespace PrestoPlayer\Integrations\Divi\D5;

use ET\Builder\Framework\DependencyManagement\Interfaces\DependencyInterface;
use ET\Builder\Packages\ModuleLibrary\ModuleRegistration;

/**
 * Divi 5 module dependency that registers the Presto Player video block.
 */
class PrestoVideoModule implements DependencyInterface {

	/**
	 * Registers the module with the Divi 5 module library.
	 *
	 * @return void
	 */
	public function load(): void {
		ModuleRegistration::register_module(
			__DIR__ . '/module-json/player',
			array( 'render_callback' => array( self::class, 'render_callback' ) )
		);
	}

	/**
	 * Renders the Presto Player video module on the front end.
	 *
	 * @param array<string, mixed> $attrs                      Module attribute array from D5.
	 * @param string               $content                    Inner content string.
	 * @param object               $block                      The block object.
	 * @param object               $elements                   The elements object.
	 * @param array<string, mixed> $default_printed_style_attrs Default printed style attributes.
	 * @return string
	 */
	public static function render_callback( $attrs, $content, $block, $elements, $default_printed_style_attrs ) {
		$mapped = PlayerAttrs::map( $attrs );

		if ( empty( $mapped['video_id'] ) ) {
			return self::curtain();
		}

		global $load_presto_js;
		$load_presto_js = true;

		// Enqueue player assets once per request even if several modules render.
		static $assets_enqueued = false;
		if ( ! $assets_enqueued ) {
			( new \PrestoPlayer\Services\Scripts() )->blockAssets();
			$assets_enqueued = true;
		}

		// Same visibility guard as the shortcode — renderBlock() skips WP's
		// singular-post check, so private/draft Media Hub items would leak.
		$fallback = ( new \PrestoPlayer\Services\Shortcodes() )->maybeUnauthorizedFallback( $mapped['video_id'] );
		if ( false !== $fallback ) {
			return $fallback;
		}

		$video = new \PrestoPlayer\Models\ReusableVideo( $mapped['video_id'] );
		$html  = $video->renderBlock( $mapped['overrides'] );

		return $html ? $html : self::curtain();
	}

	/**
	 * The empty-state placeholder shown when no video is selected.
	 *
	 * @return string
	 */
	private static function curtain(): string {
		// The editor draws its own placeholder (PlayerEdit); on the public front end an
		// unconfigured module renders nothing, matching an empty Divi 4 module.
		if ( ! function_exists( 'et_core_is_fb_enabled' ) || ! et_core_is_fb_enabled() ) {
			return '';
		}
		return '<presto-video-curtain-ui>' . esc_html__( 'Please select media.', 'presto-player' ) . '</presto-video-curtain-ui>';
	}
}
