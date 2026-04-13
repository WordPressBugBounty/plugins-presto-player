<?php
/**
 * Plugin deactivation and uninstall handler.
 *
 * @package PrestoPlayer
 */

namespace PrestoPlayer;

use PrestoPlayer\Database\Table;
use PrestoPlayer\Database\Visits;
use PrestoPlayer\Database\Presets;
use PrestoPlayer\Database\Videos;
use PrestoPlayer\Database\AudioPresets;
use PrestoPlayer\Database\Webhooks;
use PrestoPlayer\Models\ReusableVideo;
use PrestoPlayer\Services\Usage;

/**
 * Class Deactivator
 *
 * Handles plugin data cleanup on uninstall.
 */
class Deactivator {

	/**
	 * Handle plugin uninstall based on user settings.
	 *
	 * @return void
	 */
	public static function uninstall() {
		// Get plugin settings.
		$uninstall_settings = get_option( 'presto_player_uninstall' );

		// Uninstall all data on delete if selected.
		if ( isset( $uninstall_settings['uninstall_data'] ) && $uninstall_settings['uninstall_data'] ) {
			self::delete_data_on_uninstall();
		}
	}

	/**
	 * Delete all plugin data from the database.
	 *
	 * @return void
	 */
	public static function delete_data_on_uninstall() {
		// License.
		delete_option( 'presto_player_license' );
		delete_option( 'presto_player_license_data' );

		// Settings.
		delete_option( 'presto_player_analytics' );
		delete_option( 'presto_player_google_analytics' );
		delete_option( 'presto_player_branding' );
		delete_option( 'presto_player_bunny_keys' );
		delete_option( 'presto_player_bunny_storage_zones' );
		delete_option( 'presto_player_bunny_pull_zones' );
		delete_option( 'presto_player_bunny_uid' );
		delete_option( 'presto_player_instant_video_width' );
		delete_option( 'presto_player_media_hub_sync_default' );

		// Notices.
		delete_option( 'presto_player_dismissed_notice_nginx_rules' );
		delete_option( 'presto_player_presto_player_bunny_uid' );
		delete_option( 'presto_player_dismissed_notice_presto_player_reusable_notice' );

		// Uninstall option.
		delete_option( 'presto_player_uninstall' );

		// Tables.
		delete_option( 'presto_preset_seed_version' );
		delete_option( 'presto_player_visits_database_version' );
		delete_option( 'presto_player_videos_database_version' );
		delete_option( 'presto_player_presets_database_version' );
		delete_option( 'presto_zone_token' );
		delete_option( 'presto_player_visits_upgrade_version' );
		delete_option( 'presto_player_pro_update_performance' );
		delete_option( 'presto_player_audio_presets_database_version' );
		delete_option( 'presto_player_email_collection_database_version' );
		delete_option( 'presto_audio_preset_seed_version' );

		// Delete our tables.
		$table = new Table();
		( new Visits( $table ) )->uninstall();
		( new Presets( $table ) )->uninstall();
		( new AudioPresets( $table ) )->uninstall();
		( new Videos( $table ) )->uninstall();
		( new Webhooks( $table ) )->uninstall();

		// Daily views KPI tracking.
		delete_transient( Usage::DAILY_VIEWS_OPTION );
		delete_transient( 'presto_player_state_events_checked' );

		// BSF Analytics event tracking.
		delete_option( 'presto_player_tracked_version' );
		// BSF Analytics library prefixes options with the product slug (hyphenated).
		delete_option( 'presto-player_usage_events_pending' );
		delete_option( 'presto-player_usage_events_pushed' );

		// Delete all reusable videos.
		$videos     = new ReusableVideo();
		$all_videos = $videos->all( array( 'fields' => 'ids' ) );
		foreach ( $all_videos as $video_id ) {
			wp_delete_post( $video_id, true );
		}
	}
}
