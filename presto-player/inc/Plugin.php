<?php
/**
 * Plugin main class file.
 *
 * @package PrestoPlayer
 */

namespace PrestoPlayer;

/**
 * Main Plugin class.
 */
class Plugin {
	/**
	 * Required versions for features.
	 *
	 * @var array
	 */
	protected const REQUIRED_VERSIONS = array(
		'popups' => '3.0.0',
	);

	/**
	 * Check if pro version is enabled AND licensed.
	 *
	 * In wp-env tests, defining `PRESTO_TESTSUITE` short-circuits the license
	 * check so unrelated Pro feature tests don't have to seed license state.
	 * To exercise the actual license-validity path inside a test, opt in via:
	 *
	 *     add_filter( 'presto_player_force_license_check', '__return_true' );
	 *
	 * @return bool
	 */
	protected function isPro() {
		if ( ! defined( 'PRESTO_PLAYER_PRO_ENABLED' ) ) {
			return false;
		}

		// Test-suite bypass; opt back in via `presto_player_force_license_check`.
		if (
			defined( 'PRESTO_TESTSUITE' ) && PRESTO_TESTSUITE
			&& ! apply_filters( 'presto_player_force_license_check', false )
		) {
			return true;
		}

		return Services\License\License::isActive();
	}

	/**
	 * Get the required pro version.
	 *
	 * @return string
	 */
	protected function requiredProVersion() {
		return '0.0.3';
	}

	/**
	 * Get the required pro version for a feature.
	 *
	 * @param string $feature Feature name to check.
	 * @return string
	 */
	protected function requiredProVersionForFeature( $feature ) {
		return self::REQUIRED_VERSIONS[ $feature ];
	}

	/**
	 * Get the version from plugin data
	 *
	 * @return string
	 */
	protected function version() {
		// Load version from plugin data.
		if ( ! \function_exists( 'get_plugin_data' ) ) {
			require_once \ABSPATH . 'wp-admin/includes/plugin.php';
		}

		return \get_plugin_data( PRESTO_PLAYER_PLUGIN_FILE, false, false )['Version'];
	}

	/**
	 * Get the current pro version.
	 *
	 * @return string|false
	 */
	protected function proVersion() {
		if ( ! $this->isPro() ) {
			return false;
		}
		if ( class_exists( '\PrestoPlayer\Pro\Plugin' ) ) {
			return \PrestoPlayer\Pro\Plugin::version();
		}
		return false;
	}

	/**
	 * Check if pro version meets minimum required version for a feature.
	 *
	 * @param string $feature Feature name to check.
	 * @return bool
	 */
	protected function hasRequiredProVersion( $feature ) {
		// get the required version for the feature.
		$required_versions = $this->requiredProVersionForFeature( $feature );

		// The feature does not exist.
		if ( empty( $required_versions ) ) {
			return false;
		}

		// get the pro version.
		$pro_version = $this->proVersion();

		// Pro version is not set (not installed).
		if ( ! $pro_version ) {
			return false;
		}

		// Compare the pro version with the required version.
		return version_compare( $pro_version, $required_versions, '>=' );
	}

	/**
	 * Get the license status.
	 *
	 * @return string 'licensed' or 'unlicensed'
	 */
	protected function licenseStatus() {
		if ( ! $this->isPro() || ! class_exists( '\PrestoPlayer\Pro\Plugin' ) ) {
			return 'unlicensed';
		}

		$pro_plugin = new \PrestoPlayer\Pro\Plugin();
		return $pro_plugin->hasLicense() ? 'licensed' : 'unlicensed';
	}

	/**
	 * Static Facade Accessor
	 *
	 * @param string $method Method to call.
	 * @param mixed  $params Method params.
	 *
	 * @return mixed
	 */
	public static function __callStatic( $method, $params ) {
		return call_user_func_array( array( new static(), $method ), $params );
	}
}
