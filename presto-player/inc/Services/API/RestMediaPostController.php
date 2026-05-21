<?php
/**
 * REST API Controller for Media Hub operations.
 *
 * Handles the duplicate-media endpoint which has no native WordPress REST API equivalent.
 * All other Media Hub operations (update settings, delete, status changes) use the native
 * WP REST API via WP_REST_Posts_Controller at /wp/v2/presto-videos/{id}.
 *
 * @package PrestoPlayer
 * @subpackage Services\API
 */

namespace PrestoPlayer\Services\API;

use PrestoPlayer\Models\ReusableVideo;

/**
 * REST API Controller for Media Hub duplicate operation.
 */
class RestMediaPostController extends \WP_REST_Controller {

	/**
	 * Our namespace
	 *
	 * @var string
	 */
	protected $namespace = 'presto-player';

	/**
	 * API Version
	 *
	 * @var string
	 */
	protected $version = 'v1';

	/**
	 * Endpoint base
	 *
	 * @var string
	 */
	protected $base = 'media-hub';

	/**
	 * Register controller
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Register media hub routes
	 *
	 * @return void
	 */
	public function register_routes() {
		// Duplicate media endpoint for Media Hub actions.
		register_rest_route(
			"{$this->namespace}/{$this->version}",
			'/duplicate-media',
			array(
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'duplicate_media' ),
					'permission_callback' => array( $this, 'update_item_permissions_check' ),
					'args'                => array(
						'media_id' => array(
							'type'              => 'integer',
							'required'          => true,
							'minimum'           => 1,
							'sanitize_callback' => 'absint',
							// Belt for PHP 8: string-to-int comparison won't catch a non-numeric
							// `media_id`, so reject explicitly rather than letting absint coerce
							// to 0 and fall through to a misleading 404.
							'validate_callback' => function ( $value ) {
								return is_numeric( $value ) && (int) $value >= 1;
							},
						),
					),
				),
			)
		);
	}

	/**
	 * Permission check for the duplicate-media route.
	 *
	 * Authorization is unified here so the framework rejects unauthorized requests
	 * before reaching the handler:
	 *   - `upload_files` is the baseline cap for Media Hub access.
	 *   - The per-item `edit_post` cap is checked when the target post exists,
	 *     so users with `upload_files` but no rights on the specific item are
	 *     refused at the REST gate, not after the handler runs.
	 * Non-existent IDs intentionally fall through to the handler so it can return
	 * a 404 rather than masking existence behind a 403.
	 *
	 * @param \WP_REST_Request $request Full data about the request.
	 * @return bool
	 */
	public function update_item_permissions_check( $request ) {
		if ( ! current_user_can( 'upload_files' ) ) {
			return false;
		}

		$media_id = absint( $request->get_param( 'media_id' ) );
		if ( $media_id && get_post( $media_id ) && ! current_user_can( 'edit_post', $media_id ) ) {
			return false;
		}

		return true;
	}

	/**
	 * Duplicate a media item (pp_video_block post).
	 *
	 * This endpoint is used by the React Media Hub UI when the user selects
	 * the "Duplicate" action for a media item. It creates a new draft post
	 * that is a copy of the original, including taxonomies and post meta.
	 *
	 * Authorization (upload_files + edit_post) is enforced in
	 * `update_item_permissions_check`; missing/invalid `media_id` is rejected by
	 * the args schema before this callback runs.
	 *
	 * @param \WP_REST_Request $request Full data about the request.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function duplicate_media( $request ) {
		$media_id = absint( $request->get_param( 'media_id' ) );

		// Get model instance.
		$reusable_video = new ReusableVideo( $media_id );

		if ( ! $reusable_video->post || 'pp_video_block' !== $reusable_video->post->post_type ) {
			return new \WP_Error(
				'media_not_found',
				__( 'Media not found.', 'presto-player' ),
				array( 'status' => 404 )
			);
		}

		// Duplicate via model.
		$duplication_result = $reusable_video->duplicate();

		if ( is_wp_error( $duplication_result ) ) {
			return new \WP_Error(
				'duplication_failed',
				$duplication_result->get_error_message(),
				array( 'status' => 500 )
			);
		}

		$new_post_id  = $duplication_result['new_post_id'];
		$thumbnail_id = $duplication_result['thumbnail_id'];

		// Build response via model.
		$response_data = $reusable_video->buildDuplicateResponse( $new_post_id, $thumbnail_id );

		return new \WP_REST_Response(
			array(
				'success' => true,
				'data'    => $response_data,
			),
			201
		);
	}
}
