<?php
/**
 * REST API Controller for Email Submissions (dashboard Emails tab).
 *
 * Pro-only; uses pp_email_submission when Pro active.
 *
 * @package PrestoPlayer
 * @subpackage Services\API
 */

namespace PrestoPlayer\Services\API;

use PrestoPlayer\Models\AudioPreset;
use PrestoPlayer\Models\Preset;
use PrestoPlayer\Models\Video;

/**
 * REST API Controller for Email Submissions.
 */
class RestEmailSubmissionsController extends \WP_REST_Controller {

	/**
	 * Pro post type slug.
	 */
	const PRO_POST_TYPE = 'pp_email_submission';

	/**
	 * Cron hook name for cleaning old trashed email submissions.
	 */
	const CRON_CLEANUP_TRASH = 'presto_player_cleanup_email_submission_trash';

	/**
	 * Allowed post_status values for create/update (avoids arbitrary status).
	 */
	const ALLOWED_STATUSES = array( 'publish', 'draft', 'pending', 'private', 'future' );

	/**
	 * Min/max Unix timestamp for date param (avoid extreme dates).
	 * DATE_MAX uses PHP_INT_MAX so the bound is platform-appropriate (32-bit safe on 32-bit PHP).
	 */
	const DATE_MIN = 0;
	const DATE_MAX = PHP_INT_MAX;

	/**
	 * Pagination cap for get_items. Bounds per-request memory + N+1 video/preset lookups in
	 * format_post_to_item() so a single admin call cannot exhaust PHP memory or amplify a
	 * stolen-session into a one-shot PII bulk-exfil.
	 */
	const MAX_PER_PAGE     = 100;
	const DEFAULT_PER_PAGE = 100;

	/**
	 * Hard cap on the number of IDs accepted by delete_items in a single request.
	 * Prevents DoS amplification via deletion hooks and bounds blast radius if an admin
	 * session is stolen.
	 */
	const MAX_DELETE_IDS = 500;

	/**
	 * REST API namespace.
	 *
	 * @var string
	 */
	protected $namespace = 'presto-player';

	/**
	 * REST API version.
	 *
	 * @var string
	 */
	protected $version = 'v1';

	/**
	 * REST API base route.
	 *
	 * @var string
	 */
	protected $base = 'email-submissions';

	/**
	 * Register REST API hooks and cron.
	 */
	public function register() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
		add_action( 'init', array( $this, 'maybe_schedule_trash_cleanup' ) );
		add_action( self::CRON_CLEANUP_TRASH, array( $this, 'cleanup_old_trash' ) );
	}

	/**
	 * Schedule daily cron to permanently delete trashed submissions older than 1 month.
	 */
	public function maybe_schedule_trash_cleanup() {
		if ( ! post_type_exists( self::PRO_POST_TYPE ) ) {
			return;
		}
		if ( ! wp_next_scheduled( self::CRON_CLEANUP_TRASH ) ) {
			wp_schedule_event( time(), 'daily', self::CRON_CLEANUP_TRASH );
		}
	}

	/**
	 * Permanently delete email submissions that have been in trash for more than 1 month.
	 * Processes in batches to avoid memory issues with large datasets.
	 */
	public function cleanup_old_trash() {
		if ( ! post_type_exists( self::PRO_POST_TYPE ) ) {
			return;
		}
		$batch_size    = 200;
		$max_batches   = 50; // ~10k posts/run cap so a misbehaving wp_delete_post can't spin forever.
		$last_first_id = 0;
		$date_query    = array(
			array(
				'column' => 'post_modified_gmt',
				'before' => '1 month ago',
			),
		);
		do {
			$posts      = get_posts(
				array(
					'post_type'      => self::PRO_POST_TYPE,
					'post_status'    => 'trash',
					'posts_per_page' => $batch_size,
					'date_query'     => $date_query,
					'fields'         => 'ids',
				)
			);
			$post_count = count( $posts );
			if ( 0 === $post_count ) {
				break;
			}
			// Same first ID as last iteration means none of the previous batch
			// was actually deleted (filter veto, FS error). Bail to prevent a
			// cron-wedging infinite loop.
			if ( $posts[0] === $last_first_id ) {
				break;
			}
			$last_first_id = $posts[0];
			foreach ( $posts as $post_id ) {
				wp_delete_post( $post_id, true );
			}
		} while ( $post_count === $batch_size && --$max_batches > 0 );
	}

	/**
	 * Register REST API routes.
	 */
	public function register_routes() {
		$permission = array( $this, 'permission_check' );

		register_rest_route(
			$this->namespace . '/' . $this->version,
			'/' . $this->base,
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_items' ),
					'permission_callback' => $permission,
					'args'                => $this->get_list_args(),
				),
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'create_item' ),
					'permission_callback' => $permission,
					'args'                => $this->get_create_args(),
				),
			)
		);

		register_rest_route(
			$this->namespace . '/' . $this->version,
			'/' . $this->base . '/(?P<id>[\d]+)',
			array(
				array(
					'methods'             => \WP_REST_Server::EDITABLE,
					'callback'            => array( $this, 'update_item' ),
					'permission_callback' => $permission,
					'args'                => $this->get_update_args(),
				),
			)
		);

		register_rest_route(
			$this->namespace . '/' . $this->version,
			'/' . $this->base . '/delete',
			array(
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'delete_items' ),
					'permission_callback' => $permission,
					'args'                => array(
						'ids'       => array(
							'required'          => true,
							'type'              => 'array',
							'items'             => array( 'type' => 'integer' ),
							'sanitize_callback' => function ( $ids ) {
								return array_filter( array_map( 'absint', (array) $ids ) );
							},
						),
						'permanent' => array(
							'type'    => 'boolean',
							'default' => false,
						),
					),
				),
			)
		);
	}

	/**
	 * Single permission check for all email submission endpoints.
	 *
	 * Uses manage_options so only administrators can list/create/update/delete
	 * email submissions (aligns with Pro's Email Submissions menu). Prevents
	 * users with only upload_files (e.g. editors) from accessing PII.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return bool
	 */
	public function permission_check( $request ) {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Get email submissions (paginated).
	 *
	 * Responses include X-WP-Total / X-WP-TotalPages so the React client can walk
	 * pages instead of pulling every record at once. per_page is hard-capped at
	 * MAX_PER_PAGE to bound memory + N+1 video/preset lookups per request.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response
	 */
	public function get_items( $request ) {
		$per_page = absint( $request->get_param( 'per_page' ) );
		if ( $per_page < 1 ) {
			$per_page = self::DEFAULT_PER_PAGE;
		}
		if ( $per_page > self::MAX_PER_PAGE ) {
			$per_page = self::MAX_PER_PAGE;
		}
		$page = absint( $request->get_param( 'page' ) );
		if ( $page < 1 ) {
			$page = 1;
		}

		if ( ! post_type_exists( self::PRO_POST_TYPE ) ) {
			$response = rest_ensure_response( array() );
			$response->header( 'X-WP-Total', '0' );
			$response->header( 'X-WP-TotalPages', '0' );
			return $response;
		}

		$query = new \WP_Query(
			array(
				'post_type'      => self::PRO_POST_TYPE,
				'post_status'    => array( 'publish', 'draft', 'pending', 'private', 'future', 'trash' ),
				'posts_per_page' => $per_page,
				'paged'          => $page,
				'orderby'        => 'date',
				'order'          => 'DESC',
			)
		);

		$items       = array_map( array( $this, 'format_post_to_item' ), $query->posts );
		$total       = (int) $query->found_posts;
		$total_pages = $per_page > 0 ? (int) ceil( $total / $per_page ) : 0;

		$response = rest_ensure_response( $items );
		$response->header( 'X-WP-Total', (string) $total );
		$response->header( 'X-WP-TotalPages', (string) $total_pages );
		return $response;
	}

	/**
	 * Format pp_email_submission post to API item.
	 *
	 * Password protection was removed; visibility is derived from post_status only
	 * (private => 'private', otherwise 'public'). video_title and preset_name are
	 * output-only (computed from meta); they are not accepted as request params.
	 *
	 * @param \WP_Post $post Post object.
	 * @return array
	 */
	private function format_post_to_item( $post ) {
		$video_id   = (int) get_post_meta( $post->ID, 'video_id', true );
		$preset_id  = (int) get_post_meta( $post->ID, 'preset_id', true );
		$email      = get_post_meta( $post->ID, 'email', true );
		$status     = ! empty( $post->post_status ) ? $post->post_status : 'publish';
		$visibility = ( 'private' === $status ) ? 'private' : 'public';

		return array(
			'id'          => (int) $post->ID,
			'email'       => is_string( $email ) ? $email : '',
			'status'      => $status,
			'visibility'  => $visibility,
			'date'        => ! empty( $post->post_date_gmt ) ? gmdate( 'Y-m-d\TH:i:s', strtotime( $post->post_date_gmt ) ) . '.000Z' : '',
			'video_title' => $this->get_video_title( $video_id ),
			'preset_name' => $this->get_preset_name( $preset_id ),
		);
	}

	/**
	 * Get video title by ID from the presto_player_videos table.
	 *
	 * Mirrors the same logic used in the Pro admin column
	 * (EmailCollectionMetaBox::content 'video' case).
	 *
	 * @param int $video_id Row ID in presto_player_videos.
	 * @return string
	 */
	private function get_video_title( $video_id ) {
		if ( ! $video_id ) {
			return '';
		}
		return trim( ( new Video( $video_id ) )->getTitle() );
	}

	/**
	 * Get preset name by ID.
	 *
	 * Tries video Preset first; falls back to AudioPreset since both
	 * support email_collection. Mirrors the Pro admin column pattern.
	 *
	 * @param int $preset_id Preset ID.
	 * @return string
	 */
	private function get_preset_name( $preset_id ) {
		if ( ! $preset_id ) {
			return '';
		}

		$name = ( new Preset( $preset_id ) )->getName();
		if ( '' !== $name ) {
			return $name;
		}

		return ( new AudioPreset( $preset_id ) )->getName();
	}

	/**
	 * Create an email submission.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function create_item( $request ) {
		if ( ! post_type_exists( self::PRO_POST_TYPE ) ) {
			return $this->pro_required_error();
		}
		// Sanitize and validate email (WordPress standard); reject invalid to protect PII storage.
		$email = sanitize_email( $request->get_param( 'email' ) );
		if ( ! is_email( $email ) ) {
			return new \WP_Error( 'invalid_email', __( 'Invalid email address.', 'presto-player' ), array( 'status' => 400 ) );
		}
		$status_raw = $request->get_param( 'status' );
		$status     = in_array( $status_raw, self::ALLOWED_STATUSES, true ) ? $status_raw : 'publish';
		$date_param = $request->get_param( 'date' );
		$post_date  = current_time( 'mysql' );
		$post_gmt   = current_time( 'mysql', true );
		if ( ! empty( $date_param ) && is_string( $date_param ) ) {
			$ts = strtotime( $date_param );
			if ( false !== $ts && $ts >= self::DATE_MIN && $ts <= self::DATE_MAX ) {
				$post_date = gmdate( 'Y-m-d H:i:s', $ts );
				$post_gmt  = $post_date;
			}
		}
		$status  = $this->maybe_promote_to_future( $status, $post_gmt );
		$post_id = wp_insert_post(
			array(
				'post_type'     => self::PRO_POST_TYPE,
				'post_status'   => $status,
				'post_date'     => $post_date,
				'post_date_gmt' => $post_gmt,
				'meta_input'    => array(
					'email'     => $email,
					'firstname' => '',
					'lastname'  => '',
					'video_id'  => 0,
					'preset_id' => 0,
				),
			),
			true
		);
		if ( is_wp_error( $post_id ) ) {
			return new \WP_Error( 'db_error', $post_id->get_error_message(), array( 'status' => 500 ) );
		}
		return rest_ensure_response( $this->format_post_to_item( get_post( $post_id ) ) );
	}

	/**
	 * Update an email submission.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function update_item( $request ) {
		if ( ! post_type_exists( self::PRO_POST_TYPE ) ) {
			return $this->pro_required_error();
		}
		$id   = (int) $request->get_param( 'id' );
		$post = get_post( $id );
		if ( ! $post || self::PRO_POST_TYPE !== $post->post_type ) {
			return new \WP_Error( 'not_found', __( 'Email submission not found.', 'presto-player' ), array( 'status' => 404 ) );
		}
		$update = array( 'ID' => $id );
		if ( $request->has_param( 'status' ) ) {
			$status_raw = $request->get_param( 'status' );
			if ( in_array( $status_raw, self::ALLOWED_STATUSES, true ) ) {
				$update['post_status'] = $status_raw;
			}
		}
		if ( $request->has_param( 'date' ) ) {
			$date_param = $request->get_param( 'date' );
			if ( ! empty( $date_param ) && is_string( $date_param ) ) {
				$ts = strtotime( $date_param );
				if ( false !== $ts && $ts >= self::DATE_MIN && $ts <= self::DATE_MAX ) {
					$update['post_date']     = gmdate( 'Y-m-d H:i:s', $ts );
					$update['post_date_gmt'] = gmdate( 'Y-m-d H:i:s', $ts );
					// edit_date=true overrides wp_update_post's "drafts get a fresh
					// date on transition" rule (see wp-includes/post.php). Without
					// this, scheduling a draft submission silently resets the date
					// to current_time() and the future-status promotion misfires.
					$update['edit_date'] = true;
				}
			}
		}
		$final_status   = $update['post_status'] ?? $post->post_status;
		$final_date_gmt = $update['post_date_gmt'] ?? $post->post_date_gmt;
		$promoted       = $this->maybe_promote_to_future( $final_status, $final_date_gmt );
		if ( $promoted !== $final_status ) {
			$update['post_status'] = $promoted;
		}
		if ( count( $update ) > 1 ) {
			wp_update_post( $update );
		}
		if ( $request->has_param( 'email' ) ) {
			// Sanitize and validate email (WordPress standard) before updating.
			$email = sanitize_email( $request->get_param( 'email' ) );
			if ( is_email( $email ) ) {
				update_post_meta( $id, 'email', $email );
			}
		}
		return rest_ensure_response( $this->format_post_to_item( get_post( $id ) ) );
	}

	/**
	 * Delete email submissions (trash by default; permanent=true to force-delete).
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function delete_items( $request ) {
		$ids       = $request->get_param( 'ids' );
		$permanent = (bool) $request->get_param( 'permanent' );
		if ( ! is_array( $ids ) || empty( $ids ) ) {
			return new \WP_Error( 'invalid_param', __( 'IDs are required.', 'presto-player' ), array( 'status' => 400 ) );
		}
		if ( count( $ids ) > self::MAX_DELETE_IDS ) {
			return new \WP_Error(
				'too_many_ids',
				sprintf(
					/* translators: %d: maximum number of IDs allowed per delete request */
					__( 'Too many IDs in a single request. Maximum %d.', 'presto-player' ),
					self::MAX_DELETE_IDS
				),
				array( 'status' => 400 )
			);
		}
		if ( ! post_type_exists( self::PRO_POST_TYPE ) ) {
			return $this->pro_required_error();
		}
		$deleted = 0;
		foreach ( $ids as $post_id ) {
			$post = get_post( $post_id );
			if ( ! $post || self::PRO_POST_TYPE !== $post->post_type ) {
				continue;
			}
			if ( $permanent ) {
				if ( wp_delete_post( $post_id, true ) ) {
					++$deleted;
				}
			} elseif ( wp_trash_post( $post_id ) ) {
				++$deleted;
			}
		}
		return rest_ensure_response(
			array(
				'success' => true,
				'deleted' => $deleted,
			)
		);
	}

	/**
	 * Args for the list endpoint. per_page is clamped server-side in get_items, but
	 * declaring schema bounds also lets the REST framework reject obvious abuse.
	 *
	 * @return array
	 */
	public function get_list_args() {
		return array(
			'page'     => array(
				'type'    => 'integer',
				'minimum' => 1,
				'default' => 1,
			),
			'per_page' => array(
				'type'    => 'integer',
				'minimum' => 1,
				'maximum' => self::MAX_PER_PAGE,
				'default' => self::DEFAULT_PER_PAGE,
			),
		);
	}

	/**
	 * Args for create request.
	 *
	 * @return array
	 */
	public function get_create_args() {
		return array_merge(
			array(
				'email' => array(
					'required' => true,
					'type'     => 'string',
				),
			),
			$this->get_shared_item_args()
		);
	}

	/**
	 * Args for update request.
	 *
	 * @return array
	 */
	public function get_update_args() {
		return array_merge(
			array(
				'id' => array(
					'required' => true,
					'type'     => 'integer',
				),
			),
			$this->get_shared_item_args()
		);
	}

	/**
	 * Shared request args for create/update.
	 *
	 * @return array
	 */
	private function get_shared_item_args() {
		return array(
			'status'     => array( 'type' => 'string' ),
			'visibility' => array( 'type' => 'string' ),
			'date'       => array( 'type' => 'string' ),
		);
	}

	/**
	 * Promote 'publish' to 'future' when post_date_gmt is in the future.
	 *
	 * Mirrors WP core's wp_insert_post() / WP_REST_Posts_Controller behavior.
	 * Without this, a future-dated submission would land as 'publish' and the
	 * publish_future_post cron would never fire to flip it live on schedule.
	 *
	 * @param string $status        Post status (already validated against ALLOWED_STATUSES).
	 * @param string $post_date_gmt Post date in MySQL format (GMT).
	 * @return string 'future' when applicable, otherwise the original status.
	 */
	private function maybe_promote_to_future( $status, $post_date_gmt ) {
		if ( 'publish' !== $status ) {
			return $status;
		}
		// Both inputs are fixed-width MySQL GMT (Y-m-d H:i:s); lex compare is correct and avoids strtotime overhead.
		if ( $post_date_gmt > current_time( 'mysql', true ) ) {
			return 'future';
		}
		return $status;
	}

	/**
	 * Pro required error response.
	 *
	 * @return \WP_Error
	 */
	private function pro_required_error() {
		return new \WP_Error(
			'pro_required',
			__( 'Presto Player Pro is required for email submissions.', 'presto-player' ),
			array( 'status' => 403 )
		);
	}
}
