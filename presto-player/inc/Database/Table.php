<?php
/**
 * Database table helper.
 *
 * @package PrestoPlayer
 */

namespace PrestoPlayer\Database;

/**
 * Creates, drops and checks for custom database tables.
 */
class Table {

	/**
	 * Create a database table.
	 *
	 * @param string  $name    Table name (without the WordPress prefix).
	 * @param string  $columns SQL column definitions.
	 * @param integer $version Schema version used to gate upgrades.
	 * @param array   $opts    Optional table options (upgrade_method, table_options).
	 * @return void
	 */
	public function create( $name, $columns, $version = 1, $opts = array() ) {
		$current_version = get_option( "{$name}_database_version", 0 );

		if ( $version == $current_version ) {
			return;
		}

		global $wpdb;

		$full_table_name = $wpdb->prefix . $name;

		$opts = wp_parse_args(
			$opts,
			array(
				'upgrade_method' => 'dbDelta',
				'table_options'  => '',
			)
		);

		$charset_collate = '';
		if ( $wpdb->has_cap( 'collation' ) ) {
			if ( ! empty( $wpdb->charset ) ) {
				$charset_collate = "DEFAULT CHARACTER SET $wpdb->charset";
			}
			if ( ! empty( $wpdb->collate ) ) {
				$charset_collate .= " COLLATE $wpdb->collate";
			}
		}

		$table_options = $charset_collate . ' ' . $opts['table_options'];

		// Use dbDelta by default.
		if ( 'dbDelta' == $opts['upgrade_method'] ) {
			require_once ABSPATH . 'wp-admin/includes/upgrade.php';
			dbDelta( "CREATE TABLE $full_table_name ( $columns ) $table_options" );
			update_option( "{$name}_database_version", $version );
			return;
		}

		if ( 'delete_first' == $opts['upgrade_method'] ) {
			$wpdb->query( "DROP TABLE IF EXISTS $full_table_name;" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- DDL on an internal table name ($wpdb->prefix + schema name); identifiers cannot be bound.
		}

		$wpdb->query( "CREATE TABLE IF NOT EXISTS $full_table_name ( $columns ) $table_options;" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter -- DDL with internal table name and schema-defined columns; no user input.

		update_option( "{$name}_database_version", $version );
	}

	/**
	 * Drops the table and database option.
	 *
	 * @param string $name Fully qualified table name to drop.
	 * @return void
	 */
	public function drop( $name ) {
		global $wpdb;
		// Table identifiers cannot be bound via $wpdb->prepare(); $name is an internally controlled value.
		$wpdb->query( 'DROP TABLE IF EXISTS ' . $name ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		delete_option( "presto_courses_{$name}_database_version" );
	}

	/**
	 * Checks whether a table exists.
	 *
	 * @param string $name Table name (without the WordPress prefix).
	 * @return bool True when the table exists, false otherwise.
	 */
	public function exists( $name ) {
		global $wpdb;
		$table_name = $wpdb->prefix . $name;
		if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $table_name ) ) ) == $table_name ) {
			return true;
		}
		return false;
	}
}
