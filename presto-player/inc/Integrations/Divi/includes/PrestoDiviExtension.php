<?php
/**
 * Registers the Presto Player Divi Builder extension.
 *
 * @package PrestoPlayer
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * Presto Player Divi Builder extension.
 */
class PrestoDiviExtension extends DiviExtension {


	/**
	 * The gettext domain for the extension's translations.
	 *
	 * @since 1.0.0
	 *
	 * @var string
	 */
	public $gettext_domain = 'presto-player';

	/**
	 * The extension's WP Plugin name.
	 *
	 * @since 1.0.0
	 *
	 * @var string
	 */
	public $name = 'presto-player';

	/**
	 * The extension's version
	 *
	 * @since 1.0.0
	 *
	 * @var string
	 */
	public $version = '1.0.0';

	/**
	 * PrestoDiviExtensions constructor.
	 *
	 * @param string $name The extension name.
	 * @param array  $args Optional extension arguments.
	 */
	public function __construct( $name = 'presto-player', $args = array() ) {
		$this->plugin_dir     = plugin_dir_path( __FILE__ );
		$this->plugin_dir_url = plugin_dir_url( $this->plugin_dir );

		parent::__construct( $name, $args );
	}

	/**
	 * Enqueues minified, production javascript bundles.
	 *
	 * @since 3.1
	 */
	protected function _enqueue_bundles() {
	}

	/**
	 * Enqueues backend styles.
	 *
	 * @return void
	 */
	protected function _enqueue_backend_styles() {
	}

	/**
	 * Enqueues scripts on the wp_enqueue_scripts hook.
	 *
	 * @return void
	 */
	public function wp_hook_enqueue_scripts() {
	}
}

new PrestoDiviExtension();
