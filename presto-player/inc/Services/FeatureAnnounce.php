<?php
/**
 * Feature announcement modal shown once after a plugin update.
 *
 * @package PrestoPlayer\Services
 */

namespace PrestoPlayer\Services;

/**
 * Shows a one-time modal introducing a major new feature after the user
 * updates the plugin. Currently announces AI Abilities.
 */
class FeatureAnnounce {

	/**
	 * Bump this when announcing a different feature — a new id means everyone
	 * sees the modal again, even people who dismissed the previous one.
	 */
	const ANNOUNCEMENT_ID = 'wp_abilities_v1';

	/**
	 * The release that introduced the feature being announced. Sites already on
	 * this version or newer never installed without it, so they don't need telling.
	 */
	const ANNOUNCED_IN_VERSION = '4.4.0';

	/**
	 * Last plugin version this install has seen. Empty on a fresh install.
	 */
	const SEEN_VERSION_OPTION = 'presto_player_seen_version';

	/**
	 * Announcement id waiting to be shown, set when the version changes.
	 */
	const PENDING_OPTION = 'presto_player_pending_announcement';

	/**
	 * Announcement ids the current user has closed.
	 */
	const DISMISSED_META = 'presto_player_dismissed_announcements';

	/**
	 * Nonce action for the dismiss request.
	 */
	const NONCE_ACTION = 'presto_dismiss_announcement';

	/**
	 * Resolved plugin version, cached for the request.
	 *
	 * @var string|null
	 */
	protected $version = null;

	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'admin_init', array( $this, 'trackVersion' ) );
		add_action( 'admin_footer', array( $this, 'render' ) );
		add_action( 'wp_ajax_presto_dismiss_announcement', array( $this, 'dismiss' ) );
	}

	/**
	 * Queue the announcement when the running version changes.
	 *
	 * @return void
	 */
	public function trackVersion() {
		$seen = get_option( self::SEEN_VERSION_OPTION, '' );
		if ( $this->version() === $seen ) {
			return;
		}

		// No recorded version means either a brand new install or the first load
		// after updating into the release that added this class.
		// onboarding_completed tells the two apart — it is backfilled for
		// pre-4.2.0 installs, so an established site always has it set.
		// Bail before stamping: a site whose backfill missed it would otherwise be
		// marked as caught up and could never be told about the feature.
		if ( '' === $seen && 'yes' !== get_option( 'presto_player_onboarding_completed', 'no' ) ) {
			return;
		}

		update_option( self::SEEN_VERSION_OPTION, $this->version() );

		// Only announce to sites that were here before the feature shipped. Without
		// this floor, a site that installs 4.5 in 2027 and updates to 4.5.1 gets a
		// full-screen "New in Presto Player" for something that predates it.
		if ( '' !== $seen && version_compare( $seen, self::ANNOUNCED_IN_VERSION, '>=' ) ) {
			return;
		}

		update_option( self::PENDING_OPTION, self::ANNOUNCEMENT_ID );
	}

	/**
	 * Whether the modal should be printed for this request.
	 *
	 * @return bool
	 */
	protected function shouldShow() {
		// manage_options, not the menu's publish_posts: the settings REST route
		// rejects anyone lower, so an author following the CTA just lands on a
		// "Couldn't load settings" page.
		if ( ! current_user_can( 'manage_options' ) ) {
			return false;
		}

		// Nothing to announce on WordPress versions without the Abilities API.
		if ( ! function_exists( 'wp_register_ability' ) ) {
			return false;
		}

		// Only after an update queued it — see trackVersion().
		if ( self::ANNOUNCEMENT_ID !== get_option( self::PENDING_OPTION, '' ) ) {
			return false;
		}

		if ( ! $this->onPrestoScreen() ) {
			return false;
		}

		return ! in_array( self::ANNOUNCEMENT_ID, $this->dismissed(), true );
	}

	/**
	 * Whether we are on one of Presto Player's own admin screens.
	 *
	 * The announcement belongs inside the plugin — it should not follow someone
	 * around the rest of WordPress.
	 *
	 * @return bool
	 */
	protected function onPrestoScreen() {
		if ( ! function_exists( 'get_current_screen' ) ) {
			return false;
		}

		$screen = get_current_screen();
		if ( ! $screen ) {
			return false;
		}

		// Media Hub list and editor.
		if ( 'pp_video_block' === $screen->post_type ) {
			return true;
		}

		// Every menu page hangs off the presto-dashboard slug, so the screen id
		// carries it — toplevel_page_presto-dashboard and friends.
		return false !== strpos( $screen->id, 'presto' );
	}

	/**
	 * Print the modal.
	 *
	 * @return void
	 */
	public function render() {
		if ( ! $this->shouldShow() ) {
			return;
		}

		$settings_url = admin_url( 'admin.php?page=presto-dashboard&tab=Settings&section=mcp' );

		$feats = array(
			array(
				'icon'  => 'wand',
				'label' => __( 'Create a video from a link', 'presto-player' ),
			),
			array(
				'icon'  => 'chart',
				'label' => __( 'Ask for your analytics', 'presto-player' ),
			),
			array(
				'icon'  => 'shield',
				'label' => __( 'Read-only until you allow more', 'presto-player' ),
			),
		);

		?>
		<div class="presto-announce" role="dialog" aria-modal="true" aria-labelledby="presto-announce-title">
			<div class="presto-announce__box" tabindex="-1">
				<button type="button" class="presto-announce__x" aria-label="<?php esc_attr_e( 'Close', 'presto-player' ); ?>">
					<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true" focusable="false"><path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
				</button>

				<?php $this->art(); ?>

				<div class="presto-announce__body">
					<p class="presto-announce__tag">
						<span class="presto-announce__tag-new">
							<?php esc_html_e( 'New in Presto Player', 'presto-player' ); ?>
						</span>
						<span class="presto-announce__tag-ver"><?php echo esc_html( $this->shortVersion() ); ?></span>
					</p>

					<h2 class="presto-announce__title" id="presto-announce-title">
						<?php esc_html_e( 'Talk to your video library', 'presto-player' ); ?>
					</h2>

					<p class="presto-announce__text">
						<?php esc_html_e( 'Connect Claude, ChatGPT or any MCP client to this site, then ask for what you want in plain words. You decide how much it is allowed to change.', 'presto-player' ); ?>
					</p>

					<ul class="presto-announce__feats">
						<?php foreach ( $feats as $feat ) : ?>
							<li>
								<?php $this->icon( $feat['icon'] ); ?>
								<span><?php echo esc_html( $feat['label'] ); ?></span>
							</li>
						<?php endforeach; ?>
					</ul>

					<div class="presto-announce__actions">
						<a class="presto-announce__cta" href="<?php echo esc_url( $settings_url ); ?>">
							<?php esc_html_e( 'Set up AI Abilities', 'presto-player' ); ?>
							<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true" focusable="false"><path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
						</a>
						<button type="button" class="presto-announce__close">
							<?php esc_html_e( 'Not now', 'presto-player' ); ?>
						</button>
					</div>
				</div>
			</div>
		</div>
		<?php

		$this->styles();
		$this->script();
	}

	/**
	 * Small line icon for a feature row.
	 *
	 * @param string $name Icon key.
	 * @return void
	 */
	protected function icon( $name ) {
		$paths = array(
			'wand'   => '<path d="M4 16l9-9m-2-3l.9 2.1L14 7l-2.1.9L11 10l-.9-2.1L8 7l2.1-.9zM16 12l.6 1.4L18 14l-1.4.6L16 16l-.6-1.4L14 14l1.4-.6z"/>',
			'chart'  => '<path d="M4 16V9m4 7V5m4 11v-5m4 5V8"/>',
			'shield' => '<path d="M10 3.5l5 1.8v4.2c0 3.1-2 5.6-5 7-3-1.4-5-3.9-5-7V5.3z"/><path d="M7.8 10.2L9.4 12l3-3.4"/>',
		);

		if ( empty( $paths[ $name ] ) ) {
			return;
		}

		printf(
			'<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">%s</svg>',
			$paths[ $name ] // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- static markup from the map above.
		);
	}

	/**
	 * Store the dismissal against the current user.
	 *
	 * @return void
	 */
	public function dismiss() {
		$nonce = isset( $_REQUEST['_wpnonce'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['_wpnonce'] ) ) : '';
		if ( ! wp_verify_nonce( $nonce, self::NONCE_ACTION ) ) {
			wp_send_json_error();
		}

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error();
		}

		$dismissed = $this->dismissed();
		if ( ! in_array( self::ANNOUNCEMENT_ID, $dismissed, true ) ) {
			$dismissed[] = self::ANNOUNCEMENT_ID;
			update_user_meta( get_current_user_id(), self::DISMISSED_META, $dismissed );
		}

		wp_send_json_success();
	}

	/**
	 * Announcement ids this user has already closed.
	 *
	 * @return string[]
	 */
	protected function dismissed() {
		$dismissed = get_user_meta( get_current_user_id(), self::DISMISSED_META, true );
		return is_array( $dismissed ) ? $dismissed : array();
	}

	/**
	 * Full plugin version. There is no version constant in the free plugin, so
	 * fall back to the plugin header the same way the OAuth endpoints do.
	 *
	 * @return string
	 */
	protected function version() {
		if ( null !== $this->version ) {
			return $this->version;
		}

		if ( defined( 'PRESTO_PLAYER_VERSION' ) ) {
			$this->version = (string) constant( 'PRESTO_PLAYER_VERSION' );
			return $this->version;
		}

		if ( ! function_exists( 'get_plugin_data' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$data          = get_plugin_data( PRESTO_PLAYER_PLUGIN_FILE, false, false );
		$this->version = empty( $data['Version'] ) ? '' : (string) $data['Version'];

		return $this->version;
	}

	/**
	 * Version without the patch part, for display — 4.3.2 becomes 4.3.
	 *
	 * @return string
	 */
	protected function shortVersion() {
		$parts = explode( '.', $this->version() );
		return implode( '.', array_slice( $parts, 0, 2 ) );
	}

	/**
	 * Illustration: the Media Hub list with an assistant adding a video to it.
	 *
	 * Sample content is intentionally not translatable. It is a product mock
	 * behind aria-hidden — the same as a screenshot — so translating it would
	 * only add contextless strings to the .pot file.
	 *
	 * @return void
	 */
	protected function art() {
		?>
		<div class="presto-announce__art" aria-hidden="true">
			<ul class="presto-announce__list">
				<li>
					<span>Onboarding &middot; Lesson 1</span>
					<em>YouTube &middot; 4:21</em>
				</li>
				<li>
					<span>Onboarding &middot; Lesson 2</span>
					<em>Bunny &middot; 12:04</em>
				</li>
				<li class="presto-announce__list-new">
					<span>Product Demo 2026</span>
					<em>YouTube &middot; 3:38</em>
				</li>
			</ul>

			<div class="presto-announce__chat">
				<p class="presto-announce__chat-who">Claude</p>
				<p class="presto-announce__chat-ask">Add this video as &ldquo;Product Demo 2026&rdquo; and give me the shortcode.</p>
				<p class="presto-announce__chat-done">Done &mdash; [presto_player id=4182]</p>
				<p class="presto-announce__chips">
					<span>create-video-youtube</span>
					<span>get-video-shortcode</span>
				</p>
			</div>
		</div>
		<?php
	}

	/**
	 * Modal styles. Printed inline because this only renders once per user.
	 *
	 * @return void
	 */
	protected function styles() {
		?>
		<style>
			.presto-announce {
				--presto-ink: #101223;
				--presto-muted: #656D88;
				--presto-line: rgba( 16, 18, 35, .07 );
				--presto-blue: #3058E5;
				--presto-violet: #9A20F8;
				--presto-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;

				position: fixed;
				inset: 0;
				z-index: 160000;
				display: flex;
				align-items: center;
				justify-content: center;
				padding: 24px;
				/* Scroll the overlay, never the card — a scrollbar inside the panel
				looks like a mistake. */
				overflow-y: auto;
				background: rgba( 16, 18, 35, .46 );
				animation: presto-announce-veil .22s ease both;
			}

			.presto-announce__box {
				position: relative;
				overflow: hidden;
				width: 100%;
				max-width: 520px;
				/* Centres while allowing the overlay to scroll instead of clipping. */
				margin: auto;
				border-radius: 16px;
				background: #fff;
				/* Layered rather than one big blur — reads lifted, not stamped on. */
				box-shadow:
					0 1px 2px rgba( 16, 18, 35, .05 ),
					0 12px 24px -10px rgba( 16, 18, 35, .14 ),
					0 44px 72px -32px rgba( 16, 18, 35, .34 );
				animation: presto-announce-rise .34s cubic-bezier( .2, .8, .2, 1 ) both;
			}

			/* Holds focus for aria-modal without drawing a ring — it's a container,
			not something you interact with. */
			.presto-announce__box:focus {
				outline: none;
			}

			/* The only brand wash: a 2px edge, flush to the top. */
			.presto-announce__box::before {
				content: "";
				position: absolute;
				top: 0;
				left: 0;
				right: 0;
				height: 2px;
				background: linear-gradient( 90deg, var( --presto-violet ), #5B37F0 52%, var( --presto-blue ) );
			}

			/* A product shot in markup, matching the landing page: the library list
			with an assistant working against it. Deliberately dark so the graphics
			read as a separate section from the content below. */
			.presto-announce__art {
				position: relative;
				padding: 28px 26px 26px;
				background:
					radial-gradient( 82% 122% at 4% -14%, rgba( 154, 32, 248, .42 ), transparent 62% ),
					radial-gradient( 70% 108% at 99% -6%, rgba( 48, 88, 229, .4 ), transparent 60% ),
					#0D0F1E;
			}

			.presto-announce__list {
				margin: 0;
				padding: 6px;
				border-radius: 10px;
				background: #fff;
				box-shadow: 0 12px 30px -14px rgba( 5, 6, 15, .75 );
				list-style: none;
			}

			.presto-announce__list li {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 12px;
				margin: 0;
				padding: 9px 10px;
				border-radius: 7px;
				font-size: 12.5px;
				color: var( --presto-ink );
			}

			.presto-announce__list em {
				flex: none;
				font-family: var( --presto-mono );
				font-size: 10.5px;
				font-style: normal;
				color: var( --presto-muted );
			}

			/* The row the assistant just created. */
			.presto-announce__list-new {
				background: rgba( 48, 88, 229, .07 );
				font-weight: 600;
				animation: presto-announce-row .45s ease 1.5s both;
			}

			.presto-announce__chat {
				position: relative;
				width: 78%;
				margin: -16px 0 0 auto;
				padding: 13px 14px;
				border-radius: 11px;
				background: #fff;
				box-shadow: 0 16px 36px -14px rgba( 5, 6, 15, .8 );
				animation: presto-announce-chat .45s cubic-bezier( .2, .8, .2, 1 ) .5s both;
			}

			.presto-announce__chat-who {
				display: flex;
				align-items: center;
				gap: 7px;
				margin: 0 0 9px;
				font-size: 11.5px;
				font-weight: 600;
				color: var( --presto-ink );
			}

			.presto-announce__chat-who::before {
				content: "";
				width: 16px;
				height: 16px;
				border-radius: 5px;
				background: linear-gradient( 135deg, var( --presto-violet ), var( --presto-blue ) );
			}

			.presto-announce__chat-ask {
				margin: 0 0 8px;
				padding: 8px 10px;
				border-radius: 7px;
				background: rgba( 16, 18, 35, .04 );
				font-size: 11.5px;
				line-height: 1.5;
				color: var( --presto-ink );
			}

			.presto-announce__chat-done {
				margin: 0 0 9px;
				font-family: var( --presto-mono );
				font-size: 10.5px;
				line-height: 1.5;
				color: var( --presto-muted );
				animation: presto-announce-done .4s ease 1.5s both;
			}

			/* The abilities that ran — named, because that is what the feature is. */
			.presto-announce__chips {
				display: flex;
				flex-wrap: wrap;
				gap: 6px;
				margin: 0;
				animation: presto-announce-done .4s ease 1.7s both;
			}

			.presto-announce__chips span {
				padding: 3px 7px;
				border-radius: 5px;
				background: #ECFDF3;
				font-family: var( --presto-mono );
				font-size: 10px;
				color: #067647;
			}

			.presto-announce__body {
				padding: 24px 26px 22px;
			}

			/* Machine voice: version and feature name share the mono face. */
			.presto-announce__tag {
				display: flex;
				align-items: center;
				gap: 8px;
				margin: 0 0 12px;
				font-family: var( --presto-mono );
				font-size: 10.5px;
				color: var( --presto-muted );
			}

			.presto-announce__tag-new {
				padding: 3px 7px;
				border-radius: 4px;
				background: rgba( 48, 88, 229, .09 );
				color: var( --presto-blue );
				font-weight: 600;
				letter-spacing: .06em;
				text-transform: uppercase;
			}

			.presto-announce__tag-name::before {
				content: "\00b7";
				margin-right: 8px;
				opacity: .45;
			}

			.presto-announce__title {
				margin: 0 0 9px;
				font-size: 25px;
				font-weight: 640;
				line-height: 1.18;
				letter-spacing: -.026em;
				color: var( --presto-ink );
			}

			.presto-announce__text {
				margin: 0 0 18px;
				font-size: 13.5px;
				line-height: 1.64;
				color: var( --presto-muted );
			}

			/* Two features side by side, the way the settings screen lists them. */
			.presto-announce__feats {
				display: flex;
				flex-wrap: wrap;
				gap: 10px 26px;
				margin: 0 0 20px;
				padding: 0;
				list-style: none;
			}

			.presto-announce__feats li {
				display: flex;
				align-items: center;
				gap: 8px;
				margin: 0;
				font-size: 12.5px;
				line-height: 1.4;
				color: var( --presto-ink );
			}

			.presto-announce__feats svg {
				flex: none;
				color: var( --presto-blue );
			}

			/* CTA left, dismiss right. */
			.presto-announce__actions {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 12px;
			}

			.presto-announce__close {
				padding: 11px 2px;
				border: 0;
				background: none;
				color: var( --presto-muted );
				font-size: 13px;
				line-height: 1;
				cursor: pointer;
				transition: color .16s ease;
			}

			.presto-announce__close:hover {
				color: var( --presto-ink );
			}

			.presto-announce__cta {
				display: inline-flex;
				align-items: center;
				gap: 7px;
				padding: 11px 16px;
				border: 0;
				border-radius: 8px;
				background: var( --presto-blue );
				color: #fff;
				font-size: 13px;
				font-weight: 600;
				line-height: 1;
				text-decoration: none;
				box-shadow: 0 6px 16px -8px rgba( 48, 88, 229, .7 );
				transition: background-color .16s ease, box-shadow .16s ease, transform .16s ease;
			}

			.presto-announce__cta:hover,
			.presto-announce__cta:focus {
				background: #2246C9;
				color: #fff;
				box-shadow: 0 0 0 4px rgba( 48, 88, 229, .16 );
			}

			/* The arrow leans forward on hover — the only movement in the card. */
			.presto-announce__cta:hover svg {
				transform: translateX( 2px );
				transition: transform .16s ease;
			}

			/* Corner close, over the artwork. */
			.presto-announce__x {
				position: absolute;
				top: 12px;
				right: 12px;
				z-index: 2;
				display: flex;
				align-items: center;
				justify-content: center;
				width: 28px;
				height: 28px;
				padding: 0;
				border: 0;
				border-radius: 50%;
				background: rgba( 255, 255, 255, .12 );
				color: #fff;
				cursor: pointer;
				transition: background-color .16s ease;
			}

			.presto-announce__x:hover {
				background: rgba( 255, 255, 255, .24 );
				color: #fff;
			}

			.presto-announce__x:focus-visible,
			.presto-announce__cta:focus-visible,
			.presto-announce__close:focus-visible {
				outline: 2px solid var( --presto-blue );
				outline-offset: 3px;
			}

			@keyframes presto-announce-veil {
				from { opacity: 0; }
			}

			@keyframes presto-announce-rise {
				from { opacity: 0; transform: translateY( 14px ) scale( .98 ); }
			}

			@keyframes presto-announce-chat {
				from { opacity: 0; transform: translateY( 10px ) scale( .97 ); }
			}

			@keyframes presto-announce-done {
				from { opacity: 0; }
			}

			@keyframes presto-announce-row {
				from { background-color: transparent; }
			}

			@media ( max-width: 600px ) {
				.presto-announce__art { padding: 20px 18px 18px; }
				.presto-announce__chat { width: 100%; margin-top: 12px; }
				.presto-announce__body { padding: 20px 18px 18px; }
				.presto-announce__title { font-size: 21px; }
			}

			@media ( prefers-reduced-motion: reduce ) {
				.presto-announce,
				.presto-announce__box,
				.presto-announce__chat,
				.presto-announce__chat-done,
				.presto-announce__chips,
				.presto-announce__list-new {
					animation: none;
				}
			}
		</style>
		<?php
	}

	/**
	 * Close behaviour.
	 *
	 * @return void
	 */
	protected function script() {
		$args = array(
			'action'   => 'presto_dismiss_announcement',
			'_wpnonce' => wp_create_nonce( self::NONCE_ACTION ),
		);

		$js = sprintf(
			'( function() {
				var modal = document.querySelector( ".presto-announce" );
				if ( ! modal ) {
					return;
				}

				function dismiss() {
					return window.fetch( %1$s, {
						method: "POST",
						credentials: "same-origin",
						body: new URLSearchParams( %2$s )
					} );
				}

				function close() {
					// The modal renders on the block-editor screen, where Escape is
					// constant — a listener left bound after dismissal would fire an
					// admin-ajax POST on every later press.
					document.removeEventListener( "keydown", onKeydown );
					modal.remove();
					// A failed request only means the modal shows again.
					dismiss();
				}

				function onKeydown( event ) {
					if ( "Escape" === event.key ) {
						close();
					}
				}

				// aria-modal is a promise that focus is in here, so move it — onto
				// the card itself, not the CTA, so nothing renders with a ring
				// around it before the user has touched anything.
				modal.querySelector( ".presto-announce__box" ).focus();

				var cta = modal.querySelector( ".presto-announce__cta" );

				// Wait for the dismiss to land before leaving, otherwise the next
				// page renders the modal again before the request commits.
				cta.addEventListener( "click", function( event ) {
					event.preventDefault();
					var href = this.href;
					document.removeEventListener( "keydown", onKeydown );
					modal.remove();
					dismiss().catch( function() {} ).then( function() {
						window.location.assign( href );
					} );
				} );

				modal.querySelector( ".presto-announce__close" ).addEventListener( "click", close );
				modal.querySelector( ".presto-announce__x" ).addEventListener( "click", close );

				modal.addEventListener( "click", function( event ) {
					if ( event.target === modal ) {
						close();
					}
				} );
				document.addEventListener( "keydown", onKeydown );
			} )();',
			wp_json_encode( admin_url( 'admin-ajax.php' ) ),
			wp_json_encode( $args )
		);

		wp_print_inline_script_tag( $js );
	}
}
