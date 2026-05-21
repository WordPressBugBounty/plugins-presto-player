<?php
/**
 * License validity check (free plugin, core-side).
 *
 * Caches a 24h transient `presto_player_license_state` (`'active'` | `'invalid'`)
 * refreshed on WP's plugin-update-check cron. `Plugin::isPro()` reads it.
 * Only path to `'invalid'`: licensing server emits `licence_status: 'expired'`.
 *
 * @package PrestoPlayer\Services\License
 */

namespace PrestoPlayer\Services\License;

use PrestoPlayer\Models\Setting;
use PrestoPlayer\Support\Utility;

/**
 * License validity service.
 *
 * Owns the read path (`isActive()`), the cron-driven refresh, the key-change
 * reactive trigger, and the admin notice. State lives in a 24h transient —
 * no custom cron, no model.
 */
class License {

	const TRANSIENT  = 'presto_player_license_state';
	const TTL        = DAY_IN_SECONDS;
	const API_URL    = 'https://my.prestomade.com/index.php';
	const PRODUCT_ID = 'presto-player-pro';

	const RENEW_URL   = 'https://my.prestomade.com/my-account/';
	const PRICING_URL = 'https://prestoplayer.com/pricing/';

	/**
	 * Per-request memoization. Reset on key change and refresh.
	 *
	 * @var bool|null
	 */
	private static $cache = null;

	/**
	 * Wire up hooks.
	 *
	 * @return void
	 */
	public function register() {
		// Gated on wp_doing_cron() inside the callback — the same filter fires
		// on foreground admin requests too, and a 15s HTTP call would block
		// the pageload.
		add_filter( 'pre_set_site_transient_update_plugins', array( $this, 'refreshOnUpdateCheck' ) );

		// Any write to the license option clears the cached verdict.
		$option = Setting::getGroupName( 'license' );
		add_action( "update_option_{$option}", array( $this, 'onLicenseChange' ) );
		add_action( "add_option_{$option}", array( $this, 'onLicenseChange' ) );

		add_action( 'admin_notices', array( $this, 'maybeNotice' ) );
	}

	/**
	 * Licensing API endpoint — filterable for staging mirrors.
	 *
	 * @return string
	 */
	public static function apiUrl() {
		return (string) apply_filters( 'presto_player_license_api_url', self::API_URL );
	}

	/**
	 * Domain string sent to the licensing server.
	 *
	 * Server keys activations by exact (key, domain). MUST stay in the
	 * historical browser-context form `host[:port][/path]` without a scheme —
	 * normalizing (lowercase, slashes, default ports) orphans existing seats.
	 *
	 * preg_replace, not is_ssl(), keeps this stable across browser and
	 * WP-CLI cron contexts. Filterable for reverse proxies and domain mapping.
	 *
	 * TODO: Pro's `LicensedProduct::domain()` is a duplicate; fold into this.
	 *
	 * @return string
	 */
	public static function canonicalDomain() {
		$url    = (string) get_bloginfo( 'wpurl' );
		$domain = preg_replace( '#^https?://#i', '', $url );
		return (string) apply_filters( 'presto_player_license_domain', (string) $domain );
	}

	/**
	 * Renewal CTA target — filterable.
	 *
	 * @return string
	 */
	public static function renewUrl() {
		return (string) apply_filters( 'presto_player_license_renew_url', self::RENEW_URL );
	}

	/**
	 * Pricing CTA target — filterable.
	 *
	 * @return string
	 */
	public static function pricingUrl() {
		return (string) apply_filters( 'presto_player_license_pricing_url', self::PRICING_URL );
	}

	/**
	 * Local-first read. No HTTP. Per-request memoized.
	 *
	 * False only when (a) no key is stored, or (b) the cached verdict is the
	 * literal `'invalid'`. Anything else (missing transient, malformed value)
	 * is treated as active — bias toward keeping paying customers active.
	 *
	 * Do NOT call `Plugin::isPro()` from here — it reads this method.
	 *
	 * @return bool
	 */
	public static function isActive() {
		if ( null !== self::$cache ) {
			return self::$cache;
		}
		if ( self::isVipBuild() ) {
			self::$cache = true;
			return self::$cache;
		}
		if ( ! self::hasKey() ) {
			self::$cache = false;
			return self::$cache;
		}
		self::$cache = ( 'invalid' !== get_transient( self::TRANSIENT ) );
		return self::$cache;
	}

	/**
	 * Whether a license key is stored (regardless of validity).
	 *
	 * @return bool
	 */
	public static function hasKey() {
		return '' !== (string) Setting::get( 'license', 'key' );
	}

	/**
	 * VIP builds of Pro ship without `inc/Services/License/`, so they can't go
	 * through this code path. VIP customers are entitled by WordPress.com VIP,
	 * not by a key — treat them as always active to keep `Plugin::isPro()` true
	 * and the admin notice suppressed.
	 *
	 * Detected by the same signal Pro itself uses in `Plugin::requiresLicensing()`:
	 * the absence of `\PrestoPlayer\Pro\Services\License\License`. Filterable
	 * for custom deployments and tests.
	 *
	 * @return bool
	 */
	private static function isVipBuild() {
		$is_vip = class_exists( '\PrestoPlayer\Pro\Plugin' )
			&& ! class_exists( '\PrestoPlayer\Pro\Services\License\License' );
		return (bool) apply_filters( 'presto_player_license_is_vip', $is_vip );
	}

	/**
	 * Cron-only refresh hooked on WP's plugin-update-check filter.
	 *
	 * On transport failure `fetch()` returns null and we leave the transient
	 * untouched, so the prior verdict survives the outage.
	 *
	 * @param mixed $value Filter value (returned untouched).
	 * @return mixed
	 */
	public function refreshOnUpdateCheck( $value ) {
		if ( ! wp_doing_cron() || ! self::hasKey() ) {
			return $value;
		}

		$verdict = $this->fetch();
		if ( null !== $verdict && get_transient( self::TRANSIENT ) !== $verdict ) {
			set_transient( self::TRANSIENT, $verdict, self::TTL );
			self::$cache = null;
		}

		return $value;
	}

	/**
	 * Clears the cached verdict on any license-option write. Next cron
	 * tick reconfirms with the server.
	 *
	 * @return void
	 */
	public function onLicenseChange() {
		delete_transient( self::TRANSIENT );
		self::$cache = null;
	}

	/**
	 * Render an admin notice on non-PP screens when the license is invalid.
	 *
	 * @return void
	 */
	public function maybeNotice() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		if ( ! class_exists( '\PrestoPlayer\Pro\Plugin' ) ) {
			return;
		}
		if ( Utility::isPrestoPlayerPage() ) {
			return;
		}
		if ( self::isActive() ) {
			return;
		}

		$no_key = ! self::hasKey();
		if ( $no_key ) {
			// Pro installed but no key yet — yellow, points to in-app activation.
			$notice_class     = 'notice-warning';
			$message          = __( 'Activate your Presto Player Pro license to unlock Pro features and receive automatic updates.', 'presto-player' );
			$primary_label    = __( 'Activate License', 'presto-player' );
			$primary_url      = admin_url( 'admin.php?page=presto-dashboard&tab=Settings&section=license' );
			$primary_external = false;
			$secondary_label  = __( 'Buy Subscription', 'presto-player' );
			$secondary_url    = self::pricingUrl();
		} else {
			// Expired — red, primary CTA renews.
			$notice_class     = 'notice-error';
			$message          = __( 'Your Presto Player Pro license has expired. Please renew to restore Pro Features, Premium Support & Automatic Plugin Updates.', 'presto-player' );
			$primary_label    = __( 'Renew Now', 'presto-player' );
			$primary_url      = self::renewUrl();
			$primary_external = true;
			$secondary_label  = '';
			$secondary_url    = '';
		}
		?>
		<div class="notice <?php echo esc_attr( $notice_class ); ?> is-dismissible">
			<p><strong><?php esc_html_e( 'Presto Player', 'presto-player' ); ?></strong></p>
			<p><?php echo esc_html( $message ); ?></p>
			<p>
				<a href="<?php echo esc_url( $primary_url ); ?>" class="button button-primary"<?php echo $primary_external ? ' target="_blank" rel="noopener noreferrer"' : ''; ?>><?php echo esc_html( $primary_label ); ?></a>
				<?php if ( ! empty( $secondary_label ) ) : ?>
					<a href="<?php echo esc_url( $secondary_url ); ?>" class="button" target="_blank" rel="noopener noreferrer" style="margin-left: 6px;"><?php echo esc_html( $secondary_label ); ?></a>
				<?php endif; ?>
			</p>
		</div>
		<?php
	}

	/**
	 * Fetch fresh license verdict from the server.
	 *
	 * Returns `'active'` or `'invalid'` on an authoritative response, or null
	 * if the response says nothing about the license itself (transport failure,
	 * request-level error, malformed body) — caller preserves cache.
	 *
	 * Uses `activate` because `status-check` currently fatals on the
	 * prestomade.com server for non-active keys. With `canonicalDomain()`
	 * matching Pro's domain, `activate` is idempotent (returns `s101`).
	 *
	 * Instance method so tests can substitute it via Mockery partials.
	 *
	 * @return string|null
	 */
	protected function fetch() {
		$resp = wp_remote_get(
			add_query_arg(
				array(
					'woo_sl_action'     => 'activate',
					'licence_key'       => (string) Setting::get( 'license', 'key' ),
					'product_unique_id' => self::PRODUCT_ID,
					'domain'            => self::canonicalDomain(),
				),
				self::apiUrl()
			),
			array( 'timeout' => 15 )
		);

		if ( is_wp_error( $resp ) || 200 !== (int) wp_remote_retrieve_response_code( $resp ) ) {
			$this->logTransportFailure(
				is_wp_error( $resp )
					? $resp->get_error_code()
					: 'http_' . wp_remote_retrieve_response_code( $resp )
			);
			return null;
		}

		$body  = json_decode( wp_remote_retrieve_body( $resp ) );
		$first = is_array( $body ) ? ( isset( $body[0] ) ? $body[0] : null ) : $body;

		if ( ! is_object( $first ) ) {
			$this->logTransportFailure( 'malformed_response' );
			return null;
		}

		// Only `licence_status: 'expired'` invalidates. To lock on a new state
		// (e.g. blocked, suspended), extend this check.
		if ( isset( $first->licence_status ) ) {
			return ( 'expired' === $first->licence_status ) ? 'invalid' : 'active';
		}

		$code = isset( $first->status_code ) ? (string) $first->status_code : 'no_code';
		$this->logTransportFailure( 'non_authoritative_' . $code );
		return null;
	}

	/**
	 * Conditional error_log — only when WP debug logging is on, to avoid
	 * twice-daily noise on installs where the licensing endpoint flaps.
	 *
	 * Instance method so tests can mock it.
	 *
	 * @param string $code Error code.
	 * @return void
	 */
	protected function logTransportFailure( $code ) {
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG && defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG ) {
			error_log( sprintf( '[Presto License] transport failure: %s', $code ) ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
		}
	}

	/**
	 * Uninstall cleanup — called from the plugin's uninstall hook.
	 * Named static method (closures don't survive WP's uninstall boundary).
	 *
	 * @return void
	 */
	public static function uninstall() {
		delete_transient( self::TRANSIENT );
	}
}
