<?php
/**
 * Global template helper functions.
 *
 * No ABSPATH guard here: this file is eagerly loaded via Composer's `autoload.files`
 * (vendor/autoload.php), so an exit() would abort every CLI/PHPUnit run. It only
 * declares a function and has no side effects on direct access.
 *
 * @package PrestoPlayer
 */

if ( ! function_exists( 'presto_player' ) ) :
	/**
	 * Renders the Presto Player shortcode for a given media item.
	 *
	 * @param int|string $id Media item ID.
	 * @return string Rendered shortcode output.
	 */
	function presto_player( $id ) {
		return do_shortcode( '[presto_player id=' . absint( $id ) . ']' );
	}
endif;
