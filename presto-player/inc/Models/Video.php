<?php
/**
 * Video model.
 *
 * @package PrestoPlayer
 * @subpackage Models
 */

namespace PrestoPlayer\Models;

use PrestoPlayer\Services\Blocks\VimeoBlockService;
use PrestoPlayer\Services\Blocks\YoutubeBlockService;

/**
 * Represents a row in the presto_player_videos table.
 *
 * @property int    $id
 * @property string $title
 * @property string $type
 * @property string $src
 * @property string $external_id
 * @property int    $attachment_id
 * @property int    $post_id
 * @property int    $created_by
 * @property string $created_at
 * @property string $updated_at
 * @property string $deleted_at
 */
class Video extends Model {

	/**
	 * Table used to access db
	 *
	 * @var string
	 */
	protected $table = 'presto_player_videos';

	/**
	 * Model Schema
	 *
	 * @var array
	 */
	public function schema() {
		return array(
			'id'            => array(
				'type' => 'integer',
			),
			'title'         => array(
				'type'              => 'string',
				'sanitize_callback' => 'wp_kses_post',
			),
			'type'          => array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
			),
			'src'           => array(
				'type'              => 'string',
				'sanitize_callback' => 'esc_url_raw',
			),
			'external_id'   => array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
			),
			'attachment_id' => array(
				'type' => 'integer',
			),
			'post_id'       => array(
				'type' => 'integer',
			),
			'created_by'    => array(
				'type'    => 'integer',
				'default' => get_current_user_id(),
			),
			'created_at'    => array(
				'type' => 'string',
			),
			'updated_at'    => array(
				'type' => 'string',
			),
			'deleted_at'    => array(
				'type' => 'string',
			),
		);
	}

	/**
	 * These attributes are queryable
	 *
	 * @var array
	 */
	protected $queryable = array(
		'src',
		'video_id',
		'title',
		'type',
		'attachment_id',
		'external_id',
	);

	/**
	 * Hydrate the model from the given attributes.
	 *
	 * Auto-populates title and src from the attachment when an attachment_id is set.
	 *
	 * @param array $args Attribute values.
	 * @return self
	 */
	public function set( $args ) {
		parent::set( $args );

		if ( ! empty( $this->attributes->attachment_id ) ) {
			$title                   = get_the_title( $this->attributes->attachment_id );
			$src                     = wp_get_attachment_url( $this->attributes->attachment_id );
			$this->attributes->title = $title ? $title : $this->attributes->title;
			$this->attributes->src   = $src ? $src : $this->attributes->src;
		}

		return $this;
	}

	/**
	 * Get the video's embedded title from noembed.com.
	 *
	 * @param string $src Video source URL.
	 * @return string|\WP_Error Embedded title, or WP_Error on HTTP failure.
	 */
	public function getEmbeddedTitle( $src = '' ) {
		if ( empty( $src ) ) {
			return '';
		}
		$response = wp_remote_get( 'https://noembed.com/embed?dataType=json&url=' . urlencode( $src ) );
		if ( is_wp_error( $response ) ) {
			return $response;
		}
		$body         = wp_remote_retrieve_body( $response );
		$api_response = json_decode( $body, true );
		return $api_response['title'] ?? '';
	}

	/**
	 * Maybe auto-create title if not set.
	 *
	 * @param array $args Video attributes.
	 * @return array
	 */
	public function maybeAutoCreateTitle( $args ) {
		// Remotely get the title if not provided.
		if ( empty( $args['title'] ) && in_array( $args['type'], array( 'youtube', 'vimeo' ), true ) ) {
			$title = $this->getEmbeddedTitle( $args['src'] );
			if ( ! is_wp_error( $title ) && ! empty( $title ) ) {
				$args['title'] = $title;
			}
		}

		// Fallback to url.
		$args['title'] = empty( $args['title'] ) ? $args['src'] : $args['title'];

		// Return args.
		return $args;
	}

	/**
	 * Create a new video.
	 *
	 * @param array $args Video attributes.
	 * @return int|\WP_Error
	 */
	public function create( $args = array() ) {
		// Required params.
		if ( empty( $args['external_id'] ) && empty( $args['attachment_id'] ) && empty( $args['src'] ) ) {
			return new \WP_Error( 'invalid_parameters', 'You must enter an attachment_id, external_id or src.' );
		}

		$args = $this->maybeAutoCreateTitle( $args );

		// Create.
		return parent::create( $args );
	}

	/**
	 * Update a video record.
	 *
	 * @param array $args Video attributes.
	 * @return int|false
	 */
	public function update( $args = array() ) {
		if ( ! empty( $args['attachment_id'] ) && ! empty( $args['title'] ) ) {
			wp_update_post(
				array(
					'ID'         => $args['attachment_id'],
					'post_title' => $args['title'],
				)
			);
		}
		return parent::update( $args );
	}

	/**
	 * Get the video's created at date.
	 *
	 * @return string Created At date
	 */
	public function getCreatedAt() {
		return $this->created_at;
	}

	/**
	 * Get the video title.
	 *
	 * @return string Title
	 */
	public function getTitle() {
		return $this->title;
	}

	/**
	 * Get the attachment id.
	 *
	 * @return int Attachment ID
	 */
	public function getAttachmentID() {
		return $this->attachment_id;
	}

	/**
	 * Get the attachment post title.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return string|false Title or false if not found.
	 */
	public function getAttachmentPostTitle( $attachment_id = null ) {
		if ( empty( $attachment_id ) ) {
			return false;
		}
		$attachment       = get_post( $attachment_id );
		$attachment_title = $attachment->post_title;
		if ( ! empty( $attachment_title ) ) {
			return $attachment_title;
		}
		return false;
	}

	/**
	 * Get external_id (GUID) from database by video ID or src.
	 *
	 * @param string $src      The video source URL (optional).
	 * @return string The external_id (GUID) or empty string if not found.
	 */
	public function getExternalId( $src = '' ) {
		// If external_id is already set, return it.
		if ( isset( $this->external_id ) ) {
			return $this->external_id;
		}

		// If video_id is not set, return empty string.
		if ( empty( $src ) ) {
			return '';
		}

		// Find the video by id and return the external_id.
		$video = $this->findWhere( array( 'src' => $src ) );
		return $video->external_id ?? '';
	}
}
