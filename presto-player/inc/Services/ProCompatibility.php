<?php
/**
 * Pro plugin version compatibility notice.
 *
 * @package PrestoPlayer
 * @subpackage Services
 */

namespace PrestoPlayer\Services;

use PrestoPlayer\Plugin;
use PrestoPlayer\Pro\Plugin as ProPlugin;

/**
 * Surfaces an admin notice prompting users to update Presto Player Pro when out of date.
 */
class ProCompatibility {

	/**
	 * The minimum Pro version recommended for compatibility with this core release.
	 *
	 * @var string
	 */
	protected $recommended_pro_version = '3.2.0';

	/**
	 * The minimum Pro version required to function at all.
	 *
	 * @var string
	 */
	protected $required_pro_version = '0.0.1';

	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'admin_notices', array( $this, 'showRecommendedVersionNotice' ) );
	}

	/**
	 * Check whether the active Pro plugin meets the requested version floor.
	 *
	 * @param string $type Either 'required' or 'recommended'.
	 * @return bool
	 */
	public function hasVersion( $type = 'recommended' ) {
		if ( ! Plugin::isPro() ) {
			return true;
		}
		$version = 'required' === $type ? $this->required_pro_version : $this->recommended_pro_version;
		return ! version_compare( $version, ProPlugin::version(), '>' );
	}

	/**
	 * Render the "update Pro" admin notice.
	 *
	 * @return void
	 */
	public function showRecommendedVersionNotice() {
		// Has recommended version.
		if ( $this->hasVersion( 'recommended' ) ) {
			return;
		}

		$notice_name = 'player_recommended_version_' . $this->recommended_pro_version;

		ob_start()
		?>
		<div class="notice notice-info">
			<p><strong>Presto Player</strong></p>
			<p><?php esc_html_e( 'Please update your Presto Player Pro plugin for compatibility with the Presto Player core plugin. This ensures you have access to new features and updates.', 'presto-player' ); ?></p>
			<p>
				<?php
				printf(
					/* translators: %s: recommended Pro plugin version number */
					esc_html__( 'The recommended minimum pro version is %s.', 'presto-player' ),
					'<b>' . esc_html( $this->recommended_pro_version ) . '</b>'
				);
				?>
			</p>
			<p><a href="
			<?php
			echo esc_url(
				add_query_arg(
					array(
						'presto_action' => 'dismiss_notices',
						'presto_notice' => $notice_name,
						'_wpnonce'      => wp_create_nonce( \PrestoPlayer\Services\AdminNotices::DISMISS_NONCE_ACTION ),
					)
				)
			);
			?>
						"><?php esc_html_e( 'Dismiss Notice', 'presto-player' ); ?></a></p>
		</div>

		<?php
		echo ob_get_clean(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Output is pre-escaped HTML from the buffer above.
	}
}
