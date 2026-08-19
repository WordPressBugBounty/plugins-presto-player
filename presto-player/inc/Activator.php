<?php
/**
 * Plugin activation hook implementation.
 *
 * @package PrestoPlayer
 */

namespace PrestoPlayer;

use PrestoPlayer\Files;
use PrestoPlayer\Database\Migrations;
use PrestoPlayer\Services\FeatureAnnounce;

/**
 * Runs migrations and one-time setup tasks on plugin activation.
 */
class Activator {

	/**
	 * Activation callback.
	 *
	 * @return void
	 */
	public static function activate() {
		// Run migrations.
		Migrations::run();

		// File stuff.
		$activator = new Files();
		$activator->addPrivateFolder();

		/**
		 * Reset rewrite rules to avoid go to permalinks page
		 * through deleting the database options to force WP to do it
		 * because of on activation not work well flush_rewrite_rules()
		 */
		delete_option( 'rewrite_rules' );

		// Set transient for onboarding redirect on first activation.
		set_transient( 'presto_player_activation_redirect', true, 30 );

		// Mark what version this install started on, so FeatureAnnounce can tell a
		// brand new install from a site that updated into this release. Only stamp a
		// site that has never finished onboarding: deactivate → update → reactivate
		// is a normal path, and stamping there would mark an established site as
		// caught up and swallow the announcement it is the whole point of.
		if ( false === get_option( FeatureAnnounce::SEEN_VERSION_OPTION, false )
			&& 'yes' !== get_option( 'presto_player_onboarding_completed', 'no' ) ) {
			update_option( FeatureAnnounce::SEEN_VERSION_OPTION, PRESTO_PLAYER_VERSION );
		}
	}
}
