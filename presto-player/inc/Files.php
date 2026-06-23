<?php
/**
 * Handles private media files and attachment query filtering.
 *
 * @package PrestoPlayer
 */

namespace PrestoPlayer;

use PrestoPlayer\Attachment;

/**
 * Manages the private uploads folder and filters attachment queries.
 */
class Files {

	/**
	 * Allowed ip addresses to private folder
	 *
	 * @var array
	 */
	protected $allowed_ips = array();

	/**
	 * Privat folder name
	 *
	 * @var string
	 */
	protected $private_folder = 'presto-player-private';

	/**
	 * Store allowed ips and let user filter private folder
	 */
	public function __construct() {
		$this->allowed_ips    = include PRESTO_PLAYER_PLUGIN_DIR . '/inc/Libraries/BunnyCDNIPs.php';
		$this->private_folder = apply_filters( 'presto_player_private_foldername', $this->private_folder );
	}

	/**
	 * Gets the list of allowed IP addresses for the private folder.
	 *
	 * @return array List of allowed IP addresses.
	 */
	public function getAllowedIPs() {
		return $this->allowed_ips;
	}

	/**
	 * Register actions and filters.
	 *
	 * @return self The current instance.
	 */
	public function register() {
		add_filter( 'upload_dir', array( $this, 'mediaUploadFolder' ) );
		add_filter( 'wp_prepare_attachment_for_js', array( $this, 'galleryLabel' ) );
		add_filter( 'wp_generate_attachment_metadata', array( $this, 'privateMeta' ), 10, 2 );
		add_action( 'ajax_query_attachments_args', array( $this, 'hidePrivate' ) );

		return $this;
	}

	/**
	 * Gets a public or private type
	 *
	 * @return string
	 */
	public function getVideoType() {
		$query = array();
		$url   = (string) wp_get_raw_referer();
		$parts = wp_parse_url( $url );
		isset( $parts['query'] ) ? parse_str( $parts['query'], $query ) : '';
		$type = isset( $query['presto_video_type'] ) ? $query['presto_video_type'] : '';
		return is_string( $type ) ? sanitize_key( $type ) : '';
	}

	/**
	 * Hides external attachment items from ajax query.
	 *
	 * @param array $query Query arguments for the attachments query.
	 * @return array Modified query arguments.
	 */
	public function hideAjaxExternalVideos( $query ) {
		$query['meta_query'] = array(
			'relation' => 'OR',
			array(
				'key'     => 'presto_external_id',
				'compare' => 'NOT EXISTS', // works!
			),
		);

		return $query;
	}

	/**
	 * Hide external videos on attachment page.
	 *
	 * @param \WP_Query $query The current attachments query.
	 * @return void
	 */
	public function hideExternalVideos( $query ) {
		global $pagenow;

		// Disable on uploads page.
		if ( 'upload.php' !== $pagenow ) {
			return;
		}

		// Allow filter to fetch.
		if ( apply_filters( 'presto_player_get_external_attachments', false ) ) {
			return;
		}

		$query->set(
			'meta_query',
			array(
				'relation' => 'OR',
				array(
					'key'     => 'presto_external_id',
					'compare' => 'NOT EXISTS', // works!
					'value'   => '', // This is ignored, but is necessary...
				),
			)
		);
	}

	/**
	 * Hides private/public items based on video type query.
	 *
	 * @param array $query Query arguments for the attachments query.
	 * @return array Modified query arguments.
	 */
	public function hidePrivate( $query ) {
		$type = $this->getVideoType();

		switch ( $type ) {
			case 'public': // Public only, don't show private.
				$query['meta_query'] = array(
					array(
						'relation' => 'AND',
						array(
							'key'     => 'presto_external_id',
							'compare' => 'NOT EXISTS', // works!
							'value'   => '', // This is ignored, but is necessary...
						),
						array(
							'relation' => 'OR',
							array(
								'key'     => 'presto-private-video',
								'compare' => 'NOT EXISTS', // works!
								'value'   => '', // This is ignored, but is necessary...
							),
							array(
								'key'   => 'presto-private-video',
								'value' => false,
							),
						),
					),
				);
				break;
			case 'private': // Private only.
				$query['meta_query'] = array(
					array(
						'relation' => 'AND',
						array(
							'key'     => 'presto_external_id',
							'compare' => 'NOT EXISTS', // works!
							'value'   => '', // This is ignored, but is necessary...
						),
						array(
							'key'   => 'presto-private-video',
							'value' => true,
						),
					),
				);
				break;
		}

		return $query;
	}

	/**
	 * Add meta data to attachment so WP knows it's private.
	 *
	 * @param array $data Attachment metadata.
	 * @param int   $id   Attachment ID.
	 * @return array Attachment metadata.
	 */
	public function privateMeta( $data, $id ) {
		if ( Attachment::isPrivate( $id ) ) {
			update_post_meta( $id, 'presto-private-video', true );
		}

		return $data;
	}


	/**
	 * Change media uploader folder only in case of private files.
	 *
	 * @param array $data Upload directory data.
	 * @return array Modified upload directory data.
	 */
	public function mediaUploadFolder( $data ) {
		if ( $this->getVideoType() === 'private' ) {
			$data['path']   = $data['basedir'] . '/' . $this->private_folder;
			$data['url']    = $data['baseurl'] . '/' . $this->private_folder;
			$data['subdir'] = $this->private_folder;
		}

		return $data;
	}

	/**
	 * If the media is into private folder change response to show.
	 *
	 * @param array $response Attachment data prepared for JavaScript.
	 * @return array Modified attachment data.
	 */
	public function galleryLabel( $response ) {
		if ( strpos( $response['url'], $this->private_folder ) !== false || strpos( $response['url'], 'video-src' ) !== false || strpos( $response['url'], 'presto-player-token' ) !== false ) {
			$response['filename'] = __( 'Private: ', 'presto-player' ) . $response['filename'];
		}

		return $response;
	}

	/**
	 * Adds the private folder
	 *
	 * @return void
	 */
	public function addPrivateFolder() {
		\WP_Filesystem();
		global $wp_filesystem;

		$private_folder = $this->makeFolder( $wp_filesystem, apply_filters( 'presto_player_private_folder_name', $this->private_folder ) );
		$this->setHtaccess( $wp_filesystem, $private_folder );

		if ( ! empty( $wp_filesystem->errors->errors ) ) {
			add_action( 'admin_notices', array( $this, 'errorNotice' ) );
		}
	}

	/**
	 * Show an error notice if we can't create the priate folder
	 *
	 * @return void
	 */
	public function errorNotice() {
		$class   = 'notice notice-error';
		$message = __( 'Irks! Error when creating a new private folder for private media', 'presto-player' );

		printf( '<div class="%1$s"><p>%2$s</p></div>', esc_attr( $class ), esc_html( $message ) );
	}

	/**
	 * Makes our custom folder in the .htaccess directory.
	 *
	 * @param \WP_Filesystem_Base $wp_filesystem WordPress filesystem instance.
	 * @param string              $folder_name   Name of the folder to create.
	 * @return string Absolute path to the created folder.
	 */
	private function makeFolder( $wp_filesystem, $folder_name ) {
		$wp_upload_dir  = wp_upload_dir();
		$private_folder = trailingslashit( $wp_upload_dir['basedir'] ) . $folder_name;
		$wp_filesystem->mkdir( $private_folder );

		return $private_folder;
	}

	/**
	 * Sets htaccess rules in the new private folder.
	 *
	 * @param \WP_Filesystem_Base $wp_filesystem  WordPress filesystem instance.
	 * @param string              $private_folder Absolute path to the private folder.
	 * @return void
	 */
	private function setHtaccess( $wp_filesystem, $private_folder ) {
		$file = trailingslashit( $private_folder ) . '.htaccess';
		$wp_filesystem->put_contents( $file, $this->return_htaccess_file_content(), FS_CHMOD_FILE );
	}

	/**
	 * Builds the Apache "allow from" whitelist for allowed IP addresses.
	 *
	 * @return string The generated allow directives.
	 */
	public function makeIPWhiteList() {
		$out = '';
		foreach ( $this->allowed_ips as $ip ) {
			$out .= "allow from $ip \n";
		}
		return $out;
	}

	/**
	 * Htaccess configuration
	 *
	 * @return string (heredoc)
	 */
	private function return_htaccess_file_content() {
		$list = $this->makeIPWhitelist();
		return "# Deny access to everything by default\n"
			. "Order Deny,Allow\n"
			. "deny from all\n"
			. $list . "\n"
			. "# Deny access to sub directory\n"
			. "<Files subdirectory/*>\n"
			. "    deny from all\n"
			. '    ' . $list . "\n"
			. '</Files>';
	}
}
