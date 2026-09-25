<?php
/**
 * Third party compatibility.
 *
 * @package PrestoPlayer\Services
 */

namespace PrestoPlayer\Services;

/**
 * Registers compatibility hooks for caching, optimization and hosting plugins.
 */
class Compatibility {

	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	public function register() {
		// wp rocket compat.
		add_action( 'rocket_exclude_js', array( $this, 'excludeComponentsFile' ) );

		// siteground optimize.
		add_action( 'sgo_js_minify_exclude', array( $this, 'excludeHandle' ) );

		// godaddy feedback modal.
		add_action( 'admin_enqueue_scripts', array( $this, 'goDaddyModal' ), 99 );

		// allow our player html.
		add_filter( 'wp_kses_allowed_html', array( $this, 'allowHtml' ), 11, 2 );

		// allow our css variables in safe css.
		add_filter( 'safe_style_css', array( $this, 'safeCSS' ) );
	}

	/**
	 * Allows our css variables to be outputted wp_kses_allowed_html
	 *
	 * @param array $styles Array of allowed styles.
	 * @return array
	 */
	public function safeCSS( $styles ) {
		$player_styles = array(
			'--plyr-color-main',
			'--plyr-captions-background',
			'--presto-player-border-radius',
			'--presto-player-logo-width',
			'--presto-player-email-border-radius',
			'--presto-player-button-border-radius',
			'--presto-player-button-color',
			'--presto-player-button-text',
			'--presto-player-cta-background-opacity',
			'--plyr-audio-controls-background',
			'--plyr-audio-control-color',
			'--plyr-range-thumb-background',
			'--plyr-range-fill-background',
			'--presto-popup-media-width',
			'--presto-popup-media-width-mobile',
			'--presto-popup-background-color',
		);
		return array_merge( $player_styles, $styles );
	}

	/**
	 * Lets us use our player tag in content.
	 *
	 * @param  array  $tags    Allowed tags.
	 * @param  string $context Current kses context.
	 * @return array
	 */
	public function allowHtml( $tags, $context = '' ) {
		// Only allow the player tag when kses is sanitizing post content, and only
		// for users who may already store unfiltered HTML.
		//
		// The 'post' context keeps the tag out of comments etc., which is what let
		// unauthenticated users store a payload through comments (CVE-2026-96682).
		//
		// Requiring unfiltered_html stops a low-privileged author from smuggling a
		// raw <presto-player> tag (with an unsanitized inline preset) into post
		// content: kses strips it like any unknown element. Legitimate players come
		// from blocks/shortcodes rendered server-side after kses, so they are
		// unaffected.
		//
		// Design note: we deliberately close the author-injected vector here, at
		// the kses layer, rather than by sanitizing the preset inside the web
		// component or by sweeping the_content on output. Stripping the untrusted
		// tag on save means the component only ever receives trusted data (from the
		// REST/block path), so it needs no client-side sanitizer and adds no
		// per-render cost.
		if ( 'post' !== $context ) {
			return $tags;
		}

		// The capability check applies only while post content is being saved.
		// Render-time kses (a theme's wp_kses_post() over the_content, cron,
		// WP-CLI, WordPress.com output filtering) evaluates current_user_can()
		// against the viewer -- often user 0 -- and must always keep the tag, or
		// legitimate server-rendered players would vanish for logged-out visitors.
		if ( $this->isSavingPostContent() && ! current_user_can( 'unfiltered_html' ) ) {
			return $tags;
		}
		$tags['presto-player'] = array(
			'direction'         => true,
			'css'               => true,
			'skin'              => true,
			'icon-url'          => true,
			'id'                => true,
			'src'               => true,
			'class'             => true,
			'preload'           => true,
			'poster'            => true,
			'playsinline'       => true,
			'autoplay'          => true,
			'preset'            => true,
			'branding'          => true,
			'chapters'          => true,
			'overlays'          => true,
			'tracks'            => true,
			'block-attributes'  => true,
			'analytics'         => true,
			'automations'       => true,
			'provider'          => true,
			'media-title'       => true,
			'youtube'           => true,
			'provider-video-id' => true,
			'video-id'          => true,
			'lazy-load-youtube' => true,
		);
		return $tags;
	}

	/**
	 * Whether kses is currently filtering post content for a save.
	 *
	 * These are the hooks core attaches wp_filter_post_kses() to in
	 * kses_init_filters(); any other wp_kses() call is render-time.
	 *
	 * @return bool
	 */
	protected function isSavingPostContent() {
		return doing_filter( 'content_save_pre' )
			|| doing_filter( 'excerpt_save_pre' )
			|| doing_filter( 'content_filtered_save_pre' );
	}

	/**
	 * Dequeue GoDaddy's feedback modal on the video block screen.
	 *
	 * @return void
	 */
	public function goDaddyModal() {
		global $post_type;
		if ( 'pp_video_block' === $post_type ) {
			wp_dequeue_script( 'nextgen-feedback-modal' );
		}
	}

	/**
	 * Exclude module by file
	 *
	 * @param array $excluded_js Excluded JS files.
	 * @return array
	 */
	public function excludeComponentsFile( $excluded_js ) {
		$excluded_js[] = str_replace( home_url(), '', PRESTO_PLAYER_PLUGIN_URL . 'dist/components/web-components/web-components.esm.js' );

		return $excluded_js;
	}

	/**
	 * Exclude module by handle
	 *
	 * @param array $handles Excluded handles.
	 * @return array
	 */
	public function excludeHandle( $handles ) {
		$handles[] = 'presto-components';
		return $handles;
	}
}
