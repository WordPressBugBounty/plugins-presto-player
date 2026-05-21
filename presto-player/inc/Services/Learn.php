<?php
/**
 * Learn tab progress tracking service.
 *
 * @package PrestoPlayer
 * @subpackage Services
 */

namespace PrestoPlayer\Services;

/**
 * Persists per-user progress on the Learn tab cards in user meta.
 */
class Learn {

	/**
	 * User meta key for storing learn progress.
	 *
	 * @var string
	 */
	const META_KEY = 'presto_player_learn_progress';

	/**
	 * Register hooks.
	 */
	public function register() {
		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
	}

	/**
	 * Register REST API routes.
	 */
	public function register_rest_routes() {
		register_rest_route(
			'presto-player/v1',
			'/get-learn-chapters',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_learn_chapters' ),
				'permission_callback' => function () {
					return current_user_can( 'publish_posts' );
				},
			)
		);

		register_rest_route(
			'presto-player/v1',
			'/update-learn-progress',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'save_learn_progress' ),
				'permission_callback' => function () {
					return current_user_can( 'publish_posts' );
				},
				'args'                => array(
					'chapterId' => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'stepId'    => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'completed' => array(
						'required' => true,
						'type'     => 'boolean',
					),
				),
			)
		);
	}

	/**
	 * Get chapters with user progress merged.
	 *
	 * Returns the chapters array directly (not wrapped),
	 * matching the shape consumed by src/admin/dashboard/pages/learn/.
	 *
	 * @return \WP_REST_Response
	 */
	public function get_learn_chapters() {
		$chapters = self::get_chapters_structure();
		$progress = get_user_meta( get_current_user_id(), self::META_KEY, true );

		if ( ! is_array( $progress ) ) {
			$progress = array();
		}

		// Merge progress into chapters.
		foreach ( $chapters as &$chapter ) {
			$chapter_id = $chapter['id'];
			foreach ( $chapter['steps'] as &$step ) {
				$step_id           = $step['id'];
				$step['completed'] = ! empty( $progress[ $chapter_id ][ $step_id ] );
			}
		}

		return new \WP_REST_Response( $chapters, 200 );
	}

	/**
	 * Save progress for a single step.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response
	 */
	public function save_learn_progress( $request ) {
		$chapter_id = $request->get_param( 'chapterId' );
		$step_id    = $request->get_param( 'stepId' );
		$completed  = (bool) $request->get_param( 'completed' );

		$user_id  = get_current_user_id();
		$progress = get_user_meta( $user_id, self::META_KEY, true );

		if ( ! is_array( $progress ) ) {
			$progress = array();
		}

		if ( ! isset( $progress[ $chapter_id ] ) ) {
			$progress[ $chapter_id ] = array();
		}

		$progress[ $chapter_id ][ $step_id ] = $completed;

		update_user_meta( $user_id, self::META_KEY, $progress );

		/**
		 * Fires after learn progress is saved for the current user.
		 *
		 * @param array $progress Full progress array for the user (all chapters/steps).
		 */
		do_action( 'presto_player_learn_progress_saved', $progress );

		return new \WP_REST_Response(
			array(
				'success' => true,
			),
			200
		);
	}

	/**
	 * Check if all steps in a chapter are completed for the given progress.
	 *
	 * @param array $chapter  Single chapter array from get_chapters_structure().
	 * @param array $progress Full progress array (chapter_id => step_id => bool).
	 * @return bool True if every step in the chapter is completed.
	 */
	public static function is_chapter_complete( $chapter, $progress ) {
		$chapter_id = isset( $chapter['id'] ) ? $chapter['id'] : '';
		if ( empty( $chapter_id ) || empty( $chapter['steps'] ) || ! is_array( $chapter['steps'] ) ) {
			return false;
		}

		foreach ( $chapter['steps'] as $step ) {
			$step_id = isset( $step['id'] ) ? $step['id'] : '';
			if ( empty( $step_id ) ) {
				continue;
			}
			if ( empty( $progress[ $chapter_id ][ $step_id ] ) ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Get the chapters and steps structure.
	 *
	 * Shape (mirrors the SureDash Learn module so the admin dashboard
	 * components render uniformly across both plugins):
	 *  - chapter.id           string Kebab-case identifier.
	 *  - chapter.title        string Localized heading.
	 *  - chapter.description  string Localized subheading shown under the title.
	 *  - chapter.docsUrl      string Optional "Learn how" external link.
	 *  - chapter.steps        array  Ordered list of step arrays.
	 *
	 *  - step.id           string Unique within the chapter.
	 *  - step.title        string Localized step title.
	 *  - step.description  string Localized body copy shown when expanded.
	 *  - step.docsUrl      string Optional "Read documentation" link.
	 *  - step.headerAction array  { label, url } — optional primary CTA.
	 *  - step.isPro        bool   Whether the step is a Pro upsell.
	 *  - step.screenshot   array  { url, alt } — optional screenshot image.
	 *
	 * Optional string fields default to empty; the frontend hides the
	 * corresponding affordance when empty. `completed` is injected by
	 * get_learn_chapters() from user meta and is not part of this static tree.
	 *
	 * @return array
	 */
	public static function get_chapters_structure() {
		$dashboard_base = 'admin.php?page=presto-dashboard&post_type=pp_video_block';

		return array(
			// Chapter 1 — Getting Started.
			array(
				'id'          => 'getting-started',
				'title'       => __( 'Getting Started', 'presto-player' ),
				'description' => __( 'Create your first video and learn the core Presto Player workflow.', 'presto-player' ),
				'docsUrl'     => '',
				'steps'       => array(
					array(
						'id'           => 'add-first-video',
						'title'        => __( 'Add a Presto Player video block', 'presto-player' ),
						'description'  => __( 'Create a Presto Player video block in the block editor and embed your first video — from YouTube, Vimeo, or a self-hosted file.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/using-presto-player-with-gutenberg/',
						'headerAction' => array(
							'label' => __( 'Create Video', 'presto-player' ),
							'url'   => admin_url( 'post-new.php?post_type=pp_video_block' ),
						),
						'isPro'        => false,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/Add-New-Media-Presto.jpg',
							'alt' => __( 'Add a Presto Player video block', 'presto-player' ),
						),
					),
					array(
						'id'           => 'choose-video-source',
						'title'        => __( 'Choose your video source', 'presto-player' ),
						'description'  => __( 'Learn the difference between YouTube, Vimeo, self-hosted, and Bunny.net — pick the right source for your use case.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/presto-player-any-host/',
						'headerAction' => array(
							'label' => '',
							'url'   => '',
						),
						'isPro'        => false,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/Choose-Your-Media-Source-Presto.jpg',
							'alt' => __( 'Choose your video source', 'presto-player' ),
						),
					),
					array(
						'id'           => 'manage-media-hub',
						'title'        => __( 'Manage your Media Hub', 'presto-player' ),
						'description'  => __( 'Browse, search, and organize all your videos in one central library. The Media Hub is your video command center.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/video-sync/',
						'headerAction' => array(
							'label' => __( 'Open Media Hub', 'presto-player' ),
							'url'   => admin_url( $dashboard_base . '&tab=MediaHub' ),
						),
						'isPro'        => false,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/05/Screenshot-2026-05-07-at-2.11.19-PM-1-scaled.png',
							'alt' => __( 'Manage your Media Hub', 'presto-player' ),
						),
					),
					array(
						'id'           => 'use-shortcodes',
						'title'        => __( 'Use shortcodes to embed anywhere', 'presto-player' ),
						'description'  => __( 'Copy a shortcode from the Media Hub to embed videos in widgets, classic editor, or any page builder that supports shortcodes.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/presto-shortcodes/',
						'headerAction' => array(
							'label' => __( 'View Media Hub', 'presto-player' ),
							'url'   => admin_url( $dashboard_base . '&tab=MediaHub' ),
						),
						'isPro'        => false,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/Screenshot-2026-04-28-at-11.15.02-PM.png',
							'alt' => __( 'Use shortcodes to embed anywhere', 'presto-player' ),
						),
					),
				),
			),
			// Chapter 2 — Player Customization.
			array(
				'id'          => 'player-customization',
				'title'       => __( 'Player Customization', 'presto-player' ),
				'description' => __( 'Fine-tune how your videos look, feel, and behave.', 'presto-player' ),
				'docsUrl'     => '',
				'steps'       => array(
					array(
						'id'           => 'customize-controls',
						'title'        => __( 'Customize player controls', 'presto-player' ),
						'description'  => __( 'Choose which controls are visible — play, progress, volume, speed, fullscreen, PiP, and more.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/how-to-use-video-presets/',
						'headerAction' => array(
							'label' => __( 'Edit Preset', 'presto-player' ),
							'url'   => admin_url( $dashboard_base . '&tab=Settings&section=presets' ),
						),
						'isPro'        => false,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/Edit-Preset-Presto.jpg',
							'alt' => __( 'Customize player controls', 'presto-player' ),
						),
					),
					array(
						'id'           => 'configure-playback',
						'title'        => __( 'Configure playback behavior', 'presto-player' ),
						'description'  => __( 'Set autoplay, muted start, save position, play-in-viewport, and preload options per preset.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/play-inline-option-explained/',
						'headerAction' => array(
							'label' => __( 'Edit Preset', 'presto-player' ),
							'url'   => admin_url( $dashboard_base . '&tab=Settings&section=presets' ),
						),
						'isPro'        => false,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/Configure-Playback-Behavior-Presto.jpg',
							'alt' => __( 'Configure playback behavior', 'presto-player' ),
						),
					),
					array(
						'id'           => 'add-captions',
						'title'        => __( 'Add captions & subtitles', 'presto-player' ),
						'description'  => __( 'Upload SRT/VTT caption files or enable auto-generated captions to make your videos accessible.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/how-to-create-video-captions/',
						'headerAction' => array(
							'label' => '',
							'url'   => '',
						),
						'isPro'        => false,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/Upload-Captions-for-Bunny-Presto.jpg',
							'alt' => __( 'Add captions and subtitles', 'presto-player' ),
						),
					),
					array(
						'id'           => 'add-timestamps',
						'title'        => __( 'Add chapters to videos', 'presto-player' ),
						'description'  => __( 'Create clickable chapter markers so viewers can jump to specific sections inside a video.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/presto-timestamps/',
						'headerAction' => array(
							'label' => '',
							'url'   => '',
						),
						'isPro'        => false,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/Add-Clickable-Chapters-Presto.jpg',
							'alt' => __( 'Add chapters to videos', 'presto-player' ),
						),
					),
					array(
						'id'           => 'setup-audio',
						'title'        => __( 'Set up audio playback', 'presto-player' ),
						'description'  => __( 'Use the dedicated audio block for podcasts, music, or voice content — same preset system as video.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/presto-player-audio/',
						'headerAction' => array(
							'label' => '',
							'url'   => '',
						),
						'isPro'        => false,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/Presto-Audio-Playback-Presto-Player.jpg',
							'alt' => __( 'Set up audio playback', 'presto-player' ),
						),
					),
					array(
						'id'           => 'add-custom-css',
						'title'        => __( 'Add custom CSS to the player', 'presto-player' ),
						'description'  => __( 'Inject custom CSS for advanced visual tweaks beyond the built-in branding options.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/how-to-customize-presets/',
						'headerAction' => array(
							'label' => __( 'Edit Custom CSS', 'presto-player' ),
							'url'   => admin_url( $dashboard_base . '&tab=Settings&section=custom-css' ),
						),
						'isPro'        => true,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/Screenshot-2026-04-28-at-11.03.38-PM-scaled.png',
							'alt' => __( 'Add custom CSS to the player', 'presto-player' ),
						),
					),
				),
			),
			// Chapter 3 — Branding & Presets.
			array(
				'id'          => 'branding-presets',
				'title'       => __( 'Branding & Presets', 'presto-player' ),
				'description' => __( 'Match the player to your brand and save reusable configurations.', 'presto-player' ),
				'docsUrl'     => '',
				'steps'       => array(
					array(
						'id'           => 'set-brand-color',
						'title'        => __( 'Set your brand color', 'presto-player' ),
						'description'  => __( 'Choose a color for the play button, progress bar, and interactive elements to match your site identity.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/how-to-customize-presets/',
						'headerAction' => array(
							'label' => __( 'Set Color', 'presto-player' ),
							'url'   => admin_url( $dashboard_base . '&tab=Settings&section=branding' ),
						),
						'isPro'        => false,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/Setup-Brand-Color-Presto.jpg',
							'alt' => __( 'Set your brand color', 'presto-player' ),
						),
					),
					array(
						'id'           => 'create-preset',
						'title'        => __( 'Create a video preset', 'presto-player' ),
						'description'  => __( 'Save a reusable preset with your preferred controls, autoplay, and style settings — apply it across multiple videos in one click.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/video-presets/',
						'headerAction' => array(
							'label' => __( 'Create Preset', 'presto-player' ),
							'url'   => admin_url( $dashboard_base . '&tab=Settings&section=presets' ),
						),
						'isPro'        => false,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/Create-a-New-Preset-Presto.jpg',
							'alt' => __( 'Create a video preset', 'presto-player' ),
						),
					),
					array(
						'id'           => 'add-logo',
						'title'        => __( 'Add a logo watermark', 'presto-player' ),
						'description'  => __( 'Upload your logo to display as a clickable watermark on your videos — professional branding in one click.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/dynamic-watermark/',
						'headerAction' => array(
							'label' => __( 'Upload Logo', 'presto-player' ),
							'url'   => admin_url( $dashboard_base . '&tab=Settings&section=branding' ),
						),
						'isPro'        => true,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/Add-Logo-Watermark-in-Preset-Presto.jpg',
							'alt' => __( 'Add a logo watermark', 'presto-player' ),
						),
					),
				),
			),
			// Chapter 4 — Embedding & Page Builders.
			array(
				'id'          => 'embedding-page-builders',
				'title'       => __( 'Embedding & Page Builders', 'presto-player' ),
				'description' => __( 'Place videos anywhere on your site — Gutenberg, Elementor, Divi, Beaver Builder, or shortcodes.', 'presto-player' ),
				'docsUrl'     => '',
				'steps'       => array(
					array(
						'id'           => 'embed-gutenberg',
						'title'        => __( 'Add a video in Gutenberg', 'presto-player' ),
						'description'  => __( 'Open the block editor, add a Presto Player block, select your video source, and publish.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/using-presto-player-with-gutenberg/',
						'headerAction' => array(
							'label' => __( 'Add to Page', 'presto-player' ),
							'url'   => admin_url( 'post-new.php' ),
						),
						'isPro'        => false,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/Add-Presto-Block-in-Gutenberg-Presto.jpg',
							'alt' => __( 'Add a video in Gutenberg', 'presto-player' ),
						),
					),
					array(
						'id'           => 'embed-elementor',
						'title'        => __( 'Add a video in Elementor', 'presto-player' ),
						'description'  => __( 'Use the Presto Player Elementor widget to embed videos in any Elementor layout or template.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/using-presto-player-with-elementor/',
						'headerAction' => array(
							'label' => '',
							'url'   => '',
						),
						'isPro'        => false,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/Add-Presto-Widget-using-Elementor-Presto.jpg',
							'alt' => __( 'Add a video in Elementor', 'presto-player' ),
						),
					),
					array(
						'id'           => 'embed-beaver-builder',
						'title'        => __( 'Add a video in Beaver Builder', 'presto-player' ),
						'description'  => __( 'Use the Presto Player module inside any Beaver Builder page or template.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/using-presto-player-with-beaver-builder/',
						'headerAction' => array(
							'label' => '',
							'url'   => '',
						),
						'isPro'        => false,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/Add-Presto-module-in-Beaver-Builder.jpg',
							'alt' => __( 'Add a video in Beaver Builder', 'presto-player' ),
						),
					),
					array(
						'id'           => 'embed-classic-editor',
						'title'        => __( 'Use with the Classic Editor', 'presto-player' ),
						'description'  => __( 'Embed videos via shortcodes in the classic WordPress editor — paste the shortcode and publish.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/use-with-classic-editor/',
						'headerAction' => array(
							'label' => '',
							'url'   => '',
						),
						'isPro'        => false,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/ce-classic-editor-shortcode-scaled.png',
							'alt' => __( 'Use with the Classic Editor', 'presto-player' ),
						),
					),
					array(
						'id'           => 'create-popup',
						'title'        => __( 'Create a video popup', 'presto-player' ),
						'description'  => __( 'Launch videos in a lightbox popup triggered by a button, image, or link — grab attention without leaving the page.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/presto-popups/',
						'headerAction' => array(
							'label' => __( 'Try Popups', 'presto-player' ),
							'url'   => admin_url( 'post-new.php?post_type=page' ),
						),
						'isPro'        => true,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/Add-Presto-Popups-Presto-Player.jpg',
							'alt' => __( 'Create a video popup', 'presto-player' ),
						),
					),
					array(
						'id'           => 'create-playlist',
						'title'        => __( 'Create a playlist', 'presto-player' ),
						'description'  => __( 'Group related videos into a sequential playlist — perfect for course modules, series, or curated content collections.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/presto-player-playlists/',
						'headerAction' => array(
							'label' => __( 'Create Playlist', 'presto-player' ),
							'url'   => admin_url( 'post-new.php?post_type=page' ),
						),
						'isPro'        => true,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/Presto-Playlist-Block-Presto-.jpg',
							'alt' => __( 'Create a playlist', 'presto-player' ),
						),
					),
				),
			),
			// Chapter 5 — Analytics & Engagement.
			array(
				'id'          => 'analytics-engagement',
				'title'       => __( 'Analytics & Engagement', 'presto-player' ),
				'description' => __( 'Track how your audience watches and turn viewers into leads.', 'presto-player' ),
				'docsUrl'     => '',
				'steps'       => array(
					array(
						'id'           => 'enable-analytics',
						'title'        => __( 'Enable analytics', 'presto-player' ),
						'description'  => __( 'Turn on view tracking to collect watch data — views, watch time, and engagement — for every video on your site.', 'presto-player' ),
						'docsUrl'      => '',
						'headerAction' => array(
							'label' => __( 'Enable Analytics', 'presto-player' ),
							'url'   => admin_url( $dashboard_base . '&tab=Settings&section=viewing-analytics' ),
						),
						'isPro'        => true,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/Enable-Analytics-Presto.jpg',
							'alt' => __( 'Enable analytics', 'presto-player' ),
						),
					),
					array(
						'id'           => 'view-insights',
						'title'        => __( 'View video insights', 'presto-player' ),
						'description'  => __( 'See total views, average watch time, and engagement trends per video from the Analytics dashboard.', 'presto-player' ),
						'docsUrl'      => '',
						'headerAction' => array(
							'label' => __( 'View Analytics', 'presto-player' ),
							'url'   => admin_url( $dashboard_base . '&tab=Analytics' ),
						),
						'isPro'        => true,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/View-Analytics-Presto.jpg',
							'alt' => __( 'View video insights', 'presto-player' ),
						),
					),
					array(
						'id'           => 'track-user-engagement',
						'title'        => __( 'Track per-user engagement', 'presto-player' ),
						'description'  => __( 'See exactly who watched what and for how long — powerful for course creators and membership sites.', 'presto-player' ),
						'docsUrl'      => '',
						'headerAction' => array(
							'label' => __( 'View Analytics', 'presto-player' ),
							'url'   => admin_url( $dashboard_base . '&tab=Analytics' ),
						),
						'isPro'        => true,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/Track-Per-User-Engagement-Presto.jpg',
							'alt' => __( 'Track per-user engagement', 'presto-player' ),
						),
					),
					array(
						'id'           => 'setup-email-capture',
						'title'        => __( 'Set up email capture', 'presto-player' ),
						'description'  => __( 'Capture email addresses mid-video and sync subscribers with your email marketing tool automatically.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/how-to-capture-emails/',
						'headerAction' => array(
							'label' => __( 'Configure Email', 'presto-player' ),
							'url'   => admin_url( $dashboard_base . '&tab=Settings&section=email-capture' ),
						),
						'isPro'        => true,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/Email-Capture-Presto.jpg',
							'alt' => __( 'Set up email capture', 'presto-player' ),
						),
					),
					array(
						'id'           => 'connect-google-analytics',
						'title'        => __( 'Connect Google Analytics', 'presto-player' ),
						'description'  => __( 'Send video play events to your existing GA4 property for unified site-wide analytics tracking.', 'presto-player' ),
						'docsUrl'      => '',
						'headerAction' => array(
							'label' => __( 'Configure GA', 'presto-player' ),
							'url'   => admin_url( $dashboard_base . '&tab=Settings&section=google-analytics' ),
						),
						'isPro'        => true,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/Connect-Presto-with-Existing-GA-Presto.jpg',
							'alt' => __( 'Connect Google Analytics', 'presto-player' ),
						),
					),
				),
			),
			// Chapter 6 — Integrations & Advanced.
			array(
				'id'          => 'integrations-advanced',
				'title'       => __( 'Integrations & Advanced', 'presto-player' ),
				'description' => __( 'Connect Presto Player with your LMS, CDN, CRM, and SEO tools.', 'presto-player' ),
				'docsUrl'     => '',
				'steps'       => array(
					array(
						'id'           => 'connect-bunny',
						'title'        => __( 'Connect Bunny.net for private hosting', 'presto-player' ),
						'description'  => __( 'Set up Bunny.net Stream for CDN-powered private video hosting with adaptive HLS streaming — fast, secure, global.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/bunnycdn/',
						'headerAction' => array(
							'label' => __( 'Connect Bunny', 'presto-player' ),
							'url'   => admin_url( $dashboard_base . '&tab=Settings&section=bunny-net' ),
						),
						'isPro'        => true,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/PP-BNS-01.png',
							'alt' => __( 'Connect Bunny.net for private hosting', 'presto-player' ),
						),
					),
					array(
						'id'           => 'use-bunny-library',
						'title'        => __( 'Use the Bunny.net video library', 'presto-player' ),
						'description'  => __( 'Browse and embed videos directly from your Bunny.net library without leaving WordPress.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/bunnynet-video-library-integration/',
						'headerAction' => array(
							'label' => '',
							'url'   => '',
						),
						'isPro'        => true,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/Connect-BunnyNet-Videos-Presto.jpg',
							'alt' => __( 'Use the Bunny.net video library', 'presto-player' ),
						),
					),
					array(
						'id'           => 'auto-captions-bunny',
						'title'        => __( 'Enable automatic captions', 'presto-player' ),
						'description'  => __( 'Let Bunny.net auto-transcribe your videos and generate caption files — hands-free accessibility.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/automatic-captions/',
						'headerAction' => array(
							'label' => '',
							'url'   => '',
						),
						'isPro'        => true,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/Enable-Automatic-Captions-Presto.jpg',
							'alt' => __( 'Enable automatic captions', 'presto-player' ),
						),
					),
					array(
						'id'           => 'integrate-learndash',
						'title'        => __( 'Integrate with LearnDash', 'presto-player' ),
						'description'  => __( 'Track video progress as course completion — students must watch to advance to the next lesson.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/use-presto-player-with-learndash/',
						'headerAction' => array(
							'label' => '',
							'url'   => '',
						),
						'isPro'        => true,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2021/12/pp-1-7-video-progresion-learndash.png',
							'alt' => __( 'Integrate with LearnDash', 'presto-player' ),
						),
					),
					array(
						'id'           => 'integrate-lifterlms',
						'title'        => __( 'Integrate with LifterLMS', 'presto-player' ),
						'description'  => __( 'Connect Presto Player with LifterLMS for video-based course progression and completion tracking.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/lifterlms-advanced-videos-presto-player/',
						'headerAction' => array(
							'label' => '',
							'url'   => '',
						),
						'isPro'        => true,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2021/11/pp-lifter-settings-courses.png',
							'alt' => __( 'Integrate with LifterLMS', 'presto-player' ),
						),
					),
					array(
						'id'           => 'integrate-tutorlms',
						'title'        => __( 'Integrate with TutorLMS', 'presto-player' ),
						'description'  => __( 'Use Presto Player as the video engine for TutorLMS courses — full progress tracking included.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/tutorlms/',
						'headerAction' => array(
							'label' => '',
							'url'   => '',
						),
						'isPro'        => true,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2024/06/video-source.png',
							'alt' => __( 'Integrate with TutorLMS', 'presto-player' ),
						),
					),
					array(
						'id'           => 'connect-fluent-crm',
						'title'        => __( 'Connect Fluent CRM', 'presto-player' ),
						'description'  => __( 'Sync email captures and video engagement data with Fluent CRM for automated marketing workflows.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/fluent-crm-presto-player/',
						'headerAction' => array(
							'label' => '',
							'url'   => '',
						),
						'isPro'        => true,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2021/10/image-3-2-1024x900.png',
							'alt' => __( 'Connect Fluent CRM', 'presto-player' ),
						),
					),
					array(
						'id'           => 'optimize-video-seo',
						'title'        => __( 'Optimize video SEO with RankMath', 'presto-player' ),
						'description'  => __( 'Add structured video schema data to boost search visibility — works automatically with RankMath.', 'presto-player' ),
						'docsUrl'      => 'https://prestoplayer.com/docs/seo-optimize-presto-player-videos-using-rank-math/',
						'headerAction' => array(
							'label' => '',
							'url'   => '',
						),
						'isPro'        => false,
						'screenshot'   => array(
							'url' => 'https://prestoplayer.com/wp-content/uploads/2026/04/PP-SEO-01.png',
							'alt' => __( 'Optimize video SEO with RankMath', 'presto-player' ),
						),
					),
				),
			),
		);
	}
}
