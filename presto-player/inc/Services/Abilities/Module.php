<?php
/**
 * Abilities API + MCP module bootstrap.
 *
 * Registers the presto-player ability category, all free abilities, and the
 * option that stores the two toggles (enabled, allow_changes). Pro abilities
 * are appended via the "presto_player_abilities" filter from pro's bootstrap.
 *
 * @package PrestoPlayer
 * @subpackage Services\Abilities
 */

namespace PrestoPlayer\Services\Abilities;

use PrestoPlayer\Contracts\Service;

/**
 * Service entry point for the Abilities API integration.
 */
class Module implements Service {

	/**
	 * Option key for the two toggles (enabled, allow_changes).
	 *
	 * @var string
	 */
	public const OPTION_KEY = 'presto_player_mcp';

	/**
	 * Memoized list of collected ability instances, built once per request.
	 *
	 * @var Ability[]|null
	 */
	protected $abilities = null;

	/**
	 * Hook into WordPress.
	 *
	 * @return void
	 */
	public function register() {
		// The option and the read-only list route are always registered so the
		// MCP settings screen loads and saves cleanly. The abilities themselves
		// need the Abilities API (WordPress 6.9+); the UI disables the toggle and
		// shows a "requires 6.9" note when it's missing (abilitiesSupported flag).
		//
		// Defer option registration to `init` (matches Settings.php) so it runs
		// after translations load and isn't double-registered at plugin-load.
		add_action( 'init', array( $this, 'registerOption' ) );
		add_action( 'rest_api_init', array( $this, 'registerRestRoutes' ) );

		if ( ! function_exists( 'wp_register_ability' ) ) {
			return;
		}
		add_action( 'wp_abilities_api_categories_init', array( $this, 'registerCategory' ) );
		add_action( 'wp_abilities_api_init', array( $this, 'registerAll' ) );
		add_action( 'mcp_adapter_init', array( $this, 'registerMcpServer' ) );
	}

	/**
	 * Register the read-only REST route that powers the admin abilities list.
	 *
	 * @return void
	 */
	public function registerRestRoutes() {
		register_rest_route(
			'presto-player/v1',
			'/abilities',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'getAbilitiesList' ),
				'permission_callback' => function () {
					return current_user_can( 'manage_options' );
				},
			)
		);
	}

	/**
	 * Return the registered ability catalog (name/label/description/type/tier)
	 * plus counts, for the settings UI. Active/inactive is derived client-side
	 * from the two toggles, so this stays a pure catalog.
	 *
	 * @return \WP_REST_Response
	 */
	public function getAbilitiesList() {
		$items   = array();
		$present = array();

		foreach ( $this->collectAbilities() as $ability ) {
			$name             = $ability->getName();
			$present[ $name ] = true;
			$items[]          = array(
				'name'        => $name,
				'label'       => $ability->getLabel(),
				'description' => $ability->getDescription(),
				'type'        => $this->abilityType( $ability->getAnnotations() ),
				'tier'        => ( 0 === strpos( $name, 'presto-player-pro/' ) ) ? 'pro' : 'free',
				'available'   => true,
				'upcoming'    => false,
			);
		}

		// Display-only pro catalog: surface pro abilities even when the pro
		// plugin is inactive so users can see what pro unlocks. These entries
		// are never registered nor exposed as MCP tools — registerAll() and
		// registerMcpServer() iterate collectAbilities() only, not this list.
		foreach ( $this->proCatalog() as $entry ) {
			if ( isset( $present[ $entry['name'] ] ) ) {
				continue;
			}
			$items[] = array(
				'name'        => $entry['name'],
				'label'       => $entry['label'],
				'description' => $entry['description'],
				'type'        => $entry['type'],
				'tier'        => 'pro',
				'available'   => false,
				'upcoming'    => false,
			);
		}

		// Display-only roadmap catalog: presets, LMS and playlist abilities are
		// built but held back from this release, so they show as "Upcoming" in
		// the dashboard instead of silently disappearing from the list.
		foreach ( $this->upcomingCatalog() as $entry ) {
			if ( isset( $present[ $entry['name'] ] ) ) {
				continue;
			}
			$items[] = array(
				'name'        => $entry['name'],
				'label'       => $entry['label'],
				'description' => $entry['description'],
				'type'        => $entry['type'],
				'tier'        => $entry['tier'],
				'available'   => false,
				'upcoming'    => true,
			);
		}

		$free = 0;
		$pro  = 0;
		foreach ( $items as $item ) {
			if ( 'pro' === $item['tier'] ) {
				++$pro;
			} else {
				++$free;
			}
		}

		return rest_ensure_response(
			array(
				'abilities' => $items,
				'counts'    => array(
					'total' => count( $items ),
					'free'  => $free,
					'pro'   => $pro,
				),
			)
		);
	}

	/**
	 * Display-only manifest of pro abilities, shown in the dashboard list when
	 * the pro plugin is inactive (its ability classes are not loaded then, so
	 * this metadata is mirrored here). Kept in sync with the pro contract via
	 * AbilityContractTest. Never used for registration or MCP exposure.
	 *
	 * @return array<int, array{name: string, label: string, description: string, type: string}>
	 */
	protected function proCatalog() {
		return array(
			array(
				'name'        => 'presto-player-pro/list-top-videos',
				'label'       => __( 'List top videos', 'presto-player' ),
				'description' => __( 'Returns videos ordered by view count for an optional date range.', 'presto-player' ),
				'type'        => 'read',
			),
			array(
				'name'        => 'presto-player-pro/list-top-viewers',
				'label'       => __( 'List top viewers', 'presto-player' ),
				'description' => __( 'Returns users ordered by total view count for an optional date range.', 'presto-player' ),
				'type'        => 'read',
			),
			array(
				'name'        => 'presto-player-pro/get-video-views',
				'label'       => __( 'Get video views', 'presto-player' ),
				'description' => __( 'Returns the total number of views for one video over an optional date range.', 'presto-player' ),
				'type'        => 'read',
			),
			array(
				'name'        => 'presto-player-pro/get-video-drop-off',
				'label'       => __( 'Get video drop-off curve', 'presto-player' ),
				'description' => __( 'Returns retention buckets for a video — how many viewers were still watching at each timeline point.', 'presto-player' ),
				'type'        => 'read',
			),
			array(
				'name'        => 'presto-player-pro/captions-translate',
				'label'       => __( 'Translate captions', 'presto-player' ),
				'description' => __( 'Translates an existing transcript on a Bunny video into one or more target languages.', 'presto-player' ),
				'type'        => 'write',
			),
			array(
				'name'        => 'presto-player-pro/upload-bunny-video',
				'label'       => __( 'Create Bunny Stream video', 'presto-player' ),
				'description' => __( 'Uploads a video to Bunny Stream from a Media Library attachment, a file URL, or raw base64 bytes, and returns an embeddable Media Hub video.', 'presto-player' ),
				'type'        => 'write',
			),
			array(
				'name'        => 'presto-player-pro/create-video-bunny',
				'label'       => __( 'Add Bunny video', 'presto-player' ),
				'description' => __( 'Adds an existing Bunny Stream video (by GUID) to the Media Hub and returns a ready-to-embed shortcode and block.', 'presto-player' ),
				'type'        => 'write',
			),
			array(
				'name'        => 'presto-player-pro/list-bunny-collections',
				'label'       => __( 'List Bunny collections', 'presto-player' ),
				'description' => __( 'Returns all Bunny Stream collections for the active library.', 'presto-player' ),
				'type'        => 'read',
			),
		);
	}

	/**
	 * Display-only manifest of abilities that are implemented but deferred to a
	 * later release. Listed in the dashboard with an "Upcoming" badge so the
	 * roadmap is visible; never registered and never exposed as MCP tools.
	 *
	 * @return array<int, array{name: string, label: string, description: string, type: string, tier: string}>
	 */
	protected function upcomingCatalog() {
		return array(
			array(
				'name'        => 'presto-player/get-video-attributes',
				'label'       => __( 'Get video attributes', 'presto-player' ),
				'description' => __( 'Returns how one video is configured in the editor — its preset, poster, caption tracks, overlays and playback toggles.', 'presto-player' ),
				'type'        => 'read',
				'tier'        => 'free',
			),
			array(
				'name'        => 'presto-player/update-video-attributes',
				'label'       => __( 'Update video attributes', 'presto-player' ),
				'description' => __( 'Changes how one video is configured — assign a preset, set the poster, replace caption tracks or overlays, or flip the playback toggles.', 'presto-player' ),
				'type'        => 'destructive',
				'tier'        => 'free',
			),
			array(
				'name'        => 'presto-player/list-video-tags',
				'label'       => __( 'List video tags', 'presto-player' ),
				'description' => __( 'Returns the Media Tags in the library with how many videos each one holds.', 'presto-player' ),
				'type'        => 'read',
				'tier'        => 'free',
			),
			array(
				'name'        => 'presto-player/create-video-tag',
				'label'       => __( 'Create video tag', 'presto-player' ),
				'description' => __( 'Creates a Media Tag so videos can be tagged with it later. Calling it again returns the existing tag instead of a duplicate.', 'presto-player' ),
				'type'        => 'write',
				'tier'        => 'free',
			),
			array(
				'name'        => 'presto-player/rename-video-tag',
				'label'       => __( 'Rename video tag', 'presto-player' ),
				'description' => __( 'Renames a Media Tag, keeping it attached to every video that already has it.', 'presto-player' ),
				'type'        => 'write',
				'tier'        => 'free',
			),
			array(
				'name'        => 'presto-player/delete-video-tag',
				'label'       => __( 'Delete video tag', 'presto-player' ),
				'description' => __( 'Deletes a Media Tag, or folds it into another one. The videos themselves are never touched.', 'presto-player' ),
				'type'        => 'destructive',
				'tier'        => 'free',
			),
			array(
				'name'        => 'presto-player/list-presets',
				'label'       => __( 'List presets', 'presto-player' ),
				'description' => __( 'Returns every player preset with its id, name and settings.', 'presto-player' ),
				'type'        => 'read',
				'tier'        => 'free',
			),
			array(
				'name'        => 'presto-player/get-preset',
				'label'       => __( 'Get preset', 'presto-player' ),
				'description' => __( 'Returns one player preset by id, including all of its settings.', 'presto-player' ),
				'type'        => 'read',
				'tier'        => 'free',
			),
			array(
				'name'        => 'presto-player/create-preset',
				'label'       => __( 'Create preset', 'presto-player' ),
				'description' => __( 'Creates a new player preset and returns it.', 'presto-player' ),
				'type'        => 'write',
				'tier'        => 'free',
			),
			array(
				'name'        => 'presto-player/update-preset',
				'label'       => __( 'Update preset', 'presto-player' ),
				'description' => __( 'Updates the name and settings of an existing player preset.', 'presto-player' ),
				'type'        => 'write',
				'tier'        => 'free',
			),
			array(
				'name'        => 'presto-player/delete-preset',
				'label'       => __( 'Delete preset', 'presto-player' ),
				'description' => __( 'Permanently deletes a player preset.', 'presto-player' ),
				'type'        => 'destructive',
				'tier'        => 'free',
			),
			array(
				'name'        => 'presto-player-pro/captions-list',
				'label'       => __( 'List caption tracks', 'presto-player' ),
				'description' => __( 'Returns the caption tracks on a video with their languages, so you can check what is already captioned.', 'presto-player' ),
				'type'        => 'read',
				'tier'        => 'pro',
			),
			array(
				'name'        => 'presto-player-pro/captions-upload',
				'label'       => __( 'Upload a caption track', 'presto-player' ),
				'description' => __( 'Puts a WebVTT caption file on a self-hosted or Bunny video.', 'presto-player' ),
				'type'        => 'write',
				'tier'        => 'pro',
			),
			array(
				'name'        => 'presto-player-pro/captions-bulk-upload',
				'label'       => __( 'Bulk upload caption tracks', 'presto-player' ),
				'description' => __( 'Puts a WebVTT caption file on each of several videos in one call, reporting on every item individually.', 'presto-player' ),
				'type'        => 'write',
				'tier'        => 'pro',
			),
			array(
				'name'        => 'presto-player-pro/captions-transcribe-bunny',
				'label'       => __( 'Transcribe Bunny video', 'presto-player' ),
				'description' => __( 'Asks Bunny.net to auto-transcribe a video. Requires an active Bunny Stream library + transcription enabled.', 'presto-player' ),
				'type'        => 'write',
				'tier'        => 'pro',
			),
			array(
				'name'        => 'presto-player-pro/captions-bulk-translate-collection',
				'label'       => __( 'Bulk translate collection captions', 'presto-player' ),
				'description' => __( 'Iterates videos in a Bunny collection and queues transcription + translation into N target languages for each.', 'presto-player' ),
				'type'        => 'write',
				'tier'        => 'pro',
			),
			array(
				'name'        => 'presto-player/link-video-to-learndash-step',
				'label'       => __( 'Link video to LearnDash step', 'presto-player' ),
				'description' => __( 'Embeds a Presto Player video into a LearnDash lesson or topic. Requires LearnDash to be active.', 'presto-player' ),
				'type'        => 'write',
				'tier'        => 'free',
			),
			array(
				'name'        => 'presto-player-pro/create-playlist',
				'label'       => __( 'Build playlist from a list of videos', 'presto-player' ),
				'description' => __( 'Builds a playlist from an ordered list of videos, publishes it as a page, and returns the page URL.', 'presto-player' ),
				'type'        => 'write',
				'tier'        => 'pro',
			),
			array(
				'name'        => 'presto-player-pro/update-playlist',
				'label'       => __( 'Reorder or replace playlist videos', 'presto-player' ),
				'description' => __( 'Sets the videos on an existing playlist to a new ordered list — reorder, add, or remove videos.', 'presto-player' ),
				'type'        => 'write',
				'tier'        => 'pro',
			),
			array(
				'name'        => 'presto-player-pro/create-smart-playlist',
				'label'       => __( 'Build smart playlist', 'presto-player' ),
				'description' => __( 'Builds a playlist from a rule (most-watched, by tag, etc.), publishes it as a page, and returns the page URL.', 'presto-player' ),
				'type'        => 'write',
				'tier'        => 'pro',
			),
			array(
				'name'        => 'presto-player-pro/course-create-from-collection',
				'label'       => __( 'Build LMS course from Bunny collection', 'presto-player' ),
				'description' => __( 'Creates a LearnDash course and a lesson for every video in a Bunny collection. Requires LearnDash to be active.', 'presto-player' ),
				'type'        => 'write',
				'tier'        => 'pro',
			),
		);
	}

	/**
	 * Map an ability's annotations to a coarse type for the UI badge.
	 *
	 * @param array<string, bool> $annotations Ability annotations.
	 * @return string One of read|write|destructive.
	 */
	protected function abilityType( $annotations ) {
		if ( ! empty( $annotations['destructive'] ) ) {
			return 'destructive';
		}
		if ( ! empty( $annotations['readonly'] ) ) {
			return 'read';
		}
		return 'write';
	}

	/**
	 * Register the presto-player category on the correct early hook.
	 *
	 * Runs regardless of the master toggle so the category exists in the
	 * admin UI even when abilities are disabled.
	 *
	 * @return void
	 */
	public function registerCategory() {
		wp_register_ability_category(
			'presto-player',
			array(
				'label'       => __( 'Presto Player', 'presto-player' ),
				'description' => __( 'Video and audio player management abilities.', 'presto-player' ),
			)
		);
	}

	/**
	 * Register every gated ability.
	 *
	 * @return void
	 */
	public function registerAll() {
		if ( ! $this->isEnabled( 'enabled' ) ) {
			return;
		}

		foreach ( $this->collectAbilities() as $ability ) {
			if ( ! $this->shouldRegister( $ability ) ) {
				continue;
			}
			wp_register_ability( $ability->getName(), $ability->getConfig() );
		}
	}

	/**
	 * Build the ability list. Pro and 3rd parties append via filter.
	 *
	 * @return Ability[]
	 */
	protected function collectAbilities() {
		if ( null !== $this->abilities ) {
			return $this->abilities;
		}

		$abilities = array(
			new Abilities\GetSettingsAbility(),
			new Abilities\UpdateSettingsAbility(),
			new Abilities\CreateYouTubeVideoAbility(),
			new Abilities\CreateVimeoVideoAbility(),
			new Abilities\CreateSelfHostedVideoAbility(),
			new Abilities\GetVideoAbility(),
			new Abilities\ListVideosAbility(),
			new Abilities\UpdateVideoAbility(),
			new Abilities\DeleteVideoAbility(),
			new Abilities\GetVideoShortcodeAbility(),
			new Abilities\ChaptersListAbility(),
			new Abilities\ChaptersSaveAbility(),
			new Abilities\ChaptersGenerateFromCaptionsAbility(),
		);

		/**
		 * Filters the list of ability instances to register.
		 *
		 * Pro plugins and third parties append their own Ability
		 * instances here.
		 *
		 * @param Ability[] $abilities
		 */
		$this->abilities = apply_filters( 'presto_player_abilities', $abilities );

		return $this->abilities;
	}

	/**
	 * Annotation-driven gating: readonly abilities register when enabled;
	 * write and destructive abilities require the allow_changes toggle.
	 *
	 * @param Ability $ability Ability instance.
	 * @return bool
	 */
	protected function shouldRegister( Ability $ability ) {
		$annotations = $ability->getAnnotations();
		$readonly    = ! empty( $annotations['readonly'] );

		if ( $readonly ) {
			return true;
		}

		return $this->isEnabled( 'allow_changes' );
	}

	/**
	 * Look up one toggle.
	 *
	 * @param string $key One of "enabled", "allow_changes".
	 * @return bool
	 */
	protected function isEnabled( $key ) {
		$option = get_option( self::OPTION_KEY, array() );
		return ! empty( $option[ $key ] );
	}

	/**
	 * Register the two-toggle option so /wp/v2/settings exposes it.
	 *
	 * Public because it is hooked to `init` (WordPress invokes it as a callback).
	 *
	 * @return void
	 */
	public function registerOption() {
		register_setting(
			'presto_player',
			self::OPTION_KEY,
			array(
				'type'              => 'object',
				'show_in_rest'      => array(
					'schema' => array(
						'type'                 => 'object',
						'additionalProperties' => false,
						'properties'           => array(
							'enabled'       => array( 'type' => 'boolean' ),
							'allow_changes' => array( 'type' => 'boolean' ),
						),
					),
				),
				'default'           => array(
					'enabled'       => false,
					'allow_changes' => false,
				),
				'sanitize_callback' => array( $this, 'sanitizeOption' ),
			)
		);
	}

	/**
	 * Coerce option values to clean booleans.
	 *
	 * @param mixed $value Raw incoming value.
	 * @return array<string, bool>
	 */
	public function sanitizeOption( $value ) {
		return array(
			'enabled'       => ! empty( $value['enabled'] ),
			'allow_changes' => ! empty( $value['allow_changes'] ),
		);
	}

	/**
	 * Register the Presto Player MCP server with the MCP Adapter plugin.
	 *
	 * Hooked to "mcp_adapter_init". Bails when the master abilities toggle is
	 * off. Derives the tool list from the same collected, gated ability set
	 * registerAll() uses and exposes them via an HTTP transport at
	 * /wp-json/presto-player/v1/mcp.
	 *
	 * @param object $adapter MCP Adapter instance supplied by the plugin.
	 * @return void
	 */
	public function registerMcpServer( $adapter ) {
		if ( ! $this->isEnabled( 'enabled' ) ) {
			return;
		}

		$tools = array();

		foreach ( $this->collectAbilities() as $ability ) {
			if ( ! $this->shouldRegister( $ability ) ) {
				continue;
			}
			$tools[] = $ability->getName();
		}

		if ( empty( $tools ) ) {
			return;
		}

		if ( class_exists( '\WP\MCP\Transport\HttpTransport' ) ) {
			$transport_class = 'WP\\MCP\\Transport\\HttpTransport';
		} elseif ( class_exists( '\WP\MCP\Transport\Http\RestTransport' ) ) {
			$transport_class = 'WP\\MCP\\Transport\\Http\\RestTransport';
		} else {
			return;
		}

		// Guard against MCP-adapter API drift (the create_server signature is
		// version-specific): degrade gracefully instead of fataling on a hook.
		try {
			if ( ! is_callable( array( $adapter, 'create_server' ) ) ) {
				return;
			}
			$adapter->create_server(
				'presto-player',
				'presto-player/v1',
				'mcp',
				__( 'Presto Player MCP Server', 'presto-player' ),
				__( 'Presto Player MCP Server for video, captions, and analytics management.', 'presto-player' ),
				defined( 'PRESTO_PLAYER_VERSION' ) ? PRESTO_PLAYER_VERSION : '1.0.0',
				array( $transport_class ),
				'WP\\MCP\\Infrastructure\\ErrorHandling\\ErrorLogMcpErrorHandler',
				'WP\\MCP\\Infrastructure\\Observability\\NullMcpObservabilityHandler',
				$tools,
				array(),
				array(),
				// Without this the adapter falls back to a bare "read" check, which
				// let a Subscriber's Application Password enumerate every tool
				// schema. `edit_posts` is the floor the OAuth authorize flow grants
				// at (Endpoints::requiredCapabilityForScopes()), so gating harder
				// than that — on manage_options, say — locks an Editor or Author
				// out of the session their own grant just authorised. Execution
				// stays gated per ability on top of this.
				function () {
					return current_user_can( 'edit_posts' );
				}
			);
		} catch ( \Throwable $e ) {
			if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
				error_log( 'Presto Player MCP: create_server failed: ' . $e->getMessage() ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
			}
		}
	}
}
