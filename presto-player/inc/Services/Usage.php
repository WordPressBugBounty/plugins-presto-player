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
 * - Video counts.
 *
 * No personally identifiable information (PII) is collected.
 * All data is aggregated and anonymous.
 *
 * @package PrestoPlayer\Services
 */
class Usage implements Service {

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
	}

	/**
	 * Load the BSF Analytics loader if not already loaded.
	 *
	 * @return void
	 */
	private function load_bsf_analytics_loader() {
		if ( ! class_exists( 'BSF_Analytics_Loader' ) ) {
			require_once PRESTO_PLAYER_PLUGIN_DIR . 'inc/lib/bsf-analytics/class-bsf-analytics-loader.php';
		}
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

	/**
	 * Update BSF Analytics stats with Presto Player usage stats.
	 *
	 * @param array<mixed> $stats existing stats_data.
	 * @return array<mixed> $stats modified stats_data.
	 */
	public function update_stats( $stats ) {
		$media = new ReusableVideo();

		$stats['plugin_data']['presto_player'] = array(
			'free_version'  => Plugin::version(),
			'pro_version'   => Plugin::isPro() ? Plugin::proVersion() : '',
			'site_language' => get_locale(),
			'total_videos'  => $media->getTotalPublished(),
		);

		// Add KPI data.
		$kpi_data = $this->get_kpi_data();
		if ( ! empty( $kpi_data ) ) {
			$stats['plugin_data']['presto_player']['kpi_records'] = $kpi_data;
		}

		return apply_filters( 'presto_player_usage_stats', $stats );
	}

	/**
	 * Get KPI data for the last 2 days (excluding today).
	 *
	 * Reads the daily views transient and returns data in BSF Analytics KPI format.
	 *
	 * @return array<string, array<string, array<string, int>>> KPI data keyed by date.
	 */
	public function get_kpi_data() {
		$kpi_data = array();
		$tz       = wp_timezone();
		$now      = new \DateTime( 'now', $tz );
		$views    = get_transient( self::DAILY_VIEWS_OPTION );
		$views    = is_array( $views ) ? $views : array();

		for ( $i = 1; $i <= self::KPI_RETENTION_DAYS; $i++ ) {
			$date_obj = clone $now;
			$date_obj->modify( '-' . $i . ' days' );
			$date        = $date_obj->format( 'Y-m-d' );
			$daily_views = isset( $views[ $date ] ) ? absint( $views[ $date ] ) : 0;

			$kpi_data[ $date ] = array(
				'numeric_values' => array(
					'daily_views' => $daily_views,
				),
			);
		}

		return $kpi_data;
	}

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
}
