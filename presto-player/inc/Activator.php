<?php
/**
 * Plugin activation hook implementation.
 *
 * @package PrestoPlayer
 */

namespace PrestoPlayer;

use PrestoPlayer\Files;
use PrestoPlayer\Database\Migrations;

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
	}
}
