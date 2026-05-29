<?php
/**
 * REST API controller for the Media Hub list view.
 *
 * Lightweight, server-paginated replacement for `/wp/v2/presto-videos` for the
 * dashboard table — returns only the fields the list row needs and skips
 * `ReusableVideo::getAttributes()` so cost stays constant-time per request.
 *
 * @package PrestoPlayer
 * @subpackage Services\API
 */

namespace PrestoPlayer\Services\API;

use WP_Error;
use WP_Post;
use WP_Query;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * Dedicated lightweight list endpoint for the Media Hub dashboard table.
 */
class RestMediaListController extends \WP_REST_Controller {

	/**
	 * Namespace.
	 *
	 * @var string
	 */
	protected $namespace = 'presto-player';

	/**
	 * Version.
	 *
	 * @var string
	 */
	protected $version = 'v1';

	/**
	 * Endpoint base.
	 *
	 * @var string
	 */
	protected $base = 'media-list';

	/**
	 * Post type managed by this endpoint.
	 *
	 * @var string
	 */
	protected $post_type = 'pp_video_block';

	/**
	 * Taxonomy used to tag media items.
	 *
	 * @var string
	 */
	protected $taxonomy = 'pp_video_tag';

	/**
	 * Whitelisted post statuses the list view exposes.
	 *
	 * @var string[]
	 */
	protected $allowed_statuses = array( 'publish', 'draft', 'pending', 'private', 'future', 'trash' );

	/**
	 * Whitelisted orderby values. WP_Query accepts more keys, but we expose
	 * only what the UI offers so callers can't ask the DB to order by a key
	 * that lacks an index (e.g. a serialized meta_value).
	 *
	 * @var string[]
	 */
	protected $allowed_orderby = array( 'date', 'modified', 'title' );

	/**
	 * Register controller.
	 *
	 * @return void
	 */
	public function register() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Register the list route.
	 *
	 * @return void
	 */
	public function register_routes() {
		register_rest_route(
			"{$this->namespace}/{$this->version}",
			'/' . $this->base,
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_items' ),
					'permission_callback' => array( $this, 'get_items_permissions_check' ),
					'args'                => $this->get_collection_params(),
				),
			)
		);
	}

	/**
	 * Collection params with sanitization + validation.
	 *
	 * Mirrors the conservative argument schema of RestMediaPostController:
	 * sanitize aggressively and validate against whitelists so callers can't
	 * smuggle unexpected query vars into the underlying WP_Query.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public function get_collection_params() {
		return array(
			'search'   => array(
				'type'              => 'string',
				'default'           => '',
				'sanitize_callback' => 'sanitize_text_field',
			),
			'status'   => array(
				'type'              => 'string',
				'default'           => 'publish,draft,pending,private,future',
				'sanitize_callback' => 'sanitize_text_field',
			),
			'tag'      => array(
				'type'              => 'integer',
				'default'           => 0,
				'minimum'           => 0,
				'sanitize_callback' => 'absint',
			),
			'orderby'  => array(
				'type'              => 'string',
				'default'           => 'date',
				'enum'              => $this->allowed_orderby,
				'sanitize_callback' => 'sanitize_key',
			),
			'order'    => array(
				'type'              => 'string',
				'default'           => 'desc',
				'enum'              => array( 'asc', 'desc' ),
				'sanitize_callback' => 'sanitize_key',
			),
			'page'     => array(
				'type'              => 'integer',
				'default'           => 1,
				'minimum'           => 1,
				'sanitize_callback' => 'absint',
			),
			'per_page' => array(
				'type'              => 'integer',
				'default'           => 25,
				'minimum'           => 1,
				'maximum'           => 100,
				'sanitize_callback' => 'absint',
			),
		);
	}

	/**
	 * Permission check.
	 *
	 * Any user who can edit `pp_video_block` posts may read the list — the
	 * same cap the dashboard menu requires. Per-user visibility of non-public
	 * statuses (private / draft / pending / future) is enforced inside the
	 * WP_Query itself via `'perm' => 'readable'`, so we don't duplicate that
	 * logic here.
	 *
	 * @param WP_REST_Request $request Request (unused — cap is endpoint-wide).
	 * @return bool
	 */
	public function get_items_permissions_check( $request ) {
		unset( $request );
		$pt  = get_post_type_object( $this->post_type );
		$cap = $pt && isset( $pt->cap->edit_posts ) ? $pt->cap->edit_posts : 'edit_posts';
		return current_user_can( $cap );
	}

	/**
	 * GET /presto-player/v1/media-list
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_items( $request ) {
		$statuses = $this->parse_statuses( (string) $request->get_param( 'status' ) );
		if ( empty( $statuses ) ) {
			return new WP_Error(
				'rest_invalid_status',
				__( 'No valid post statuses provided.', 'presto-player' ),
				array( 'status' => 400 )
			);
		}

		$page     = max( 1, (int) $request->get_param( 'page' ) );
		$per_page = max( 1, min( 100, (int) $request->get_param( 'per_page' ) ) );
		$orderby  = in_array( $request->get_param( 'orderby' ), $this->allowed_orderby, true ) ? $request->get_param( 'orderby' ) : 'date';
		$order    = 'asc' === strtolower( (string) $request->get_param( 'order' ) ) ? 'ASC' : 'DESC';
		$tag_id   = (int) $request->get_param( 'tag' );
		$search   = (string) $request->get_param( 'search' );

		$query_args = array(
			'post_type'           => $this->post_type,
			'post_status'         => $statuses,
			'posts_per_page'      => $per_page,
			'paged'               => $page,
			'orderby'             => $orderby,
			'order'               => $order,
			// `readable` scopes `private` to the current user; the author arg
			// below covers draft/pending/future (which `readable` doesn't).
			'perm'                => 'readable',
			// We need the total for pagination headers.
			'no_found_rows'       => false,
			// CPT query — sticky-post hoist only fires for post_type=post anyway.
			'ignore_sticky_posts' => true,
		);

		// Scope to the user's own posts when they lack edit_others_posts —
		// covers draft/pending/future, which `'perm' => 'readable'` (above) doesn't.
		// Mirrors VideoPostType::limitMediaHubPosts() so REST matches wp-admin.
		if ( ! current_user_can( 'edit_others_posts' ) ) {
			$query_args['author'] = get_current_user_id();
		}

		if ( '' !== $search ) {
			$query_args['s'] = $search;
		}

		if ( $tag_id > 0 ) {
			$query_args['tax_query'] = array(
				array(
					'taxonomy' => $this->taxonomy,
					'field'    => 'term_id',
					'terms'    => array( $tag_id ),
				),
			);
		}

		$query = new WP_Query( $query_args );

		$items = array();
		foreach ( $query->posts as $post ) {
			if ( ! $post instanceof WP_Post ) {
				continue;
			}
			$items[] = $this->build_item( $post );
		}

		$response = new WP_REST_Response(
			array(
				'items'       => $items,
				'total'       => (int) $query->found_posts,
				'total_pages' => (int) $query->max_num_pages,
				'page'        => $page,
				'per_page'    => $per_page,
				'counts'      => $this->get_status_counts(),
				'all_tags'    => $this->get_all_tags(),
			)
		);

		// Mirror native WP REST conventions so generic paginated-list clients
		// (and our own hook reading X-WP-* headers) keep working.
		$response->header( 'X-WP-Total', (string) (int) $query->found_posts );
		$response->header( 'X-WP-TotalPages', (string) (int) $query->max_num_pages );

		return $response;
	}

	/**
	 * Build the per-row payload for a single post.
	 *
	 * Matches the classic edit.php list table approach (see
	 * VideoPostType::renderTitleWithPosterColumn): poster resolution flows
	 * through `get_the_post_thumbnail_url()` → `post_thumbnail_id` filter,
	 * where VideoPostType::attachPoster bridges the block's poster attribute
	 * to its WP attachment. One `parse_blocks` per row covers every poster
	 * source the dashboard renders, with no controller-side block introspection.
	 *
	 * @param WP_Post $post Post.
	 * @return array<string, mixed>
	 */
	protected function build_item( WP_Post $post ) {
		$tags  = array();
		$terms = get_the_terms( $post, $this->taxonomy );
		if ( is_array( $terms ) ) {
			foreach ( $terms as $term ) {
				$tags[] = array(
					'id'   => (int) $term->term_id,
					'name' => $term->name,
					'slug' => $term->slug,
				);
			}
		}

		$author_id   = (int) $post->post_author;
		$author_name = $author_id ? (string) get_the_author_meta( 'display_name', $author_id ) : '';

		// `get_the_title()` runs the `the_title` filter which falls back to the
		// inner block's title when post_title is empty. Cost is bounded — for
		// posts that already have a stored title the filter short-circuits.
		$title = html_entity_decode( get_the_title( $post ), ENT_QUOTES, 'UTF-8' );
		$title = $this->strip_status_title_prefix( $title );

		$item = array(
			'id'        => (int) $post->ID,
			'title'     => $title,
			'status'    => $post->post_status,
			'date'      => mysql_to_rfc3339( $post->post_date ),
			'modified'  => mysql_to_rfc3339( $post->post_modified ),
			'post_name' => $post->post_name,
			'shortcode' => '[presto_player id=' . (int) $post->ID . ']',
			'poster'    => (string) get_the_post_thumbnail_url( $post, 'medium' ),
			'author'    => array(
				'id'   => $author_id,
				'name' => $author_name,
			),
			'tags'      => $tags,
			'link'      => (string) get_permalink( $post ),
		);

		// Per-item gate, matches WP REST `context=edit`.
		if ( current_user_can( 'edit_post', $post->ID ) ) {
			$item['post_password'] = (string) $post->post_password;
		}

		return $item;
	}

	/**
	 * Parse the comma-separated `status` request param into a validated
	 * whitelist. Anything outside `$allowed_statuses` is silently dropped so a
	 * crafted request can't reach unintended post statuses.
	 *
	 * Case-folds inputs so `?status=Publish` is accepted (consistent with how
	 * the rest of WP REST treats status slugs).
	 *
	 * @param string $raw Raw value from the request.
	 * @return string[] Validated, deduplicated status slugs.
	 */
	protected function parse_statuses( $raw ) {
		if ( '' === $raw ) {
			return array();
		}
		$parts = array_filter( array_map( 'trim', explode( ',', $raw ) ) );
		$parts = array_map( 'strtolower', $parts );
		$parts = array_intersect( $parts, $this->allowed_statuses );
		return array_values( array_unique( $parts ) );
	}

	/**
	 * Strip WP's `protected_title_format` / `private_title_format` prefix from
	 * a rendered title. WordPress prepends "Protected: " / "Private: " (or
	 * their translations) on those statuses; the dashboard renders status as
	 * a separate badge, so this prefix is redundant and would compound when
	 * round-tripped through PostSettings save.
	 *
	 * Mirrors `stripWpTitlePrefix` in `useMedia.ts`.
	 *
	 * @param string $title Rendered title.
	 * @return string
	 */
	protected function strip_status_title_prefix( $title ) {
		// These strings come from WP core; the explicit `default` domain
		// (a) satisfies WordPress.WP.I18n.MissingArgDomain in PHPCS and
		// (b) keeps `yarn makepot` from scraping them into presto-player.pot.
		/* translators: %s: post title (WP core string, default domain). */
		$protected_prefix = trim( str_replace( '%s', '', __( 'Protected: %s', 'default' ) ) );
		/* translators: %s: post title (WP core string, default domain). */
		$private_prefix = trim( str_replace( '%s', '', __( 'Private: %s', 'default' ) ) );

		foreach ( array( $protected_prefix, $private_prefix ) as $prefix ) {
			if ( '' !== $prefix && 0 === strpos( $title, $prefix ) ) {
				return ltrim( substr( $title, strlen( $prefix ) ) );
			}
		}
		return $title;
	}

	/**
	 * Status counts across the library — drives the per-status badges on the
	 * filter dropdown. Returns only the statuses the UI exposes.
	 *
	 * Passing `'readable'` tells WordPress to scope counts to posts the
	 * current user can read: for a user without `read_private_<post_type>`,
	 * the `private` count drops to their own private posts only. Without
	 * this, a low-cap user sees site-wide private/draft totals on the badges.
	 *
	 * @return array<string, int>
	 */
	protected function get_status_counts() {
		$raw    = wp_count_posts( $this->post_type, 'readable' );
		$counts = array();
		foreach ( $this->allowed_statuses as $status ) {
			$counts[ $status ] = isset( $raw->{$status} ) ? (int) $raw->{$status} : 0;
		}
		return $counts;
	}

	/**
	 * Tag list for the filter dropdown.
	 *
	 * For users with `read_private_<post_type>` (typically Editor and
	 * Administrator), returns every term in the taxonomy. For lower-cap
	 * users, returns only terms attached to at least one published post so
	 * tag names tied exclusively to other authors' private/draft content
	 * don't leak through the dropdown.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	protected function get_all_tags() {
		$pt          = get_post_type_object( $this->post_type );
		$read_priv   = $pt && isset( $pt->cap->read_private_posts ) ? $pt->cap->read_private_posts : 'read_private_posts';
		$can_see_all = current_user_can( $read_priv );
		$terms       = get_terms(
			array(
				'taxonomy'   => $this->taxonomy,
				'hide_empty' => ! $can_see_all,
			)
		);
		if ( is_wp_error( $terms ) || ! is_array( $terms ) ) {
			return array();
		}
		$out = array();
		foreach ( $terms as $term ) {
			$out[] = array(
				'id'   => (int) $term->term_id,
				'name' => $term->name,
				'slug' => $term->slug,
			);
		}
		return $out;
	}
}
