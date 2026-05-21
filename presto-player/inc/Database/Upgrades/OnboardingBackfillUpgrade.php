<?php
/**
 * Onboarding completion backfill for pre-4.2.0 upgrades.
 *
 * @package PrestoPlayer
 * @subpackage Database\Upgrades
 */

namespace PrestoPlayer\Database\Upgrades;

/**
 * One-shot backfill: existing pre-4.2.0 users updating to 4.2.0 should not
 * be shown the new onboarding wizard. If the user has any pp_video_block
 * post in any non-trash status, mark onboarding as completed.
 *
 * Self-terminating via presto_player_onboarding_backfill_v1_done so the
 * existence query runs at most once per install.
 */
class OnboardingBackfillUpgrade {

	/**
	 * Marker option that flips to 'yes' the first time run() executes,
	 * regardless of whether the backfill itself fired.
	 *
	 * @var string
	 */
	private $done_option = 'presto_player_onboarding_backfill_v1_done';

	/**
	 * Execute the backfill exactly once.
	 *
	 * @return void
	 */
	public function run() {
		if ( 'yes' === get_option( $this->done_option, 'no' ) ) {
			return;
		}

		// Set the done flag first so we never re-run, regardless of the branch below.
		update_option( $this->done_option, 'yes' );

		// Already onboarded — nothing to backfill.
		if ( 'yes' === get_option( 'presto_player_onboarding_completed', 'no' ) ) {
			return;
		}

		// Existing-install signal: any pp_video_block post in any non-trash status.
		$existing = (bool) get_posts(
			array(
				'post_type'      => 'pp_video_block',
				'post_status'    => 'any',
				'posts_per_page' => 1,
				'fields'         => 'ids',
				'no_found_rows'  => true,
			)
		);

		if ( $existing ) {
			update_option( 'presto_player_onboarding_completed', 'yes' );
		}
	}
}
