<?php
/**
 * Admin menu registration for the Presto Player dashboard.
 *
 * @package PrestoPlayer
 * @subpackage Services
 */

namespace PrestoPlayer\Services;

use PrestoPlayer\Plugin;
use PrestoPlayer\Services\License\License;

/**
 * Registers the top-level "Presto Player" admin menu and submenu structure.
 */
class Menu {

	/**
	 * Whether enqueueing has run for the dashboard page.
	 *
	 * @var bool
	 */
	protected $enqueue;

	/**
	 * Register WordPress hooks for the menu service.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'admin_menu', array( $this, 'addMenu' ) );
	}

	/**
	 * Register the top-level menu and its submenu pages.
	 *
	 * @return void
	 */
	public function addMenu() {
		// Custom-slug menu following the SureDash submenu pattern. See #996.
		$dashboard_page = add_menu_page(
			__( 'Presto Player', 'presto-player' ),
			__( 'Presto Player', 'presto-player' ),
			'publish_posts',
			'presto-dashboard',
			function () {
				ob_start();
				?>
			<div id="presto-admin-dashboard">
				<div id="presto-admin-dashboard-content"></div>
			</div>
				<?php wp_auth_check_html(); ?>
				<?php
				$page = ob_get_clean();
				echo $page; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Pre-rendered admin HTML from trusted markup above.
			},
			'data:image/svg+xml;base64,' . base64_encode( file_get_contents( PRESTO_PLAYER_PLUGIN_DIR . 'img/menu-icon.svg' ) ),
			58
		);

		// First submenu — same slug as parent, replaces "Presto Player" label with "Dashboard".
		add_submenu_page(
			'presto-dashboard',
			__( 'Dashboard', 'presto-player' ),
			__( 'Dashboard', 'presto-player' ),
			'publish_posts',
			'presto-dashboard'
		);

		// Remaining tabs — each uses admin.php?page=presto-dashboard&tab=X as slug.
		// WordPress renders these as links to the dashboard page with the tab param.
		add_submenu_page(
			'presto-dashboard',
			__( 'Media Hub', 'presto-player' ),
			__( 'Media Hub', 'presto-player' ),
			'publish_posts',
			'admin.php?page=presto-dashboard&tab=MediaHub'
		);

		add_submenu_page(
			'presto-dashboard',
			__( 'Analytics', 'presto-player' ),
			__( 'Analytics', 'presto-player' ),
			'publish_posts',
			'admin.php?page=presto-dashboard&tab=Analytics'
		);

		add_submenu_page(
			'presto-dashboard',
			__( 'Emails', 'presto-player' ),
			__( 'Emails', 'presto-player' ),
			'manage_options',
			'admin.php?page=presto-dashboard&tab=Emails'
		);

		add_submenu_page(
			'presto-dashboard',
			__( 'Settings', 'presto-player' ),
			__( 'Settings', 'presto-player' ),
			'publish_posts',
			'admin.php?page=presto-dashboard&tab=Settings'
		);

		add_submenu_page(
			'presto-dashboard',
			__( 'Learn', 'presto-player' ),
			__( 'Learn', 'presto-player' ),
			'publish_posts',
			'admin.php?page=presto-dashboard&tab=Learn'
		);

		// Pro-active-but-unlicensed users see the License tab CTA inside the dashboard,
		// so the external "Upgrade to Pro" submenu entry is shown only when Pro isn't installed.
		if ( ! class_exists( '\PrestoPlayer\Pro\Plugin' ) ) {
			global $submenu;
			$submenu['presto-dashboard'][] = array( // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- Appending to the admin submenu global is the standard WordPress pattern.
				__( 'Upgrade to Pro', 'presto-player' ),
				'publish_posts',
				'https://prestoplayer.com/pricing/',
			);
			add_action( 'admin_head', array( $this, 'upgradeToProLinkStyles' ) );
			add_action( 'admin_footer', array( $this, 'upgradeToProLinkScript' ) );
		}

		add_action( 'admin_head', array( $this, 'submenuDividerStyles' ) );
		add_action( "admin_print_scripts-{$dashboard_page}", array( $this, 'dashboardAssets' ) );
	}

	/**
	 * Add visual dividers between submenu groups.
	 *
	 * Groups:
	 *   1. Dashboard (overview)
	 *   2. Media Hub, Analytics, Emails (features)
	 *   3. Settings, Learn (config & help)
	 *   4. Upgrade to Pro (upsell, non-Pro only)
	 *
	 * nth-child mapping (1st child is the hidden parent duplicate):
	 *   2 = Dashboard, 3 = Media Hub, 4 = Analytics,
	 *   5 = Emails, 6 = Settings, 7 = Learn, 8 = Upgrade to Pro
	 */
	public function submenuDividerStyles() {
		$menu = '#toplevel_page_presto-dashboard';
		$slug = 'admin.php?page=presto-dashboard';
		?>
		<style>
			<?php echo esc_attr( $menu ); ?> li {
				clear: both;
			}
			<?php echo esc_attr( $menu ); ?> li:not(:last-child) a[href^="<?php echo esc_attr( $slug ); ?>"]:after {
				border-bottom: 1px solid hsla(0, 0%, 100%, .2);
				display: block;
				float: left;
				margin: 13px -15px 8px;
				content: "";
				width: calc(100% + 26px);
			}
			<?php echo esc_attr( $menu ); ?> li:not(:last-child) a[href^="<?php echo esc_attr( $slug ); ?>&tab=MediaHub"]:after,
			<?php echo esc_attr( $menu ); ?> li:not(:last-child) a[href^="<?php echo esc_attr( $slug ); ?>&tab=Analytics"]:after,
			<?php echo esc_attr( $menu ); ?> li:not(:last-child) a[href^="<?php echo esc_attr( $slug ); ?>&tab=Settings"]:after {
				content: none;
			}
		</style>
		<?php
	}

	/**
	 * Style the "Upgrade to Pro" submenu link with an external-link icon.
	 * Hooked to admin_head only when Pro is not installed.
	 */
	public function upgradeToProLinkStyles() {
		?>
		<style>
			#toplevel_page_presto-dashboard .wp-submenu a[href*="prestoplayer.com/pricing"]::after {
				content: "\f504";
				font-family: dashicons;
				font-size: 13px;
				margin-left: 6px;
				vertical-align: middle;
				opacity: 0.6;
			}
		</style>
		<?php
	}

	/**
	 * Open the "Upgrade to Pro" submenu link in a new tab.
	 * Hooked to admin_footer (DOM must exist before the script runs).
	 * Follows the SureForms pattern: intercept click → window.open.
	 */
	public function upgradeToProLinkScript() {
		?>
		<script>
			document.addEventListener( 'DOMContentLoaded', function() {
				const link = document.querySelector( '#toplevel_page_presto-dashboard .wp-submenu a[href*="prestoplayer.com/pricing"]' );
				if ( link ) {
					link.addEventListener( 'click', function( e ) {
						e.preventDefault();
						window.open( link.href, '_blank' );
					} );
				}
			} );
		</script>
		<?php
	}

	/**
	 * Get plugin status
	 *
	 * @param string $plugin_file Plugin file path.
	 * @return string Plugin status.
	 */
	public function getPluginStatus( $plugin_file ) {
		if ( ! function_exists( 'get_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$installed_plugins = get_plugins();

		if ( ! isset( $installed_plugins[ $plugin_file ] ) ) {
			return 'not-installed';
		}

		return is_plugin_active( $plugin_file ) ? 'active' : 'inactive';
	}

	/**
	 * Scripts needed on dashboard page
	 */
	public function dashboardAssets() {
		wp_enqueue_media();

		$assets = include trailingslashit( PRESTO_PLAYER_PLUGIN_DIR ) . 'dist/dashboard.asset.php';
		wp_enqueue_script(
			'presto/dashboard/admin',
			trailingslashit( PRESTO_PLAYER_PLUGIN_URL ) . 'dist/dashboard.js',
			array_merge( array( 'hls.js', 'presto-components', 'regenerator-runtime', 'updates' ), $assets['dependencies'] ),
			$assets['version'],
			true
		);

		// Dashboard style.
		wp_enqueue_style( 'presto/dashboard/admin', trailingslashit( PRESTO_PLAYER_PLUGIN_URL ) . 'dist/dashboard.css', array(), $assets['version'] );

		// Font styles for WhatsNew flyout.
		wp_enqueue_style( 'presto/dashboard/fonts', trailingslashit( PRESTO_PLAYER_PLUGIN_URL ) . 'assets/css/font.css', array(), Plugin::version() );

		wp_enqueue_style( 'wp-components' );

		if ( function_exists( 'wp_set_script_translations' ) ) {
			wp_set_script_translations( 'presto/dashboard/admin', 'presto-player' );
		}

		$current_user = wp_get_current_user();

		// Check if SureDash is available and get onboarding image.
		$onboarding_image = '';
		if ( defined( 'SUREDASHBOARD_URL' ) ) {
			$onboarding_image = SUREDASHBOARD_URL . 'assets/images/onboarding.svg';
		}

		wp_localize_script(
			'presto/dashboard/admin',
			'prestoPlayer',
			array(
				'root'                      => esc_url_raw( get_rest_url() ),
				'nonce'                     => wp_create_nonce( 'presto_player_admin' ),
				'ajaxurl'                   => admin_url( 'admin-ajax.php' ),
				'wpVersionString'           => 'wp/v2/',
				'prestoVersionString'       => 'presto-player/v1/',
				'version'                   => Plugin::version(),
				'proVersion'                => Plugin::proVersion(),
				'isPremium'                 => Plugin::isPro(),
				'is_pro_available'          => Plugin::isPro(),
				'isProPluginActive'         => class_exists( '\PrestoPlayer\Pro\Plugin' ),
				'hasLicenseKey'             => License::hasKey(),
				'license_status'            => Plugin::licenseStatus(),
				'dashboardUrl'              => admin_url( 'admin.php?page=presto-dashboard' ),
				'upgradeLink'               => 'https://prestoplayer.com/pricing/',
				'upgrade_link'              => 'https://prestoplayer.com/pricing/',
				'onboarding_image'          => $onboarding_image,
				'upgrade_image'             => trailingslashit( PRESTO_PLAYER_PLUGIN_URL ) . 'img/upgrade-illustration.png',
				'createMediaUrl'            => admin_url( 'post-new.php?post_type=pp_video_block' ),
				'mediaHubUrl'               => admin_url( 'admin.php?page=presto-dashboard&tab=MediaHub' ),
				'onboardingUrl'             => admin_url( 'admin.php?page=presto-dashboard&post_type=pp_video_block&tab=Onboarding' ),
				'currentUser'               => array(
					'display_name' => $current_user->display_name,
					'user_login'   => $current_user->user_login,
					'user_email'   => $current_user->user_email,
					'first_name'   => $current_user->user_firstname ? $current_user->user_firstname : $current_user->display_name,
					'last_name'    => $current_user->user_lastname ? $current_user->user_lastname : '',
				),
				'suredash_status'           => $this->getPluginStatus( 'suredash/suredash.php' ),
				'surecart_status'           => $this->getPluginStatus( 'surecart/surecart.php' ),
				'suretriggers_status'       => $this->getPluginStatus( 'suretriggers/suretriggers.php' ),
				'suremembers_status'        => $this->getPluginStatus( 'suremembers/suremembers.php' ),
				'suremails_status'          => $this->getPluginStatus( 'suremails/suremails.php' ),
				'sureforms_status'          => $this->getPluginStatus( 'sureforms/sureforms.php' ),
				'onboarding_completed'      => get_option( 'presto_player_onboarding_completed', 'no' ) === 'yes',
				'onboarding_redirect'       => isset( $_GET['tab'] ) && 'Onboarding' === $_GET['tab'], // phpcs:ignore WordPress.Security.NonceVerification.Recommended
				'onboarding'                => array(
					'addonList' => array(
						array(
							'slug'        => 'suredash',
							'title'       => __( 'Build Your Video Community with SureDash', 'presto-player' ),
							'logo'        => 'https://ps.w.org/suredash/assets/icon-256x256.gif',
							'description' => __( 'Create a members-only space around your video content with courses, forums, and community features.', 'presto-player' ),
						),
						array(
							'slug'        => 'surecart',
							'title'       => __( 'Sell Video Content with SureCart', 'presto-player' ),
							'logo'        => 'https://ps.w.org/surecart/assets/icon-256x256.gif',
							'description' => __( 'Accept payments for courses, memberships, and digital downloads directly from your site.', 'presto-player' ),
						),
						array(
							'slug'        => 'suretriggers',
							'title'       => __( 'Automate Your Video Workflows with OttoKit', 'presto-player' ),
							'logo'        => 'https://ps.w.org/suretriggers/assets/icon-256x256.png',
							'description' => __( 'Trigger actions when videos are watched, emails captured, or goals reached — no code needed.', 'presto-player' ),
						),
						array(
							'slug'        => 'suremails',
							'title'       => __( 'Keep Emails Out of Spam with SureMail', 'presto-player' ),
							'logo'        => 'https://ps.w.org/suremails/assets/icon-256x256.gif',
							'description' => __( 'Ensure video notifications and email captures actually reach your audience\'s inbox.', 'presto-player' ),
						),
					),
				),
				'canManageEmailSubmissions' => current_user_can( 'manage_options' ),
				'i18n'                      => Translation::geti18n(),
				'api'                       => array(
					'analyticsViews'     => '/presto-player/v1/analytics/views',
					'analyticsWatchTime' => '/presto-player/v1/analytics/watch-time',
					'analyticsTopVideos' => '/presto-player/v1/analytics/top-videos',
					'analyticsTopUsers'  => '/presto-player/v1/analytics/top-users',
					'activatePlugin'     => '/presto-player/v1/activate-plugin',
				),
			)
		);
	}
}
