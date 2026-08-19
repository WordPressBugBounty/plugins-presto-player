<?php
/**
 * OAuth 2.1 + DCR service bootstrap.
 *
 * Installs the OAuth storage schema once AI access is enabled. The individual
 * OAuth services (Endpoints, Authentication, Discovery, etc.) are registered as
 * their own components in `inc/config/app.php` and self-register their REST
 * routes on `rest_api_init`.
 *
 * @package PrestoPlayer
 * @subpackage Services\OAuth
 */

namespace PrestoPlayer\Services\OAuth;

use PrestoPlayer\Contracts\Service;
use PrestoPlayer\Services\Abilities\Module as AbilitiesModule;
use PrestoPlayer\Services\OAuth\Storage\Schema;

/**
 * Service entry point for the OAuth integration.
 */
class Module implements Service {

	/**
	 * Cron hook that triggers the daily storage cleanup.
	 *
	 * @var string
	 */
	public const GC_HOOK = 'presto_player_oauth_gc';

	/**
	 * Hook into WordPress.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'init', array( $this, 'ensureSchema' ), 5 );
		// Create the tables the moment AI access is switched on, so the OAuth
		// endpoints have storage immediately without waiting for the next load.
		add_action( 'add_option_' . AbilitiesModule::OPTION_KEY, array( $this, 'onOptionAdded' ), 10, 2 );
		add_action( 'update_option_' . AbilitiesModule::OPTION_KEY, array( $this, 'onOptionUpdated' ), 10, 2 );

		// Daily garbage collection so expired/revoked tokens and codes don't pile up.
		// Only the handler is wired every request; the schedule is created/torn down
		// on the enable/disable transition (see onOptionAdded / onOptionUpdated).
		add_action( self::GC_HOOK, array( Schema::class, 'prune' ) );
	}

	/**
	 * Schedule the daily garbage collection if it isn't already.
	 *
	 * @return void
	 */
	protected function scheduleGc() {
		if ( ! wp_next_scheduled( self::GC_HOOK ) ) {
			wp_schedule_event( time(), 'daily', self::GC_HOOK );
		}
	}

	/**
	 * Install the schema on `init`, but only when AI access is enabled — sites
	 * that never use MCP shouldn't get the OAuth tables as a side effect.
	 *
	 * @return void
	 */
	public function ensureSchema() {
		if ( ! $this->isEnabled() ) {
			return;
		}
		Schema::installIfNeeded();
		$this->scheduleGc();
	}

	/**
	 * Install the schema when the option is first created in the enabled state.
	 *
	 * @param string $option Option name.
	 * @param mixed  $value  New option value.
	 * @return void
	 */
	public function onOptionAdded( $option, $value ) {
		if ( ! empty( $value['enabled'] ) ) {
			Schema::installIfNeeded();
			$this->scheduleGc();
		} else {
			wp_clear_scheduled_hook( self::GC_HOOK );
			// Switching AI access off is the only revocation control the site owner
			// has, so it has to mean it — otherwise every previously issued grant
			// comes straight back the moment the toggle is switched on again.
			Schema::revokeAllGrants();
		}
	}

	/**
	 * Install the schema when the option transitions into the enabled state.
	 *
	 * @param mixed $old_value Previous option value.
	 * @param mixed $value     New option value.
	 * @return void
	 */
	public function onOptionUpdated( $old_value, $value ) {
		if ( ! empty( $value['enabled'] ) ) {
			Schema::installIfNeeded();
			$this->scheduleGc();
		} else {
			wp_clear_scheduled_hook( self::GC_HOOK );
			// Switching AI access off is the only revocation control the site owner
			// has, so it has to mean it — otherwise every previously issued grant
			// comes straight back the moment the toggle is switched on again.
			Schema::revokeAllGrants();
		}
	}

	/**
	 * Whether AI access is enabled.
	 *
	 * @return bool
	 */
	protected function isEnabled() {
		$option = get_option( AbilitiesModule::OPTION_KEY, array() );
		return ! empty( $option['enabled'] );
	}
}
