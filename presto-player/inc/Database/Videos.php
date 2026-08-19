<?php
/**
 * Videos table.
 *
 * @package PrestoPlayer\Database
 */

namespace PrestoPlayer\Database;

use PrestoPlayer\Database\Table;

/**
 * Videos table.
 */
class Videos {

	/**
	 * Table service.
	 *
	 * @var Table
	 */
	protected $table;

	/**
	 * Schema version. Bump to re-run dbDelta.
	 *
	 * @var int
	 */
	protected $version = 4;

	/**
	 * Table name, without the site prefix.
	 *
	 * @var string
	 */
	protected $name = 'presto_player_videos';

	/**
	 * Constructor.
	 *
	 * @param Table $table Table service.
	 */
	public function __construct( Table $table ) {
		$this->table = $table;
	}

	/**
	 * The prefixed table name.
	 *
	 * @return string
	 */
	public function getName() {
		global $wpdb;
		return $wpdb->prefix . $this->name;
	}

	/**
	 * Add videos table
	 * This is used for global video analytics
	 *
	 * @return void
	 */
	public function install() {
		$this->table->create(
			$this->name,
			'
            id bigint(20) unsigned NOT NULL auto_increment,
            title varchar(255) NOT NULL,
            type varchar(155) NOT NULL,
            external_id varchar(155) NULL,
            attachment_id bigint(20) unsigned NULL,
            post_id bigint(20) NULL,
            src varchar(255) NULL,
            created_by bigint(20) unsigned NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
            updated_at TIMESTAMP NOT NULL,
            deleted_at TIMESTAMP NULL,
            PRIMARY KEY  (id),
            KEY external_id (external_id),
            KEY attachment_id (attachment_id),
            KEY created_at (created_at),
            KEY updated_at (updated_at)
        ',
			$this->version
		);
	}

	/**
	 * Uninstall tables
	 *
	 * @return void
	 */
	public function uninstall() {
		$this->table->drop( $this->getName() );
	}

	/**
	 * Whether the table exists.
	 *
	 * @return bool
	 */
	public function exists() {
		return $this->table->exists( $this->name );
	}
}
