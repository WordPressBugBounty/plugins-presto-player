<?php
/**
 * Database upgrade dispatcher.
 *
 * @package PrestoPlayer
 * @subpackage Database\Upgrades
 */

namespace PrestoPlayer\Database\Upgrades;

use PrestoPlayer\Plugin;

/**
 * Runs all registered per-version upgrade routines.
 */
class Upgrades {

	/**
	 * Execute pending upgrades.
	 *
	 * @return void
	 */
	public function migrate() {
		// Free-side upgrades (always run).
		( new OnboardingBackfillUpgrade() )->run();

		if ( Plugin::isPro() ) {
			( new VisitsUpgrade() )->run();
			( new TransientsUpgrade() )->run();
			( new BunnyWebhookUpgrade() )->run();
		}
	}
}
