<?php
/**
 * Video abilities (grouped).
 *
 * @package PrestoPlayer
 * @subpackage Services\Abilities\Abilities
 */

namespace PrestoPlayer\Services\Abilities\Abilities;

use PrestoPlayer\Models\Video;
use PrestoPlayer\Services\Abilities\Ability;
use PrestoPlayer\Services\Abilities\Concerns\CreatesReusableVideos;

/**
 * Creates a YouTube video and embeds it end-to-end: stores the Media Hub video,
 * materializes the reusable player post, and returns the shortcode + block.
 */
class CreateYouTubeVideoAbility extends Ability {

	use CreatesReusableVideos;

	/**
	 * {@inheritDoc}
	 */
	public function getName() {
		return 'presto-player/create-video-youtube';
	}

	/**
	 * {@inheritDoc}
	 */
	public function getLabel() {
		return __( 'Add YouTube video', 'presto-player' );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getDescription() {
		return __( 'Adds a YouTube video to the Media Hub and returns a ready-to-embed shortcode and block. Just pass the YouTube URL.', 'presto-player' );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getAnnotations() {
		return array(
			'readonly'    => false,
			'destructive' => false,
			'idempotent'  => true,
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function getInputSchema() {
		return array(
			'type'                 => 'object',
			'additionalProperties' => false,
			'required'             => array( 'url' ),
			'properties'           => array(
				'url'    => array(
					'type'        => 'string',
					'description' => __( 'YouTube video URL.', 'presto-player' ),
				),
				'title'  => array(
					'type'        => 'string',
					'description' => __( 'Display title. Optional.', 'presto-player' ),
				),
				'status' => array(
					'type'        => 'string',
					'enum'        => array( 'publish', 'draft' ),
					'description' => __( 'Post status for the embeddable video. Defaults to publish.', 'presto-player' ),
				),
			),
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function getOutputSchema() {
		return $this->reusableVideoOutputSchema();
	}

	/**
	 * {@inheritDoc}
	 */
	public function checkPermission() {
		return current_user_can( 'publish_posts' );
	}

	/**
	 * {@inheritDoc}
	 *
	 * @param array<string, mixed> $input Validated input.
	 * @return array<string, mixed>|\WP_Error
	 */
	public function execute( array $input ) {
		return $this->createReusableVideoForSource( 'youtube', $input );
	}
}

/**
 * Creates a Vimeo video and embeds it end-to-end.
 */
class CreateVimeoVideoAbility extends Ability {

	use CreatesReusableVideos;

	/**
	 * {@inheritDoc}
	 */
	public function getName() {
		return 'presto-player/create-video-vimeo';
	}

	/**
	 * {@inheritDoc}
	 */
	public function getLabel() {
		return __( 'Add Vimeo video', 'presto-player' );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getDescription() {
		return __( 'Adds a Vimeo video to the Media Hub and returns a ready-to-embed shortcode and block. Just pass the Vimeo URL.', 'presto-player' );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getAnnotations() {
		return array(
			'readonly'    => false,
			'destructive' => false,
			'idempotent'  => true,
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function getInputSchema() {
		return array(
			'type'                 => 'object',
			'additionalProperties' => false,
			'required'             => array( 'url' ),
			'properties'           => array(
				'url'    => array(
					'type'        => 'string',
					'description' => __( 'Vimeo video URL.', 'presto-player' ),
				),
				'title'  => array(
					'type'        => 'string',
					'description' => __( 'Display title. Optional.', 'presto-player' ),
				),
				'status' => array(
					'type'        => 'string',
					'enum'        => array( 'publish', 'draft' ),
					'description' => __( 'Post status for the embeddable video. Defaults to publish.', 'presto-player' ),
				),
			),
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function getOutputSchema() {
		return $this->reusableVideoOutputSchema();
	}

	/**
	 * {@inheritDoc}
	 */
	public function checkPermission() {
		return current_user_can( 'publish_posts' );
	}

	/**
	 * {@inheritDoc}
	 *
	 * @param array<string, mixed> $input Validated input.
	 * @return array<string, mixed>|\WP_Error
	 */
	public function execute( array $input ) {
		return $this->createReusableVideoForSource( 'vimeo', $input );
	}
}

/**
 * Creates a self-hosted video and embeds it end-to-end. Accepts a direct file
 * URL or a WordPress attachment ID.
 */
class CreateSelfHostedVideoAbility extends Ability {

	use CreatesReusableVideos;

	/**
	 * {@inheritDoc}
	 */
	public function getName() {
		return 'presto-player/create-video-self-hosted';
	}

	/**
	 * {@inheritDoc}
	 */
	public function getLabel() {
		return __( 'Add self-hosted video', 'presto-player' );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getDescription() {
		return __( 'Adds a self-hosted (MP4/HLS) video and returns a link to watch it plus a shortcode to embed it. If you have the video file, pass it directly as base64 (file + filename) — no manual upload needed. You can also pass a direct file URL or an existing Media Library attachment ID.', 'presto-player' );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getAnnotations() {
		return array(
			'readonly'    => false,
			'destructive' => false,
			'idempotent'  => true,
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function getInputSchema() {
		return array(
			'type'                 => 'object',
			'additionalProperties' => false,
			'properties'           => array(
				'url'           => array(
					'type'        => 'string',
					'description' => __( 'Direct video file URL (MP4/HLS) that the site can fetch. Provide file, attachment_id, or url.', 'presto-player' ),
				),
				'attachment_id' => array(
					'type'        => 'integer',
					'description' => __( 'WordPress media library attachment ID. Provide url, attachment_id, or file.', 'presto-player' ),
				),
				'file'          => array(
					'type'        => 'string',
					'description' => __( 'Base64-encoded video file contents, uploaded straight into the Media Library. Requires filename. Best for small clips (<= 50MB); for larger files use attachment_id.', 'presto-player' ),
				),
				'filename'      => array(
					'type'        => 'string',
					'description' => __( 'Filename for the uploaded file, e.g. clip.mp4 (used with file).', 'presto-player' ),
				),
				'title'         => array(
					'type'        => 'string',
					'description' => __( 'Display title. Optional.', 'presto-player' ),
				),
				'status'        => array(
					'type'        => 'string',
					'enum'        => array( 'publish', 'draft' ),
					'description' => __( 'Post status for the embeddable video. Defaults to publish.', 'presto-player' ),
				),
			),
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function getOutputSchema() {
		return $this->reusableVideoOutputSchema();
	}

	/**
	 * {@inheritDoc}
	 */
	public function checkPermission() {
		return current_user_can( 'publish_posts' );
	}

	/**
	 * {@inheritDoc}
	 *
	 * @param array<string, mixed> $input Validated input.
	 * @return array<string, mixed>|\WP_Error
	 */
	public function execute( array $input ) {
		// Raw file bytes (base64) are written straight into the Media Library, so
		// an AI client can upload a local file it holds without a fetchable URL.
		if ( empty( $input['attachment_id'] ) && ! empty( $input['file'] ) && ! empty( $input['filename'] ) ) {
			$attachment_id = $this->uploadVideoFromContent( (string) $input['file'], sanitize_file_name( $input['filename'] ) );
			if ( is_wp_error( $attachment_id ) ) {
				return $attachment_id;
			}
			unset( $input['file'], $input['filename'], $input['url'] );
			$input['attachment_id'] = $attachment_id;
		}

		// A direct file URL is downloaded into the Media Library so the video is
		// genuinely self-hosted (and actually plays); we then create from the
		// resulting attachment. An explicit attachment_id skips the download.
		if ( ! empty( $input['url'] ) && empty( $input['attachment_id'] ) ) {
			$attachment_id = $this->sideloadVideo( sanitize_text_field( $input['url'] ) );
			if ( is_wp_error( $attachment_id ) ) {
				return $attachment_id;
			}
			unset( $input['url'] );
			$input['attachment_id'] = $attachment_id;
		}
		return $this->createReusableVideoForSource( 'self-hosted', $input );
	}

	/**
	 * Write base64-encoded video bytes into the Media Library and return the
	 * attachment ID.
	 *
	 * @param string $base64   Base64-encoded file contents.
	 * @param string $filename Sanitized filename (extension drives the mime).
	 * @return int|\WP_Error
	 */
	protected function uploadVideoFromContent( $base64, $filename ) {
		if ( ! current_user_can( 'upload_files' ) ) {
			return new \WP_Error( 'forbidden', __( 'You are not allowed to upload files.', 'presto-player' ), array( 'status' => 403 ) );
		}
		$check = wp_check_filetype(
			$filename,
			array(
				'mp4'  => 'video/mp4',
				'm4v'  => 'video/mp4',
				'webm' => 'video/webm',
				'ogv'  => 'video/ogg',
				'mov'  => 'video/quicktime',
			)
		);
		if ( empty( $check['ext'] ) ) {
			return new \WP_Error( 'invalid_type', __( 'The filename must be a video file (mp4, webm, ogv, mov).', 'presto-player' ), array( 'status' => 400 ) );
		}

		$data = base64_decode( $base64, true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- decoding an uploaded file, not obfuscation.
		if ( false === $data || '' === $data ) {
			return new \WP_Error( 'invalid_file', __( 'Could not decode the file contents.', 'presto-player' ), array( 'status' => 400 ) );
		}
		if ( strlen( $data ) > 50 * MB_IN_BYTES ) {
			return new \WP_Error( 'file_too_large', __( 'The uploaded file exceeds 50MB. Upload it to the Media Library and pass attachment_id instead.', 'presto-player' ), array( 'status' => 413 ) );
		}

		// media.php defines wp_read_video_metadata(), which wp_generate_attachment_metadata()
		// needs for videos; both live under wp-admin and aren't loaded in a REST request.
		require_once ABSPATH . 'wp-admin/includes/media.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';

		$upload = wp_upload_bits( $filename, null, $data );
		if ( ! empty( $upload['error'] ) ) {
			return new \WP_Error( 'upload_failed', (string) $upload['error'], array( 'status' => 500 ) );
		}

		$attachment_id = wp_insert_attachment(
			array(
				'post_mime_type' => $check['type'],
				'post_title'     => sanitize_text_field( pathinfo( $filename, PATHINFO_FILENAME ) ),
				'post_status'    => 'inherit',
			),
			$upload['file'],
			0,
			true
		);
		if ( is_wp_error( $attachment_id ) ) {
			wp_delete_file( $upload['file'] );
			return $attachment_id;
		}
		wp_update_attachment_metadata( (int) $attachment_id, wp_generate_attachment_metadata( (int) $attachment_id, $upload['file'] ) );
		return (int) $attachment_id;
	}

	/**
	 * Download a video URL into the Media Library and return its attachment ID.
	 *
	 * @param string $url Direct video file URL.
	 * @return int|\WP_Error
	 */
	protected function sideloadVideo( $url ) {
		if ( ! current_user_can( 'upload_files' ) ) {
			return new \WP_Error( 'forbidden', __( 'You are not allowed to upload files.', 'presto-player' ), array( 'status' => 403 ) );
		}
		$url    = esc_url_raw( $url );
		$scheme = strtolower( (string) wp_parse_url( $url, PHP_URL_SCHEME ) );
		if ( ! in_array( $scheme, array( 'http', 'https' ), true ) ) {
			return new \WP_Error( 'invalid_url', __( 'Video URL must be an http(s) URL.', 'presto-player' ), array( 'status' => 400 ) );
		}

		$name  = basename( (string) wp_parse_url( $url, PHP_URL_PATH ) );
		$check = wp_check_filetype(
			$name,
			array(
				'mp4'  => 'video/mp4',
				'm4v'  => 'video/mp4',
				'webm' => 'video/webm',
				'ogv'  => 'video/ogg',
				'mov'  => 'video/quicktime',
			)
		);
		if ( empty( $check['ext'] ) ) {
			return new \WP_Error( 'invalid_type', __( 'The URL must point to a video file (mp4, webm, ogv, mov).', 'presto-player' ), array( 'status' => 400 ) );
		}

		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';

		// Same ceiling as the base64 branch of execute(), or passing `url` instead of
		// `file` is a free pass to stream a multi-gigabyte file into uploads. Ask the
		// remote how big it is first; download_url() has no size limit of its own.
		$max  = 50 * MB_IN_BYTES;
		$head = wp_safe_remote_head( $url, array( 'timeout' => 10 ) );
		if ( ! is_wp_error( $head ) ) {
			$length = wp_remote_retrieve_header( $head, 'content-length' );
			$length = is_array( $length ) ? (string) reset( $length ) : (string) $length;
			// Only enforce when the server actually tells us — plenty don't, and
			// failing closed there would reject perfectly ordinary files.
			if ( '' !== $length && (int) $length > $max ) {
				return new \WP_Error( 'file_too_large', __( 'The video at that URL exceeds 50MB. Upload it to the Media Library and pass attachment_id instead.', 'presto-player' ), array( 'status' => 413 ) );
			}
		}

		// Stream to a temp file with a byte ceiling rather than download_url(), which
		// has no limit of its own. The HEAD check above is advisory — a chunked or
		// Content-Length-less response would otherwise fill the disk before the
		// filesize() check below ever ran.
		$tmp = wp_tempnam( $name );
		if ( ! $tmp ) {
			return new \WP_Error( 'download_failed', __( 'Could not create a temporary file for the download.', 'presto-player' ), array( 'status' => 500 ) );
		}

		$response = wp_safe_remote_get(
			$url,
			array(
				'timeout'             => 300,
				'stream'              => true,
				'filename'            => $tmp,
				'limit_response_size' => $max + 1,
			)
		);
		if ( is_wp_error( $response ) ) {
			wp_delete_file( $tmp );
			// The bare HTTP reason phrase reads exactly like a capability failure on
			// this site, so say whose error it was.
			return new \WP_Error(
				'download_failed',
				sprintf(
					/* translators: 1: video URL. 2: error returned by the remote server. */
					__( 'Could not download the video from %1$s — the remote server returned: %2$s', 'presto-player' ),
					$url,
					$response->get_error_message()
				),
				array( 'status' => 400 )
			);
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		if ( $code < 200 || $code > 299 ) {
			wp_delete_file( $tmp );
			return new \WP_Error(
				'download_failed',
				sprintf(
					/* translators: 1: video URL. 2: HTTP status code. */
					__( 'Could not download the video from %1$s — the remote server returned HTTP %2$d.', 'presto-player' ),
					$url,
					$code
				),
				array( 'status' => 400 )
			);
		}

		// Anything at or past the ceiling means the stream was cut, so the file on
		// disk is a truncated video either way — reject rather than import it.
		$size = (int) filesize( $tmp );
		if ( $size > $max ) {
			wp_delete_file( $tmp );
			return new \WP_Error( 'file_too_large', __( 'The video at that URL exceeds 50MB. Upload it to the Media Library and pass attachment_id instead.', 'presto-player' ), array( 'status' => 413 ) );
		}

		$attachment_id = media_handle_sideload(
			array(
				'name'     => $name,
				'tmp_name' => $tmp,
			),
			0
		);
		if ( is_wp_error( $attachment_id ) ) {
			if ( file_exists( $tmp ) ) {
				wp_delete_file( $tmp );
			}
			return $attachment_id;
		}
		return (int) $attachment_id;
	}
}


/**
 * Returns one video by ID.
 */
class GetVideoAbility extends Ability {

	/**
	 * {@inheritDoc}
	 */
	public function getName() {
		return 'presto-player/get-video';
	}

	/**
	 * {@inheritDoc}
	 */
	public function getLabel() {
		return __( 'Get video', 'presto-player' );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getDescription() {
		return __( 'Returns one video record by ID, including its post_id and [presto_player id=N] shortcode.', 'presto-player' );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getAnnotations() {
		return array(
			'readonly'   => true,
			'idempotent' => true,
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function getInputSchema() {
		return array(
			'type'                 => 'object',
			'additionalProperties' => false,
			'required'             => array( 'video_id' ),
			'properties'           => array(
				'video_id' => array(
					'type'        => 'integer',
					'description' => __( 'Video record ID (a video_id from a create-video-* ability).', 'presto-player' ),
				),
			),
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function getAliases() {
		return array( 'video_id' => array( 'id' ) );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getOutputSchema() {
		return array(
			'type'       => 'object',
			'properties' => array(
				'id'               => array( 'type' => 'integer' ),
				'video_id'         => array( 'type' => 'integer' ),
				'title'            => array( 'type' => 'string' ),
				'type'             => array( 'type' => 'string' ),
				'src'              => array( 'type' => 'string' ),
				'external_id'      => array( 'type' => 'string' ),
				'attachment_id'    => array( 'type' => 'integer' ),
				'duration'         => array(
					'type'        => 'integer',
					'description' => __( 'Length in seconds of an uploaded video, read from the file WordPress measured at upload. 0 for embeds and for files that were never measured.', 'presto-player' ),
				),
				'post_id'          => array( 'type' => 'integer' ),
				'shortcode'        => array( 'type' => 'string' ),
				'shares_post_with' => $this->sharesPostWithSchema(),
				'tags'             => $this->videoTagsSchema(),
			),
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function checkPermission() {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * {@inheritDoc}
	 *
	 * @param array<string, mixed> $input Validated input.
	 * @return array<string, mixed>|\WP_Error
	 */
	public function execute( array $input ) {
		$video_id = isset( $input['video_id'] ) ? absint( $input['video_id'] ) : 0;
		$video    = new Video( $video_id );
		if ( ! $video->id ) {
			return new \WP_Error( 'not_found', __( 'Video not found.', 'presto-player' ), array( 'status' => 404 ) );
		}
		$data = $video->toArray();
		if ( $this->isSoftDeleted( $data ) ) {
			return new \WP_Error( 'not_found', __( 'Video not found.', 'presto-player' ), array( 'status' => 404 ) );
		}
		if ( ! current_user_can( 'edit_others_posts' ) && get_current_user_id() !== (int) ( $data['created_by'] ?? 0 ) ) {
			return new \WP_Error( 'forbidden', __( 'You are not allowed to access this video.', 'presto-player' ), array( 'status' => 403 ) );
		}
		return $this->withVideoId( $data );
	}
}

/**
 * Returns videos from the presto_player_videos table.
 */
class ListVideosAbility extends Ability {

	/**
	 * {@inheritDoc}
	 */
	public function getName() {
		return 'presto-player/list-videos';
	}

	/**
	 * {@inheritDoc}
	 */
	public function getLabel() {
		return __( 'List videos', 'presto-player' );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getDescription() {
		return __( 'Returns videos from the Presto Player library (the Media Hub). Each row carries its post_id, its Media Tags and a ready-to-paste [presto_player id=N] shortcode, empty when that video has no Media Hub post yet. Filter by tag with the tag parameter.', 'presto-player' );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getAnnotations() {
		return array(
			'readonly'   => true,
			'idempotent' => true,
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function getInputSchema() {
		return array(
			'type'                 => 'object',
			'additionalProperties' => false,
			'properties'           => array(
				'per_page' => array(
					'type'        => 'integer',
					'default'     => 50,
					'description' => __( 'Items per page (max 200).', 'presto-player' ),
				),
				'page'     => array(
					'type'        => 'integer',
					'default'     => 1,
					'description' => __( 'Page number.', 'presto-player' ),
				),
				'search'   => array(
					'type'        => 'string',
					'description' => __( 'Filter videos by title substring.', 'presto-player' ),
				),
				'tag'      => array(
					'type'        => 'string',
					'description' => __( 'Only videos filed under this Media Tag. Takes a tag slug (the same value the by_tag playlist uses), a tag name, or a term ID.', 'presto-player' ),
				),
			),
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function getOutputSchema() {
		return array(
			'type'       => 'object',
			'properties' => array(
				'videos'      => array(
					'type'  => 'array',
					'items' => array(
						'type'       => 'object',
						'properties' => array(
							'id'               => array( 'type' => 'integer' ),
							'video_id'         => array( 'type' => 'integer' ),
							'title'            => array( 'type' => 'string' ),
							'type'             => array( 'type' => 'string' ),
							'src'              => array( 'type' => 'string' ),
							'external_id'      => array( 'type' => 'string' ),
							'attachment_id'    => array( 'type' => 'integer' ),
							'duration'         => array(
								'type'        => 'integer',
								'description' => __( 'Length in seconds of an uploaded video, read from the file WordPress measured at upload. 0 for embeds and for files that were never measured.', 'presto-player' ),
							),
							'post_id'          => array( 'type' => 'integer' ),
							'shortcode'        => array( 'type' => 'string' ),
							'shares_post_with' => $this->sharesPostWithSchema(),
							'tags'             => $this->videoTagsSchema(),
						),
					),
				),
				'total'       => array( 'type' => 'integer' ),
				'page'        => array( 'type' => 'integer' ),
				'per_page'    => array( 'type' => 'integer' ),
				'total_pages' => array( 'type' => 'integer' ),
			),
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function checkPermission() {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * {@inheritDoc}
	 *
	 * @param array<string, mixed> $input Validated input.
	 * @return array<string, mixed>|\WP_Error
	 */
	public function execute( array $input ) {
		$per_page = isset( $input['per_page'] ) ? min( 200, max( 1, absint( $input['per_page'] ) ) ) : 50;
		$page     = isset( $input['page'] ) ? max( 1, absint( $input['page'] ) ) : 1;
		$search   = isset( $input['search'] ) ? sanitize_text_field( $input['search'] ) : '';
		$tag      = isset( $input['tag'] ) ? sanitize_text_field( (string) $input['tag'] ) : '';

		$video = new Video();

		// Users without edit_others_posts may only see their own videos so they
		// cannot enumerate every src / external_id in the library. Scope the query
		// itself so the DB does the counting and pagination.
		$created_by = current_user_can( 'edit_others_posts' ) ? 0 : get_current_user_id();

		if ( '' !== $tag ) {
			$term = $this->resolveVideoTagTerm( $tag );
			if ( ! $term ) {
				return new \WP_Error(
					'tag_not_found',
					__( 'No Media Tag matches that slug, name or ID.', 'presto-player' ),
					array( 'status' => 404 )
				);
			}
			// Tags live on the pp_video_block post, not on the videos row, so the
			// tagged posts decide which rows come back. The author scope is the same
			// on both sides: a user who cannot edit other people's posts sees only
			// their own videos and only their own tagged posts.
			$result = $video->fetchByTag( (int) $term->term_id, $page, $per_page, $created_by, $search, $created_by );
		} elseif ( '' !== $search ) {
			$result = $video->searchByTitle( $search, $page, $per_page, $created_by );
		} else {
			$args = array(
				'per_page' => $per_page,
				'page'     => $page,
				'order_by' => array( 'id' => 'DESC' ),
			);
			if ( $created_by ) {
				$args['created_by'] = $created_by;
			}
			$result = $video->fetch( $args );
		}

		$items = is_object( $result ) && isset( $result->data ) && is_array( $result->data ) ? $result->data : array();
		$total = is_object( $result ) && isset( $result->total ) ? (int) $result->total : count( $items );

		// Resolve every row's Media Hub post up front — one pass for the page
		// instead of a post_content scan and a get_post() per video.
		$cached         = array();
		$attachment_ids = array();
		foreach ( $items as $item ) {
			$row = $item->toArray();
			if ( ! empty( $row['id'] ) ) {
				$cached[ (int) $row['id'] ] = (int) ( $row['post_id'] ?? 0 );
			}
			if ( ! empty( $row['attachment_id'] ) ) {
				$attachment_ids[] = (int) $row['attachment_id'];
			}
		}
		$post_ids = $this->findVideoPostIds( $cached );

		// One query each for the rows sharing these posts and for their tags, rather
		// than a pair per row.
		$this->primeVideoIdsByPost( $post_ids );
		$resolved_posts = array_values( array_filter( $post_ids ) );
		if ( $resolved_posts ) {
			update_object_term_cache( $resolved_posts, 'pp_video_block' );
		}
		if ( $attachment_ids ) {
			// withVideoId() calls wp_get_attachment_metadata() per row below, which is
			// an uncached get_post_meta() per attachment without this — up to `per_page`
			// (200) queries on one list-videos call.
			update_meta_cache( 'post', $attachment_ids );
		}

		$rows = array();
		foreach ( $items as $item ) {
			$rows[] = $this->withVideoId( $item->toArray(), $post_ids );
		}
		$total = max( 0, $total );

		return array(
			'videos'      => $rows,
			'total'       => $total,
			'page'        => $page,
			'per_page'    => $per_page,
			'total_pages' => (int) ceil( $total / $per_page ),
		);
	}
}

/**
 * Updates a video by ID. Only provided fields are touched.
 */
class UpdateVideoAbility extends Ability {

	use CreatesReusableVideos;

	/**
	 * {@inheritDoc}
	 */
	public function getName() {
		return 'presto-player/update-video';
	}

	/**
	 * {@inheritDoc}
	 */
	public function getLabel() {
		return __( 'Update video', 'presto-player' );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getDescription() {
		return __( 'Updates a video record by ID. Pass only the fields you want to change. Media Tags can be set here too — pass tags with the full list of tag names you want the video filed under.', 'presto-player' );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getAnnotations() {
		return array(
			'readonly'    => false,
			'destructive' => false,
			'idempotent'  => true,
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function getInputSchema() {
		return array(
			'type'                 => 'object',
			'additionalProperties' => false,
			'required'             => array( 'video_id' ),
			'properties'           => array(
				'video_id'      => array(
					'type'        => 'integer',
					'description' => __( 'Video record ID (a video_id from a create-video-* ability).', 'presto-player' ),
				),
				'title'         => array( 'type' => 'string' ),
				'src'           => array( 'type' => 'string' ),
				'external_id'   => array( 'type' => 'string' ),
				'attachment_id' => array( 'type' => 'integer' ),
				'type'          => array(
					'type'        => 'string',
					'enum'        => array( 'youtube', 'vimeo', 'self-hosted', 'bunny', 'audio', 'hls', 'attachment' ),
					'description' => __( 'Change the provider, e.g. swapping a Vimeo video for a self-hosted MP4. Pass the new source alongside it; the player block is rebuilt to match.', 'presto-player' ),
				),
				'update_slug'   => array(
					'type'        => 'boolean',
					'default'     => false,
					'description' => __( 'Also rewrite the URL slug of the video and its page to match the new title. Off by default because moving a slug breaks every existing link: old URLs stop working and search engines have to re-index. Turn it on when the video was auto-named from its URL and its address is still the generated one nobody wants to see.', 'presto-player' ),
				),
				'tags'          => array(
					'type'        => 'array',
					'items'       => array( 'type' => 'string' ),
					'description' => __( 'Media Tags to file this video under, by name or slug. Replaces the tags it already has, so pass the full list you want to end up with; an empty array removes them all. Tags that do not exist yet are created.', 'presto-player' ),
				),
			),
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function getAliases() {
		return array( 'video_id' => array( 'id' ) );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getOutputSchema() {
		return array(
			'type'       => 'object',
			'properties' => array(
				'id'               => array( 'type' => 'integer' ),
				'video_id'         => array( 'type' => 'integer' ),
				'title'            => array( 'type' => 'string' ),
				'type'             => array( 'type' => 'string' ),
				'src'              => array( 'type' => 'string' ),
				'external_id'      => array( 'type' => 'string' ),
				'attachment_id'    => array( 'type' => 'integer' ),
				'duration'         => array(
					'type'        => 'integer',
					'description' => __( 'Length in seconds of an uploaded video, read from the file WordPress measured at upload. 0 for embeds and for files that were never measured.', 'presto-player' ),
				),
				'post_id'          => array( 'type' => 'integer' ),
				'shortcode'        => array( 'type' => 'string' ),
				'shares_post_with' => $this->sharesPostWithSchema(),
				'tags'             => $this->videoTagsSchema(),
				'slug'             => array(
					'type'        => 'string',
					'description' => __( 'The new URL slug, when update_slug moved it. Empty when the slug was left as it was, so existing links still work.', 'presto-player' ),
				),
			),
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function checkPermission() {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * {@inheritDoc}
	 *
	 * @param array<string, mixed> $input Validated input.
	 * @return array<string, mixed>|\WP_Error
	 */
	public function execute( array $input ) {
		$video_id = isset( $input['video_id'] ) ? absint( $input['video_id'] ) : 0;
		$video    = new Video( $video_id );
		if ( ! $video->id ) {
			return new \WP_Error( 'not_found', __( 'Video not found.', 'presto-player' ), array( 'status' => 404 ) );
		}
		if ( ! current_user_can( 'edit_others_posts' ) && get_current_user_id() !== (int) ( $video->toArray()['created_by'] ?? 0 ) ) {
			return new \WP_Error( 'forbidden', __( 'You are not allowed to access this video.', 'presto-player' ), array( 'status' => 403 ) );
		}

		$payload = array();
		if ( isset( $input['title'] ) ) {
			$payload['title'] = sanitize_text_field( $input['title'] );
		}
		if ( isset( $input['src'] ) ) {
			// Read the scheme off the raw value, not the escaped one: esc_url_raw()
			// prepends http:// to anything schemeless, so "not a url" was arriving here
			// as http://notaurl and passing — the same trap
			// CreatesReusableVideos::resolveProviderVideoId() documents. And a
			// javascript: URL escapes down to '', which would have quietly blanked the
			// field instead of failing.
			$raw    = is_string( $input['src'] ) ? trim( $input['src'] ) : '';
			$scheme = strtolower( (string) wp_parse_url( $raw, PHP_URL_SCHEME ) );
			$src    = esc_url_raw( $raw );
			if ( '' === $src || ! in_array( $scheme, array( 'http', 'https' ), true ) ) {
				return new \WP_Error( 'invalid_src', __( 'Video source must be an http(s) URL.', 'presto-player' ), array( 'status' => 400 ) );
			}
			$payload['src'] = $src;
		}
		if ( isset( $input['external_id'] ) ) {
			$payload['external_id'] = sanitize_text_field( $input['external_id'] );
		}
		if ( isset( $input['type'] ) ) {
			$payload['type'] = sanitize_text_field( $input['type'] );
		}
		if ( isset( $input['attachment_id'] ) ) {
			$attachment_id = absint( $input['attachment_id'] );
			$attachment    = get_post( $attachment_id );
			if ( empty( $attachment ) || 'attachment' !== $attachment->post_type || ! current_user_can( 'edit_post', $attachment_id ) ) {
				return new \WP_Error( 'invalid_attachment', __( 'Invalid attachment ID.', 'presto-player' ), array( 'status' => 400 ) );
			}
			$payload['attachment_id'] = $attachment_id;
		}

		// Tags live on the post, not on the row, so they are not part of $payload —
		// and a tags-only call must not fall out of the early return below.
		$tags     = isset( $input['tags'] ) && is_array( $input['tags'] ) ? $input['tags'] : null;
		$tag_post = null !== $tags ? $this->findVideoPostId( $video_id, (int) $video->post_id ) : 0;
		// Everything the tag write can refuse is decided here, before the row is
		// touched. Writing the tags first meant a video with no materialized post
		// answered not_materialized having already dropped a valid title, and a row
		// write that failed afterwards reported an error over a tag change that had
		// already landed.
		if ( null !== $tags ) {
			$valid = $this->validateVideoTags( $tag_post, $tags );
			if ( is_wp_error( $valid ) ) {
				return $valid;
			}
		}

		if ( ! empty( $payload ) ) {
			// Never hand the model attachment_id and title together: it renames the
			// Media Library attachment, and Presto derives an attachment-backed
			// video's displayed title from that attachment, so one rename retitled
			// every other video sharing the file. We do the rename ourselves below,
			// only when this video is the file's sole owner.
			if ( isset( $payload['attachment_id'], $payload['title'] ) ) {
				$linked = $video->update( array( 'attachment_id' => $payload['attachment_id'] ) );
				if ( is_wp_error( $linked ) ) {
					return $linked;
				}
				unset( $payload['attachment_id'] );
			}

			$updated = $video->update( $payload );
			if ( is_wp_error( $updated ) ) {
				return $updated;
			}

			if ( isset( $payload['title'] ) ) {
				$this->renameAttachmentIfSoleOwner( $video_id, sanitize_text_field( $payload['title'] ) );
			}
		}

		if ( null !== $tags ) {
			$tagged = $this->setVideoTags( $tag_post, $tags );
			if ( is_wp_error( $tagged ) ) {
				return $tagged;
			}
		}

		// A tags-only call has nothing to re-render, and syncing the block content
		// on the way out would rewrite a post the caller never asked to touch.
		if ( empty( $payload ) ) {
			return $this->withVideoId( $video->toArray() );
		}

		$fresh = new Video( $video_id );
		$this->syncReusableVideoPost( $fresh );

		$result = $this->withVideoId( $fresh->toArray() );
		// Opt-in only: the rename is what people ask for, but the address change
		// that comes with it breaks links they may already have handed out.
		$result['slug'] = ! empty( $input['update_slug'] ) && isset( $payload['title'] )
			? $this->updateVideoSlug( (int) $result['post_id'], $payload['title'] )
			: '';

		return $result;
	}

	/**
	 * Move the URL slug of the video post and its wrapper page onto a new title.
	 *
	 * @param int    $post_id Reusable pp_video_block post ID.
	 * @param string $title   New title.
	 * @return string The slug visitors will see, or '' when nothing was moved.
	 */
	protected function updateVideoSlug( $post_id, $title ) {
		$slug = sanitize_title( $title );
		if ( ! $post_id || '' === $slug || ! get_post( $post_id ) ) {
			return '';
		}
		// Owning the videos row doesn't imply owning the post the slug lives on.
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return '';
		}

		// post_name goes through wp_unique_post_slug(), so two videos named the
		// same get -2 appended rather than one silently stealing the other's URL.
		wp_update_post(
			array(
				'ID'        => $post_id,
				'post_name' => $slug,
			)
		);
		$moved = get_post_field( 'post_name', $post_id );
		$moved = is_string( $moved ) ? $moved : '';

		$page_id = (int) get_post_meta( $post_id, self::$page_meta_key, true );
		if ( $page_id && 'page' === get_post_type( $page_id ) && current_user_can( 'edit_post', $page_id ) ) {
			wp_update_post(
				array(
					'ID'        => $page_id,
					'post_name' => $slug,
				)
			);
			// The page is the URL we handed back as the video's link, so its slug
			// is the one worth reporting.
			$page_slug = get_post_field( 'post_name', $page_id );
			$moved     = is_string( $page_slug ) ? $page_slug : '';
		}

		return $moved;
	}

	/**
	 * Rename the backing Media Library file when this video is its only user.
	 *
	 * Presto shows an attachment-backed video under the attachment's own title,
	 * so a rename that touches only the row is invisible. Renaming the
	 * attachment makes it stick — but only when no other video shares the file,
	 * otherwise the rename leaks into unrelated videos.
	 *
	 * @param int    $video_id Media Hub video being renamed.
	 * @param string $title    New title.
	 * @return void
	 */
	protected function renameAttachmentIfSoleOwner( $video_id, $title ) {
		$attachment_id = (int) ( new Video( (int) $video_id ) )->attachment_id;
		if ( ! $attachment_id || '' === $title ) {
			return;
		}

		global $wpdb;
		$owners = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- ownership count for a single write.
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->prefix}presto_player_videos WHERE attachment_id = %d AND (deleted_at IS NULL OR deleted_at = '0000-00-00 00:00:00')",
				$attachment_id
			)
		);

		if ( 1 !== $owners ) {
			return;
		}

		// Sole owner is about the file, not about permission — the attachment can
		// still belong to someone else, so the object capability has to hold too.
		if ( ! current_user_can( 'edit_post', $attachment_id ) ) {
			return;
		}

		wp_update_post(
			wp_slash(
				array(
					'ID'         => $attachment_id,
					'post_title' => $title,
				)
			)
		);
	}
}

/**
 * Soft-deletes a video by ID.
 */
class DeleteVideoAbility extends Ability {

	/**
	 * {@inheritDoc}
	 */
	public function getName() {
		return 'presto-player/delete-video';
	}

	/**
	 * {@inheritDoc}
	 */
	public function getLabel() {
		return __( 'Delete video', 'presto-player' );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getDescription() {
		return __( 'Trashes a Presto Player video record by ID.', 'presto-player' );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getAnnotations() {
		return array(
			'readonly'    => false,
			'destructive' => true,
			'idempotent'  => true,
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function getInputSchema() {
		return array(
			'type'                 => 'object',
			'additionalProperties' => false,
			'required'             => array( 'video_id' ),
			'properties'           => array(
				'video_id' => array(
					'type'        => 'integer',
					'description' => __( 'Video record ID to delete (a video_id from a create-video-* ability).', 'presto-player' ),
				),
			),
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function getAliases() {
		return array( 'video_id' => array( 'id' ) );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getOutputSchema() {
		return array(
			'type'       => 'object',
			'required'   => array( 'id', 'deleted' ),
			'properties' => array(
				'id'                  => array( 'type' => 'integer' ),
				'video_id'            => array( 'type' => 'integer' ),
				'deleted'             => array( 'type' => 'boolean' ),
				'unpublished'         => array(
					'type'        => 'array',
					'items'       => array( 'type' => 'integer' ),
					'description' => __( 'Post IDs moved to draft so the video stops being reachable — the video post and the page wrapping it. Empty when the post was kept published, or when you cannot edit them.', 'presto-player' ),
				),
				'kept_post_published' => array(
					'type'        => 'boolean',
					'description' => __( 'True when the video row was trashed but its post was deliberately left published, because another live Media Hub video (see shares_post_with) still plays through that post and unpublishing it would have taken that video down too.', 'presto-player' ),
				),
				'shares_post_with'    => array(
					'type'        => 'array',
					'items'       => array( 'type' => 'integer' ),
					'description' => __( 'Other live Media Hub video_ids still pointing at this video\'s post. Normally empty.', 'presto-player' ),
				),
			),
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function checkPermission() {
		return current_user_can( 'delete_posts' );
	}

	/**
	 * {@inheritDoc}
	 *
	 * @param array<string, mixed> $input Validated input.
	 * @return array<string, mixed>|\WP_Error
	 */
	public function execute( array $input ) {
		$video_id = isset( $input['video_id'] ) ? absint( $input['video_id'] ) : 0;
		if ( 0 === $video_id ) {
			return new \WP_Error( 'invalid_id', __( 'A valid video ID is required.', 'presto-player' ), array( 'status' => 400 ) );
		}
		$video = new Video( $video_id );
		if ( ! $video->id ) {
			return new \WP_Error( 'not_found', __( 'Video not found.', 'presto-player' ), array( 'status' => 404 ) );
		}
		// Already trashed — 404 like get-video does, instead of re-stamping deleted_at.
		if ( $this->isSoftDeleted( $video->toArray() ) ) {
			return new \WP_Error( 'not_found', __( 'Video not found.', 'presto-player' ), array( 'status' => 404 ) );
		}
		if ( ! current_user_can( 'delete_others_posts' ) && get_current_user_id() !== (int) ( $video->toArray()['created_by'] ?? 0 ) ) {
			return new \WP_Error( 'forbidden', __( 'You are not allowed to access this video.', 'presto-player' ), array( 'status' => 403 ) );
		}
		$post_id = $this->findVideoPostId( $video_id, (int) $video->post_id );
		// Another live row can point at the same post (#1181). Drafting it then would
		// pull down a video nobody asked to delete, so only the sole owner unpublishes.
		$shared = $post_id ? $this->videoIdsSharingPost( $post_id, $video_id ) : array();

		$trashed = $video->trash();
		if ( is_wp_error( $trashed ) ) {
			return $trashed;
		}

		// Trashing the row alone left the Media Hub entry listed and its page
		// serving HTTP 200, so "remove this video" changed nothing a visitor
		// could see. Unpublish the post and its wrapper page too. Draft rather
		// than delete: this is recoverable, and pp_video_block does not support
		// trash, so a hard delete would be irreversible.
		$unpublished = array();
		if ( $post_id && ! $shared ) {
			$page_id = (int) get_post_meta( $post_id, '_pp_video_page_id', true );
			foreach ( array( $post_id, $page_id ) as $id ) {
				// The videos-row ownership check upstream says nothing about these
				// posts, so each one still has to clear its own object capability.
				if ( $id && 'draft' !== get_post_status( $id ) && get_post( $id ) && current_user_can( 'delete_post', $id ) ) {
					wp_update_post(
						array(
							'ID'          => $id,
							'post_status' => 'draft',
						)
					);
					$unpublished[] = (int) $id;
				}
			}
		}

		return array(
			'id'                  => $video_id,
			'video_id'            => $video_id,
			'deleted'             => true,
			'unpublished'         => $unpublished,
			'kept_post_published' => (bool) ( $post_id && $shared ),
			'shares_post_with'    => $shared,
		);
	}
}

/**
 * Builds the shortcode string for a pp_video_block post.
 */
class GetVideoShortcodeAbility extends Ability {

	/**
	 * {@inheritDoc}
	 */
	public function getName() {
		return 'presto-player/get-video-shortcode';
	}

	/**
	 * {@inheritDoc}
	 */
	public function getLabel() {
		return __( 'Get video shortcode', 'presto-player' );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getDescription() {
		return __( 'Returns the [presto_player id=N] shortcode for a reusable video post. Accepts a media-hub video_id (from a create-video-* ability) or a pp_video_block post_id directly. Paste the shortcode into any post or page to embed the player. Check ambiguous before you paste it: when more than one Media Hub video points at the same post, the shortcode cannot name one of them, and renders_video_id says which one it actually plays.', 'presto-player' );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getAnnotations() {
		return array(
			'readonly'   => true,
			'idempotent' => true,
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function getInputSchema() {
		return array(
			'type'                 => 'object',
			'additionalProperties' => false,
			'properties'           => array(
				'video_id' => array(
					'type'        => 'integer',
					'description' => __( 'The media-hub video_id returned by a create-video-* ability. Resolved to its reusable video post.', 'presto-player' ),
				),
				'post_id'  => array(
					'type'        => 'integer',
					'description' => __( 'The pp_video_block post ID — the N in [presto_player id=N]. Use this when you already have the WordPress post ID instead of a media-hub video_id.', 'presto-player' ),
				),
			),
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function getAliases() {
		return array( 'post_id' => array( 'id' ) );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getOutputSchema() {
		return array(
			'type'       => 'object',
			'required'   => array( 'id', 'shortcode' ),
			'properties' => array(
				'id'               => array( 'type' => 'integer' ),
				'post_id'          => array( 'type' => 'integer' ),
				'shortcode'        => array( 'type' => 'string' ),
				'ambiguous'        => array(
					'type'        => 'boolean',
					'description' => __( 'True when more than one live Media Hub video points at this post, so the shortcode cannot identify one of them on its own.', 'presto-player' ),
				),
				'shares_post_with' => array(
					'type'        => 'array',
					'items'       => array( 'type' => 'integer' ),
					'description' => __( 'The other live Media Hub video_ids pointing at this post. Normally empty.', 'presto-player' ),
				),
				'renders_video_id' => array(
					'type'        => 'integer',
					'description' => __( 'The Media Hub video the shortcode really plays, read from the post\'s player block. When this differs from the video_id you asked for, this shortcode embeds a different video. 0 when the block does not record one.', 'presto-player' ),
				),
			),
		);
	}

	/**
	 * {@inheritDoc}
	 */
	public function checkPermission() {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * {@inheritDoc}
	 *
	 * @param array<string, mixed> $input Validated input.
	 * @return array<string, mixed>|\WP_Error
	 */
	public function execute( array $input ) {
		$target = $this->resolveVideoTarget( $input );
		if ( is_wp_error( $target ) ) {
			return $target;
		}
		$post_id  = $target['post_id'];
		$video_id = $target['video_id'];
		if ( 0 === $post_id ) {
			return new \WP_Error( 'invalid_id', __( 'A valid video_id or post_id is required.', 'presto-player' ), array( 'status' => 400 ) );
		}
		$post = get_post( $post_id );
		if ( ! $post || 'pp_video_block' !== $post->post_type ) {
			return new \WP_Error( 'not_found', __( 'Presto Player video not found.', 'presto-player' ), array( 'status' => 404 ) );
		}
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return new \WP_Error( 'forbidden', __( 'You are not allowed to access this video.', 'presto-player' ), array( 'status' => 403 ) );
		}

		// The shortcode names a post, and a post can be claimed by more than one
		// Media Hub row — so hand back who else claims it and which video the player
		// block in there actually renders, rather than an id that looks unique.
		$shared    = $this->otherVideosOnPost( $post_id, $video_id );
		$block_ids = $this->videoBlockIds( $post->post_content );

		return array(
			'id'               => $post_id,
			'post_id'          => $post_id,
			'shortcode'        => '[presto_player id=' . $post_id . ']',
			'ambiguous'        => ! empty( $shared ),
			'shares_post_with' => $shared,
			'renders_video_id' => $block_ids ? (int) $block_ids[0] : 0,
		);
	}
}
