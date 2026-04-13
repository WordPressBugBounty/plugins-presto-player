<?php
/**
 * Usage service for plugin statistics.
 *
 * @package PrestoPlayer\Services
 */

namespace PrestoPlayer\Services;

use PrestoPlayer\Contracts\Service;
use PrestoPlayer\Models\ReusableVideo;
use PrestoPlayer\Plugin;

defined( 'ABSPATH' ) || exit;

/**
 * Usage Service.
 *
 * Collects anonymous usage data via BSF Analytics when user opts in.
 * Data collected (when user opts in):
 * - Video counts, daily views KPI.
 * - One-time milestone events (plugin activation, first video published, etc.).
 *
 * No personally identifiable information (PII) is collected.
 * All data is aggregated and anonymous.
 *
 * @package PrestoPlayer\Services
 */
class Usage implements Service {

	// -------------------------------------------------------------------------
	// Constants
	// -------------------------------------------------------------------------

	/**
	 * The transient key for daily view counts.
	 *
	 * Stores an array: { "2026-03-23": 42, "2026-03-24": 15 }.
	 * Auto-expires after DAILY_VIEWS_TTL seconds — no manual cleanup needed.
	 *
	 * @var string
	 */
	const DAILY_VIEWS_OPTION = 'presto_player_daily_views';

	/**
	 * TTL for the daily views transient (7 days in seconds).
	 *
	 * @var int
	 */
	const DAILY_VIEWS_TTL = 7 * 86400;

	/**
	 * Maximum view count accepted per single request.
	 *
	 * @var int
	 */
	const MAX_VIEWS_PER_REQUEST = 100;

	/**
	 * Number of past days to include in KPI reports.
	 *
	 * @var int
	 */
	const KPI_RETENTION_DAYS = 2;

	// -------------------------------------------------------------------------
	// Properties
	// -------------------------------------------------------------------------

	/**
	 * Events tracker instance.
	 *
	 * @var \BSF_Analytics_Events|null
	 */
	private static $events = null;

	/**
	 * Memoized KPI values for the current request.
	 *
	 * @var array<string, int>|null
	 */
	private $kpi_snapshot = null;

	// -------------------------------------------------------------------------
	// Lifecycle — Registration & Setup
	// -------------------------------------------------------------------------

	/**
	 * Register the service.
	 *
	 * AJAX hooks are registered unconditionally so they work for both
	 * logged-in and logged-out users. BSF Analytics loading is admin-only.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'wp_ajax_presto_player_daily_views', array( $this, 'handle_daily_views' ) );
		add_action( 'wp_ajax_nopriv_presto_player_daily_views', array( $this, 'handle_daily_views' ) );

		if ( ! is_admin() ) {
			return;
		}

		$this->load_bsf_analytics_loader();
		add_action( 'init', array( $this, 'set_bsf_analytics_entity' ), 1 );
		add_filter( 'bsf_core_stats', array( $this, 'update_stats' ) );

		// State-based events — deferred to admin_init to ensure WP is fully bootstrapped.
		// BSF_Analytics_Events handles dedup internally, no additional throttling needed.
		add_action( 'admin_init', array( $this, 'detect_state_events' ) );
	}

	/**
	 * Load the BSF Analytics loader if not already loaded.
	 *
	 * @return void
	 */
	private static function load_bsf_analytics_loader() {
		if ( ! class_exists( 'BSF_Analytics_Loader' ) ) {
			require_once PRESTO_PLAYER_PLUGIN_DIR . 'inc/lib/bsf-analytics/class-bsf-analytics-loader.php';
		}
	}

	/**
	 * Get shared event tracker instance.
	 *
	 * @return \BSF_Analytics_Events|null
	 */
	public static function events() {
		if ( ! class_exists( 'BSF_Analytics_Events' ) ) {
			return null;
		}

		if ( null === self::$events ) {
			self::$events = new \BSF_Analytics_Events( 'presto-player' );
		}
		return self::$events;
	}

	/**
	 * Set BSF Analytics Entity.
	 */
	public function set_bsf_analytics_entity() {
		if ( ! class_exists( 'BSF_Analytics_Loader' ) ) {
			return;
		}

		$pp_bsf_analytics = \BSF_Analytics_Loader::get_instance();

		$pp_bsf_analytics->set_entity(
			array(
				'presto-player' => array(
					'product_name'        => 'Presto Player',
					'path'                => PRESTO_PLAYER_PLUGIN_DIR . 'inc/lib/bsf-analytics',
					'author'              => 'Presto Made, Inc',
					'time_to_display'     => '+24 hours',
					'deactivation_survey' => apply_filters(
						'presto_player_deactivation_survey_data',
						array(
							array(
								'id'                => 'deactivation-survey-presto-player',
								'popup_logo'        => PRESTO_PLAYER_PLUGIN_URL . 'img/presto-player-icon-color.png',
								'plugin_slug'       => 'presto-player',
								'popup_title'       => __( 'Quick Feedback', 'presto-player' ),
								'support_url'       => 'https://prestoplayer.com/support/',
								'popup_description' => __( 'If you have a moment, please share why you are deactivating Presto Player:', 'presto-player' ),
								'show_on_screens'   => array( 'plugins' ),
								'plugin_version'    => Plugin::version(),
							),
						)
					),
					'hide_optin_checkbox' => true,
				),
			)
		);
	}

	// -------------------------------------------------------------------------
	// Event Detection
	// -------------------------------------------------------------------------

	/**
	 * Detect state-based events on admin load.
	 *
	 * BSF_Analytics_Events dedup prevents duplicate tracking.
	 *
	 * @return void
	 */
	public function detect_state_events() {
		if ( ! apply_filters( 'presto_player_usage_events_enabled', true ) ) {
			return;
		}

		$events = self::events();
		if ( ! $events ) {
			return;
		}

		// Pro license events use short-lived transient flags set by the pro
		// plugin — check on every admin load so they aren't missed.
		$this->detect_pro_license_event( $events );

		// Remaining state checks are throttled to once per hour.
		if ( get_transient( 'presto_player_state_events_checked' ) ) {
			return;
		}

		set_transient( 'presto_player_state_events_checked', 1, HOUR_IN_SECONDS );

		$this->detect_activation_event( $events );
		$this->detect_update_event( $events );
		$this->detect_video_events( $events );
		$this->detect_first_view_event( $events );
	}

	/**
	 * Track plugin activation with referral source.
	 *
	 * @param \BSF_Analytics_Events $events Events tracker instance.
	 * @return void
	 */
	private function detect_activation_event( $events ) {
		$bsf_referrers = get_option( 'bsf_product_referers', array() );
		$source        = ! empty( $bsf_referrers['presto-player'] )
			? sanitize_text_field( $bsf_referrers['presto-player'] )
			: 'self';
		$events->track( 'plugin_activated', Plugin::version(), array( 'source' => $source ) );
	}

	/**
	 * Track plugin version change.
	 *
	 * @param \BSF_Analytics_Events $events Events tracker instance.
	 * @return void
	 */
	private function detect_update_event( $events ) {
		$version        = Plugin::version();
		$stored_version = get_option( 'presto_player_tracked_version', '' );

		if ( $version !== $stored_version ) {
			if ( ! empty( $stored_version ) ) {
				$events->flush_pushed( array( 'plugin_updated' ) );
				$events->track(
					'plugin_updated',
					$version,
					array( 'from_version' => $stored_version )
				);
			}
			update_option( 'presto_player_tracked_version', $version, false );
		}
	}

	/**
	 * Track pro license activation/deactivation.
	 *
	 * Checks transient flags set by the pro plugin at the actual moment
	 * of license activation or deactivation.
	 *
	 * @param \BSF_Analytics_Events $events Events tracker instance.
	 * @return void
	 */
	private function detect_pro_license_event( $events ) {
		if ( delete_transient( 'presto_player_pro_license_just_activated' ) ) {
			$events->flush_pushed( array( 'pro_license_activated' ) );
			// Read version directly from the pro class — Plugin::proVersion() relies on
			// PRESTO_PLAYER_PRO_ENABLED which may not be defined yet on the first request
			// after license activation.
			$pro_version = class_exists( '\PrestoPlayer\Pro\Plugin' )
				? \PrestoPlayer\Pro\Plugin::version()
				: Plugin::proVersion();
			$events->track(
				'pro_license_activated',
				$pro_version ? $pro_version : 'unknown'
			);
		}

		if ( delete_transient( 'presto_player_pro_license_just_deactivated' ) ) {
			$events->flush_pushed( array( 'pro_license_deactivated' ) );
			$pro_version = class_exists( '\PrestoPlayer\Pro\Plugin' )
				? \PrestoPlayer\Pro\Plugin::version()
				: Plugin::proVersion();
			$events->track(
				'pro_license_deactivated',
				$pro_version ? $pro_version : 'unknown'
			);
		}
	}

	/**
	 * Detect video milestone events from the presto_player_videos table.
	 *
	 * @param \BSF_Analytics_Events $events Events tracker instance.
	 * @return void
	 */
	private function detect_video_events( $events ) {
		// Skip the DB query entirely if this event was already sent.
		$pushed = get_option( 'presto-player_usage_events_pushed', array() );
		if ( is_array( $pushed ) && in_array( 'first_video_published', $pushed, true ) ) {
			return;
		}

		global $wpdb;
		$table = $wpdb->prefix . 'presto_player_videos';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$first_video = $wpdb->get_row(
			"SELECT type FROM {$table} WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		);

		if ( ! $first_video ) {
			return;
		}

		$events->track(
			'first_video_published',
			sanitize_text_field( $first_video->type ),
			array( 'days_since_install' => (string) $this->get_days_since_install() )
		);
	}

	/**
	 * Track first video view milestone.
	 *
	 * @param \BSF_Analytics_Events $events Events tracker instance.
	 * @return void
	 */
	private function detect_first_view_event( $events ) {
		$views = get_transient( self::DAILY_VIEWS_OPTION );
		if ( is_array( $views ) && ! empty( $views ) ) {
			$events->track(
				'first_video_viewed',
				'view',
				array( 'days_since_install' => (string) $this->get_days_since_install() )
			);
		}
	}

	/**
	 * Track plugin deactivation event.
	 *
	 * Called from register_deactivation_hook. The event is stored in the
	 * pending queue and delivered on the next BSF Analytics sync (i.e., when
	 * the plugin is reactivated). We intentionally do not send immediately
	 * to avoid coupling to BSF Analytics internals.
	 *
	 * @return void
	 */
	public static function track_plugin_deactivated() {
		self::load_bsf_analytics_loader();

		$events = self::events();
		if ( ! $events ) {
			return;
		}

		global $wpdb;
		$table = $wpdb->prefix . 'presto_player_videos';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$video_count = (int) $wpdb->get_var(
			"SELECT COUNT(*) FROM {$table} WHERE deleted_at IS NULL" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		);

		// Remove from dedup so it can fire on every deactivation.
		$events->flush_pushed( array( 'plugin_deactivated' ) );

		$events->track(
			'plugin_deactivated',
			Plugin::version(),
			array(
				'days_since_install' => (string) self::get_days_since_install(),
				'video_count'        => (string) $video_count,
				'was_pro'            => defined( 'PRESTO_PLAYER_PRO_ENABLED' ) ? '1' : '0',
			)
		);
	}

	// -------------------------------------------------------------------------
	// Stats Payload
	// -------------------------------------------------------------------------

	/**
	 * Update BSF Analytics stats with Presto Player usage stats.
	 *
	 * @param array<mixed> $stats existing stats_data.
	 * @return array<mixed> $stats modified stats_data.
	 */
	public function update_stats( $stats ) {
		$stats['plugin_data']['presto_player'] = array(
			'free_version'  => Plugin::version(),
			'pro_version'   => Plugin::isPro() ? Plugin::proVersion() : '',
			'site_language' => get_locale(),
		);

		// Add events record (flushed from pending queue).
		$events = self::events();
		if ( $events ) {
			$events_record = $events->flush_pending();
			if ( ! empty( $events_record ) ) {
				$stats['plugin_data']['presto_player']['events_record'] = $events_record;
			}
		}

		// Add KPI data (daily views + snapshot per day).
		$kpi_data = $this->get_kpi_data();
		if ( ! empty( $kpi_data ) ) {
			$stats['plugin_data']['presto_player']['kpi_records'] = $kpi_data;
		}

		return apply_filters( 'presto_player_usage_stats', $stats );
	}

	// -------------------------------------------------------------------------
	// KPI Collection
	// -------------------------------------------------------------------------

	/**
	 * Get KPI data for the last 2 days (excluding today).
	 *
	 * Combines daily_views (per-day) with a snapshot of all other KPIs.
	 *
	 * @return array<string, array<string, array<string, int>>> KPI data keyed by date.
	 */
	public function get_kpi_data() {
		$kpi_data = array();
		$tz       = wp_timezone();
		$now      = new \DateTime( 'now', $tz );
		$views    = get_transient( self::DAILY_VIEWS_OPTION );
		$views    = is_array( $views ) ? $views : array();
		$snapshot = $this->get_kpi_snapshot();

		for ( $i = 1; $i <= self::KPI_RETENTION_DAYS; $i++ ) {
			$date_obj = clone $now;
			$date_obj->modify( '-' . $i . ' days' );
			$date        = $date_obj->format( 'Y-m-d' );
			$daily_views = isset( $views[ $date ] ) ? absint( $views[ $date ] ) : 0;

			$kpi_data[ $date ] = array(
				'numeric_values' => array_merge( array( 'daily_views' => $daily_views ), $snapshot ),
			);
		}

		return $kpi_data;
	}

	/**
	 * Get the full KPI snapshot (memoized per request).
	 *
	 * @return array<string, int>
	 */
	private function get_kpi_snapshot(): array {
		if ( null !== $this->kpi_snapshot ) {
			return $this->kpi_snapshot;
		}

		$this->kpi_snapshot = array_merge(
			$this->get_core_kpis(),
			$this->get_content_kpis(),
			$this->get_feature_kpis(),
			$this->get_integration_kpis()
		);

		return $this->kpi_snapshot;
	}

	/**
	 * Core KPIs.
	 *
	 * @return array<string, int>
	 */
	private function get_core_kpis(): array {
		return array(
			'is_pro' => defined( 'PRESTO_PLAYER_PRO_ENABLED' ) ? 1 : 0,
		);
	}

	/**
	 * Content KPIs — video inventory and creation velocity.
	 *
	 * @return array<string, int>
	 */
	private function get_content_kpis(): array {
		global $wpdb;
		$table = $wpdb->prefix . 'presto_player_videos';

		// Video counts by type.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$type_counts = $wpdb->get_results(
			"SELECT type, COUNT(*) as cnt FROM {$table} WHERE deleted_at IS NULL GROUP BY type" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		);

		$counts = array();
		$total  = 0;
		if ( $type_counts ) {
			foreach ( $type_counts as $row ) {
				$key            = 'content_videos_' . sanitize_key( $row->type );
				$counts[ $key ] = (int) $row->cnt;
				$total         += (int) $row->cnt;
			}
		}
		$counts['content_total_videos'] = $total;

		// New videos in last 7 days.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$counts['content_new_videos_7d'] = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$table} WHERE deleted_at IS NULL AND created_at >= %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				gmdate( 'Y-m-d H:i:s', strtotime( '-7 days' ) )
			)
		);

		// Media Hub items (published).
		$media                            = new ReusableVideo();
		$counts['content_media_hub_count'] = (int) $media->getTotalPublished();

		return $counts;
	}

	/**
	 * Feature adoption KPIs — preset features and settings.
	 *
	 * @return array<string, int>
	 */
	private function get_feature_kpis(): array {
		global $wpdb;
		$presets_table = $wpdb->prefix . 'presto_player_presets';
		$audio_table   = $wpdb->prefix . 'presto_player_audio_presets';

		// Custom presets.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$custom_presets = (int) $wpdb->get_var(
			"SELECT COUNT(*) FROM {$presets_table} WHERE is_locked = 0" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		);
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$custom_audio = (int) $wpdb->get_var(
			"SELECT COUNT(*) FROM {$audio_table} WHERE is_locked = 0" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		);

		// Preset feature usage (0/1 — is any preset using this feature?).
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$preset_features = $wpdb->get_row(
			"SELECT
				MAX(CASE WHEN cta != '' THEN 1 ELSE 0 END) as has_cta,
				MAX(CASE WHEN watermark != '' THEN 1 ELSE 0 END) as has_watermark,
				MAX(CASE WHEN email_collection != '' THEN 1 ELSE 0 END) as has_email_collection,
				MAX(CASE WHEN action_bar != '' THEN 1 ELSE 0 END) as has_action_bar,
				MAX(CASE WHEN captions = 1 THEN 1 ELSE 0 END) as has_captions,
				MAX(CASE WHEN sticky_scroll = 1 THEN 1 ELSE 0 END) as has_sticky_scroll,
				MAX(CASE WHEN save_player_position = 1 THEN 1 ELSE 0 END) as has_save_position
			FROM {$presets_table}" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		);

		// Settings-based features.
		$analytics_settings = get_option( 'presto_player_analytics', array() );
		$branding_settings  = get_option( 'presto_player_branding', array() );
		$youtube_settings   = get_option( 'presto_player_youtube', array() );
		$ga_settings        = get_option( 'presto_player_google_analytics', array() );
		$perf_settings      = get_option( 'presto_player_performance', array() );

		return array(
			'feature_custom_presets'       => $custom_presets,
			'feature_custom_audio_presets' => $custom_audio,
			'feature_cta'                  => $preset_features ? (int) $preset_features->has_cta : 0,
			'feature_watermark'            => $preset_features ? (int) $preset_features->has_watermark : 0,
			'feature_email_collection'     => $preset_features ? (int) $preset_features->has_email_collection : 0,
			'feature_action_bar'           => $preset_features ? (int) $preset_features->has_action_bar : 0,
			'feature_captions'             => $preset_features ? (int) $preset_features->has_captions : 0,
			'feature_sticky_scroll'        => $preset_features ? (int) $preset_features->has_sticky_scroll : 0,
			'feature_save_position'        => $preset_features ? (int) $preset_features->has_save_position : 0,
			'feature_branding'             => ( ! empty( $branding_settings['logo'] ) || ! empty( $branding_settings['player_css'] ) ) ? 1 : 0,
			'feature_ga_enabled'           => ( ! empty( $ga_settings['enable'] ) ) ? 1 : 0,
			'feature_analytics_enabled'    => ( ! empty( $analytics_settings['enable'] ) ) ? 1 : 0,
			'feature_youtube_nocookie'     => ( ! empty( $youtube_settings['nocookie'] ) ) ? 1 : 0,
			'feature_performance_module'   => ( ! empty( $perf_settings['module_enabled'] ) ) ? 1 : 0,
		);
	}

	/**
	 * Integration KPIs — LMS and page builder detection.
	 *
	 * @return array<string, int>
	 */
	private function get_integration_kpis(): array {
		$integrations = array(
			'integration_learndash'       => class_exists( 'SFWD_LMS' ),
			'integration_tutor'           => function_exists( 'tutor' ),
			'integration_lifter'          => function_exists( 'is_lifterlms' ),
			'integration_elementor'       => did_action( 'elementor/loaded' ) > 0,
			'integration_divi'            => defined( 'ET_BUILDER_VERSION' ),
			'integration_beaver_builder'  => class_exists( 'FLBuilder' ),
		);

		$kpis  = array();
		$count = 0;
		foreach ( $integrations as $key => $active ) {
			$kpis[ $key ] = $active ? 1 : 0;
			if ( $active ) {
				++$count;
			}
		}
		$kpis['integration_count'] = $count;

		return $kpis;
	}

	// -------------------------------------------------------------------------
	// View Tracking (AJAX)
	// -------------------------------------------------------------------------

	/**
	 * Handle the AJAX request to record daily video views.
	 *
	 * Called via wp_ajax_presto_player_daily_views and
	 * wp_ajax_nopriv_presto_player_daily_views.
	 *
	 * Nonce intentionally omitted: this is a nopriv endpoint where the nonce is
	 * shared across all anonymous users (no CSRF protection value) and becomes stale
	 * on cached pages — silently breaking the counter. Security is provided by:
	 * - Filter escape hatch (presto_player_daily_views_enabled).
	 * - Count cap (MAX_VIEWS_PER_REQUEST).
	 *
	 * @return void
	 */
	public function handle_daily_views() {
		if ( ! apply_filters( 'presto_player_daily_views_enabled', true ) ) {
			wp_send_json_error( 'disabled', 403 );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- see docblock: nonce omitted by design for nopriv+cached-page compatibility.
		$count = isset( $_POST['count'] ) ? absint( wp_unslash( $_POST['count'] ) ) : 1;

		$this->record_daily_views( $count );

		wp_send_json_success();
	}

	/**
	 * Increment the daily views counter.
	 *
	 * Separated from handle_daily_views() to allow unit testing
	 * without triggering wp_send_json_success() / die().
	 *
	 * @param int $count Number of views to add.
	 * @return bool Whether the increment was successful.
	 */
	public function record_daily_views( $count ) {
		if ( ! apply_filters( 'presto_player_daily_views_enabled', true ) ) {
			return false;
		}

		$count = min( absint( $count ), self::MAX_VIEWS_PER_REQUEST );

		if ( $count < 1 ) {
			return false;
		}

		$tz    = wp_timezone();
		$now   = new \DateTime( 'now', $tz );
		$today = $now->format( 'Y-m-d' );
		$views = get_transient( self::DAILY_VIEWS_OPTION );
		$views = is_array( $views ) ? $views : array();

		$views[ $today ] = ( $views[ $today ] ?? 0 ) + $count;

		// Prune entries older than TTL to prevent unbounded growth.
		$cutoff = ( clone $now )->modify( '-' . (int) ( self::DAILY_VIEWS_TTL / 86400 ) . ' days' )->format( 'Y-m-d' );
		$views  = array_filter(
			$views,
			function ( $date ) use ( $cutoff ) {
				return $date >= $cutoff;
			},
			ARRAY_FILTER_USE_KEY
		);

		return set_transient( self::DAILY_VIEWS_OPTION, $views, self::DAILY_VIEWS_TTL );
	}

	// -------------------------------------------------------------------------
	// Utilities
	// -------------------------------------------------------------------------

	/**
	 * Get number of days since plugin install.
	 *
	 * Uses the install time tracked by BSF Analytics library.
	 *
	 * @return int Days since install, 0 if unknown.
	 */
	private static function get_days_since_install() {
		$install_time = get_site_option( 'presto-player_usage_installed_time', 0 );
		if ( $install_time > 0 ) {
			return (int) floor( ( time() - $install_time ) / DAY_IN_SECONDS );
		}
		return 0;
	}
}
