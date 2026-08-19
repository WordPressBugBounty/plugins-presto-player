<?php
/**
 * Base class for every Presto Player ability.
 *
 * @package PrestoPlayer
 * @subpackage Services\Abilities
 */

namespace PrestoPlayer\Services\Abilities;

use PrestoPlayer\Services\OAuth\Authentication\ScopeGuard;

/**
 * Abstract ability — concrete classes implement getName/getLabel/etc.
 *
 * Default permission is deny — every concrete ability must override checkPermission().
 */
abstract class Ability {

	/**
	 * Taxonomy the Media Hub tags videos with.
	 */
	const VIDEO_TAG_TAXONOMY = 'pp_video_tag';

	/**
	 * The blocks whose `id` attribute is a Media Hub row id.
	 *
	 * Only the provider blocks store one. presto-player/reusable-display and
	 * presto-player/playlist-list-item keep a pp_video_block *post* id under the
	 * same attribute name, and both id spaces are small dense integers — so reading
	 * every presto block's id as a video id matched unrelated rows and made the
	 * abilities refuse work on a post whose only presto block is a Media Hub Item.
	 */
	const PLAYER_BLOCKS = array(
		'presto-player/self-hosted',
		'presto-player/youtube',
		'presto-player/vimeo',
		'presto-player/bunny',
		'presto-player/audio',
	);

	/**
	 * Live media-hub video IDs keyed by the post they point at.
	 *
	 * @var array<int, array<int, int>>
	 */
	private $videos_by_post = array();

	/**
	 * Ability name, e.g. "presto-player/list-videos".
	 *
	 * @return string
	 */
	abstract public function getName();

	/**
	 * Human-readable label.
	 *
	 * @return string
	 */
	abstract public function getLabel();

	/**
	 * Description shown to AI agents.
	 *
	 * @return string
	 */
	abstract public function getDescription();

	/**
	 * Annotation hints — readonly, destructive, idempotent.
	 *
	 * @return array<string, bool>
	 */
	abstract public function getAnnotations();

	/**
	 * JSON Schema for input.
	 *
	 * @return array<string, mixed>
	 */
	abstract public function getInputSchema();

	/**
	 * Execute the ability.
	 *
	 * @param array<string, mixed> $input Validated input.
	 * @return array<string, mixed>|\WP_Error
	 */
	abstract public function execute( array $input );

	/**
	 * Permission check — default deny. Concrete classes must override.
	 *
	 * @return bool
	 */
	public function checkPermission() {
		return false;
	}

	/**
	 * Resolve the target of a video-scoped ability: the pp_video_block post, and
	 * the media-hub row the caller actually asked about.
	 *
	 * Accepts an explicit media-hub `video_id` (resolved to its reusable video
	 * post through the videos table's `post_id`) or a direct `post_id`. The
	 * video_id path is read-only: it never creates a post, returning a
	 * `not_materialized` error when one does not exist yet (the create-video-*
	 * abilities always materialize a post, so this is an edge case for legacy
	 * or externally-created media-hub rows).
	 *
	 * The video_id is handed back alongside the post because a single post can be
	 * pointed at by more than one live row — collapsing to a bare post ID is what
	 * let one video's chapters land on its neighbour's player block.
	 *
	 * @param array<string, mixed> $input Raw input.
	 * @return array{post_id: int, video_id: int}|\WP_Error Post ID is 0 when neither key is given.
	 */
	protected function resolveVideoTarget( array $input ) {
		if ( empty( $input['video_id'] ) ) {
			$post_id = isset( $input['post_id'] ) ? absint( $input['post_id'] ) : 0;
			// Same rule as the video_id path below: a trashed video stays hidden
			// whichever key you reach it by, or post_id becomes a back door that
			// hands out a shortcode for a video get-video already 404s on.
			if ( $post_id && $this->videoPostIsTrashed( $post_id ) ) {
				return new \WP_Error( 'not_found', __( 'Presto Player video not found.', 'presto-player' ), array( 'status' => 404 ) );
			}
			return array(
				'post_id'  => $post_id,
				'video_id' => 0,
			);
		}

		$video_id = absint( $input['video_id'] );
		$video    = new \PrestoPlayer\Models\Video( $video_id );
		// A trashed video is hidden by list-videos, so every id-scoped ability has
		// to agree — otherwise one tool hands out a video the next one 404s on.
		if ( ! $video->id || $this->isSoftDeleted( $video->toArray() ) ) {
			return new \WP_Error( 'not_found', __( 'Presto Player video not found.', 'presto-player' ), array( 'status' => 404 ) );
		}

		$post_id = $this->findVideoPostId( $video_id, (int) $video->post_id );
		if ( ! $post_id ) {
			return new \WP_Error(
				'not_materialized',
				__( 'This media-hub video has no embeddable video post yet.', 'presto-player' ),
				array( 'status' => 409 )
			);
		}

		return array(
			'post_id'  => $post_id,
			'video_id' => $video_id,
		);
	}

	/**
	 * The media-hub video IDs the player blocks inside a post render.
	 *
	 * Blocks without an `id` attribute are skipped: they predate the attribute and
	 * say nothing about which row they belong to, so counting them as a mismatch
	 * would break legacy content. Only the provider blocks are read at all — see
	 * PLAYER_BLOCKS.
	 *
	 * @param string $content Post content.
	 * @return array<int, int>
	 */
	protected function videoBlockIds( $content ) {
		if ( ! function_exists( 'parse_blocks' ) || '' === trim( (string) $content ) ) {
			return array();
		}
		return $this->collectVideoBlockIds( parse_blocks( (string) $content ) );
	}

	/**
	 * Walk parsed blocks collecting the media-hub id each player block carries.
	 *
	 * @param array<int|string, mixed> $blocks Parsed blocks.
	 * @return array<int, int>
	 */
	private function collectVideoBlockIds( array $blocks ) {
		$ids = array();
		foreach ( $blocks as $block ) {
			if ( ! empty( $block['blockName'] )
				&& in_array( $block['blockName'], self::PLAYER_BLOCKS, true )
				&& ! empty( $block['attrs']['id'] ) ) {
				$ids[] = (int) $block['attrs']['id'];
			}
			if ( ! empty( $block['innerBlocks'] ) ) {
				$ids = array_merge( $ids, $this->collectVideoBlockIds( $block['innerBlocks'] ) );
			}
		}
		return array_values( array_unique( $ids ) );
	}

	/**
	 * Whether a post's player block renders a different media-hub row than the one
	 * asked for — reading or writing through it would hit the wrong video.
	 *
	 * @param int $post_id  Reusable pp_video_block post ID.
	 * @param int $video_id Media-hub row the caller asked about (0 when only a post_id was given).
	 * @return bool
	 */
	protected function videoBlockBelongsToOther( $post_id, $video_id ) {
		$video_id = (int) $video_id;
		if ( ! $video_id ) {
			return false;
		}
		$content = get_post_field( 'post_content', (int) $post_id );
		$ids     = $this->videoBlockIds( is_string( $content ) ? $content : '' );
		return $ids && ! in_array( $video_id, $ids, true );
	}

	/**
	 * The other live media-hub rows pointing at the same post.
	 *
	 * Two rows sharing one pp_video_block post is a real state the Media Hub can
	 * reach (swapping a block's source mints a new row while the old one keeps its
	 * pointer), and `[presto_player id=N]` cannot tell them apart — so every
	 * ability that hands back a post or a shortcode reports it instead of
	 * pretending the id is unambiguous.
	 *
	 * @param int $post_id          Post the rows point at.
	 * @param int $exclude_video_id Row to leave out of the result, usually the one being reported on.
	 * @return array<int, int>
	 */
	protected function videoIdsSharingPost( $post_id, $exclude_video_id = 0 ) {
		$post_id = (int) $post_id;
		if ( ! $post_id ) {
			return array();
		}
		if ( ! isset( $this->videos_by_post[ $post_id ] ) ) {
			$this->primeVideoIdsByPost( array( $post_id ) );
		}
		$ids = isset( $this->videos_by_post[ $post_id ] ) ? $this->videos_by_post[ $post_id ] : array();
		if ( $exclude_video_id ) {
			$ids = array_values( array_diff( $ids, array( (int) $exclude_video_id ) ) );
		}
		return $ids;
	}

	/**
	 * The rows that make a post ambiguous when the caller named a post, not a row.
	 *
	 * Addressed by video, "other" is everything except that video. Addressed by
	 * post, the post's own video is not another video — reporting it made
	 * `ambiguous` true for every ordinary single-video post, which tells an agent to
	 * go fix something that is not broken.
	 *
	 * @param int $post_id  Reusable pp_video_block post ID.
	 * @param int $video_id Media-hub row the caller asked about, 0 when it named the post.
	 * @return array<int, int>
	 */
	protected function otherVideosOnPost( $post_id, $video_id = 0 ) {
		if ( (int) $video_id ) {
			return $this->videoIdsSharingPost( $post_id, $video_id );
		}

		$content = get_post_field( 'post_content', (int) $post_id );
		$ids     = $this->videoBlockIds( is_string( $content ) ? $content : '' );
		$own     = $ids ? (int) $ids[0] : 0;
		$others  = $this->videoIdsSharingPost( $post_id, $own );

		// Content written before the block stored an id names no row at all, so
		// nothing says which claimant is this post's own — but a single claimant is
		// still nothing to disambiguate.
		return ( ! $own && 1 === count( $others ) ) ? array() : $others;
	}

	/**
	 * Look up the live rows pointing at a whole set of posts, so a listing ability
	 * doesn't run a query per row. Three queries whatever the page size: the rows
	 * pointing at these posts, the posts themselves, and the rows the blocks in
	 * them name.
	 *
	 * @param array<int, int> $post_ids Post IDs.
	 * @return void
	 */
	protected function primeVideoIdsByPost( array $post_ids ) {
		$post_ids = array_values( array_unique( array_filter( array_map( 'intval', $post_ids ) ) ) );
		$post_ids = array_values( array_diff( $post_ids, array_keys( $this->videos_by_post ) ) );
		if ( ! $post_ids ) {
			return;
		}

		foreach ( $post_ids as $post_id ) {
			$this->videos_by_post[ $post_id ] = array();
		}

		global $wpdb;
		$placeholders = implode( ', ', array_fill( 0, count( $post_ids ), '%d' ) );
		$rows         = (array) $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- custom table, batched for the whole page.
			$wpdb->prepare(
				"SELECT id, post_id FROM {$wpdb->prefix}presto_player_videos WHERE post_id IN ( {$placeholders} ) AND (deleted_at IS NULL OR deleted_at = '0000-00-00 00:00:00')", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $placeholders is a generated list of %d.
				$post_ids
			)
		);

		foreach ( $rows as $row ) {
			$post_id = (int) $row->post_id;
			if ( isset( $this->videos_by_post[ $post_id ] ) ) {
				$this->videos_by_post[ $post_id ][] = (int) $row->id;
			}
		}

		// The post_id column is only half the story. A row whose pointer was never
		// set (or was handed to a sibling) still resolves to the post through the
		// block's own `id` attribute — that's what findVideoPostIds() falls back to.
		// Reading sharing from the column alone made delete-video think it was the
		// sole owner and draft a post that another live row is actually rendered by.
		$block_rows = (array) $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- batched for the whole page.
			$wpdb->prepare(
				"SELECT ID, post_content FROM {$wpdb->posts} WHERE post_type = 'pp_video_block' AND post_status != 'trash' AND ID IN ( {$placeholders} )", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $placeholders is a generated list of %d.
				$post_ids
			)
		);
		// Collect every candidate first and ask about them once. Checking them one
		// at a time meant a `new Video( $id )` — and so a point query — per player
		// block on the page, which is the opposite of what this method is for.
		$candidates = array();
		$all        = array();
		foreach ( $block_rows as $block_row ) {
			$post_id = (int) $block_row->ID;
			if ( ! isset( $this->videos_by_post[ $post_id ] ) ) {
				continue;
			}
			$ids = array_values( array_diff( $this->videoBlockIds( $block_row->post_content ), $this->videos_by_post[ $post_id ] ) );
			if ( ! $ids ) {
				continue;
			}
			$candidates[ $post_id ] = $ids;
			$all                    = array_merge( $all, $ids );
		}

		// Appearing in a post is not the same as belonging to it: a reusable post can
		// embed a second player block for a video that has a post of its own, and
		// counting that as sharing made delete-video keep a post published because it
		// believed another video still played through it. Only rows whose own
		// resolution lands on this post count — the same question findVideoPostId()
		// answers.
		$owners = $this->videoOwnPostIds( $all );
		foreach ( $candidates as $post_id => $ids ) {
			$sharing = array();
			foreach ( $ids as $id ) {
				if ( isset( $owners[ $id ] ) && $owners[ $id ] === $post_id ) {
					$sharing[] = $id;
				}
			}
			$this->videos_by_post[ $post_id ] = array_merge( $this->videos_by_post[ $post_id ], $sharing );
		}
	}

	/**
	 * The post each of these live media-hub rows resolves to as its own.
	 *
	 * Batched: one query for the rows, then findVideoPostIds() for the whole set.
	 *
	 * @param array<int, int> $video_ids Media Hub video IDs.
	 * @return array<int, int> video_id => post_id, live rows only.
	 */
	protected function videoOwnPostIds( array $video_ids ) {
		$video_ids = array_values( array_unique( array_filter( array_map( 'intval', $video_ids ) ) ) );
		if ( ! $video_ids ) {
			return array();
		}

		global $wpdb;
		$placeholders = implode( ', ', array_fill( 0, count( $video_ids ), '%d' ) );
		$rows         = (array) $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- custom table, batched for the whole page.
			$wpdb->prepare(
				"SELECT id, post_id FROM {$wpdb->prefix}presto_player_videos WHERE id IN ( {$placeholders} ) AND (deleted_at IS NULL OR deleted_at = '0000-00-00 00:00:00')", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $placeholders is a generated list of %d.
				$video_ids
			)
		);

		$pointers = array();
		foreach ( $rows as $row ) {
			$pointers[ (int) $row->id ] = (int) $row->post_id;
		}

		return $pointers ? $this->findVideoPostIds( $pointers ) : array();
	}

	/**
	 * The Media Hub tags on a video's post, in the shape the media-list endpoint
	 * returns them.
	 *
	 * @param int $post_id Reusable pp_video_block post ID.
	 * @return array<int, array<string, mixed>>
	 */
	protected function videoTagRows( $post_id ) {
		$post_id = (int) $post_id;
		if ( ! $post_id ) {
			return array();
		}
		$terms = get_the_terms( $post_id, self::VIDEO_TAG_TAXONOMY );
		if ( ! is_array( $terms ) ) {
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

	/**
	 * Find a Media Hub tag from what an agent is likely to have: a slug, a display
	 * name, or a term id. Slug first, matching the `by_tag` playlist semantics.
	 *
	 * @param string|int $tag Tag slug, name or term ID.
	 * @return \WP_Term|null
	 */
	protected function resolveVideoTagTerm( $tag ) {
		$tag = is_string( $tag ) ? trim( $tag ) : $tag;
		if ( '' === $tag || null === $tag ) {
			return null;
		}

		// An integer is an id and nothing else. A *string* of digits is a tag people
		// really have — "2024", "101" — and taking it for a term id filed those
		// videos under whatever term happened to hold that id, or 404'd on a tag
		// get-video had just reported. The id is the fallback, not the first guess.
		if ( is_int( $tag ) || is_float( $tag ) ) {
			$term = get_term( (int) $tag, self::VIDEO_TAG_TAXONOMY );
			return $term instanceof \WP_Term ? $term : null;
		}

		$name = sanitize_text_field( (string) $tag );
		$term = get_term_by( 'slug', sanitize_title( $name ), self::VIDEO_TAG_TAXONOMY );
		if ( ! $term instanceof \WP_Term ) {
			$term = get_term_by( 'name', $name, self::VIDEO_TAG_TAXONOMY );
		}
		if ( ! $term instanceof \WP_Term && is_numeric( $name ) ) {
			$term = get_term( (int) $name, self::VIDEO_TAG_TAXONOMY );
		}
		return $term instanceof \WP_Term ? $term : null;
	}

	/**
	 * Everything setVideoTags() can refuse, decided before anything is written.
	 *
	 * Callers that write more than tags run this first: the tag write used to go
	 * in ahead of the row payload, so a video with no materialized post answered
	 * `not_materialized` having already dropped a perfectly valid title.
	 *
	 * @param int                $post_id Reusable pp_video_block post ID.
	 * @param array<int, string> $tags    Tag names or slugs.
	 * @return array{term_ids: array<int, int>, missing: array<string, string>}|\WP_Error
	 */
	protected function validateVideoTags( $post_id, array $tags ) {
		$post_id = (int) $post_id;
		if ( ! $post_id || 'pp_video_block' !== get_post_type( $post_id ) ) {
			return new \WP_Error(
				'not_materialized',
				__( 'This media-hub video has no embeddable video post to tag yet.', 'presto-player' ),
				array( 'status' => 409 )
			);
		}
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return new \WP_Error( 'forbidden', __( 'You are not allowed to edit this video.', 'presto-player' ), array( 'status' => 403 ) );
		}

		$taxonomy = get_taxonomy( self::VIDEO_TAG_TAXONOMY );
		if ( ! $taxonomy ) {
			return new \WP_Error( 'no_taxonomy', __( 'Media Tags are not available.', 'presto-player' ), array( 'status' => 503 ) );
		}
		if ( ! current_user_can( $taxonomy->cap->assign_terms ) ) {
			return new \WP_Error( 'forbidden', __( 'You are not allowed to assign Media Tags.', 'presto-player' ), array( 'status' => 403 ) );
		}

		$term_ids = array();
		$missing  = array();
		foreach ( $tags as $tag ) {
			if ( ! is_scalar( $tag ) ) {
				continue;
			}
			$name = sanitize_text_field( (string) $tag );
			if ( '' === $name ) {
				continue;
			}
			$term = $this->resolveVideoTagTerm( $name );
			if ( $term ) {
				$term_ids[] = (int) $term->term_id;
				continue;
			}
			$missing[ $name ] = $name;
		}

		if ( $missing && ! current_user_can( $taxonomy->cap->edit_terms ) ) {
			return new \WP_Error(
				'cannot_create_tags',
				sprintf(
					/* translators: %s: comma-separated list of tag names. */
					__( 'These Media Tags do not exist yet and you are not allowed to create them: %s', 'presto-player' ),
					implode( ', ', $missing )
				),
				array( 'status' => 403 )
			);
		}

		return array(
			'term_ids' => $term_ids,
			'missing'  => $missing,
		);
	}

	/**
	 * Replace the Media Hub tags on a video's post.
	 *
	 * Tags live on the pp_video_block post, not on the videos row, so this needs
	 * the post capability as well as the taxonomy's own assign capability.
	 * Creating a tag that does not exist yet is a term edit, so it is gated
	 * separately — the same split WP core's terms endpoint makes.
	 *
	 * @param int                $post_id Reusable pp_video_block post ID.
	 * @param array<int, string> $tags    Tag names or slugs. An empty array clears them.
	 * @return array<int, array<string, mixed>>|\WP_Error The tags now on the post.
	 */
	protected function setVideoTags( $post_id, array $tags ) {
		$post_id  = (int) $post_id;
		$resolved = $this->validateVideoTags( $post_id, $tags );
		if ( is_wp_error( $resolved ) ) {
			return $resolved;
		}

		$term_ids = $resolved['term_ids'];
		foreach ( $resolved['missing'] as $name ) {
			$created = wp_insert_term( $name, self::VIDEO_TAG_TAXONOMY );
			if ( is_wp_error( $created ) ) {
				// term_exists carries the id of whatever we collided with, which is
				// the term the caller meant — anything else is a real failure.
				$existing = (int) $created->get_error_data();
				if ( ! $existing ) {
					return $created;
				}
				$term_ids[] = $existing;
				continue;
			}
			$term_ids[] = (int) $created['term_id'];
		}

		$set = wp_set_object_terms( $post_id, array_values( array_unique( $term_ids ) ), self::VIDEO_TAG_TAXONOMY, false );
		if ( is_wp_error( $set ) ) {
			return $set;
		}

		return $this->videoTagRows( $post_id );
	}

	/**
	 * Whether the media-hub row behind a video post is trashed.
	 *
	 * @param int $post_id Reusable pp_video_block post ID.
	 * @return bool
	 */
	protected function videoPostIsTrashed( $post_id ) {
		// fetch() defaults to the published scope, so the trashed row this is
		// looking for only comes back when the status is asked for explicitly.
		$video = ( new \PrestoPlayer\Models\Video() )->findWhere(
			array(
				'post_id' => (int) $post_id,
				'status'  => 'trashed',
			)
		);

		if ( ! $video instanceof \PrestoPlayer\Models\Video ) {
			return false;
		}

		// Model has __get but no __isset, so empty()/isset() on a magic property
		// always reports empty. Read it into a local first.
		$id = (int) $video->id;
		return $id > 0;
	}

	/**
	 * Whether a soft-deleting model row is trashed.
	 *
	 * Matches Model::all()'s condition — a zero date counts as "not deleted", and
	 * formatRow() casts the column to a string, so `empty()` alone would report
	 * legacy zero-date rows as trashed.
	 *
	 * @param array<string, mixed> $row Model row.
	 * @return bool
	 */
	protected function isSoftDeleted( array $row ) {
		$deleted_at = isset( $row['deleted_at'] ) ? (string) $row['deleted_at'] : '';
		return '' !== $deleted_at && '0000-00-00 00:00:00' !== $deleted_at;
	}

	/**
	 * Find the pp_video_block post that embeds a media-hub video.
	 *
	 * The videos table's `post_id` column is the fast path, but it is only a
	 * cached pointer: rows created outside the block editor never set it, and it
	 * goes stale when the post it named is deleted or replaced (duplicated
	 * videos, re-imports). The Media Hub screen lists the posts themselves, so
	 * those rows show a shortcode in the UI while the abilities reported them as
	 * unavailable. When the pointer does not resolve we fall back to the block
	 * attributes, which are the real link — the inner player block stores the
	 * media-hub id it renders.
	 *
	 * @param int $video_id Media-hub video ID.
	 * @param int $post_id  The videos row's cached post_id, if any.
	 * @return int Post ID, or 0 when the video has no Media Hub post.
	 */
	protected function findVideoPostId( $video_id, $post_id = 0 ) {
		$map = $this->findVideoPostIds( array( (int) $video_id => (int) $post_id ) );
		return isset( $map[ (int) $video_id ] ) ? $map[ (int) $video_id ] : 0;
	}

	/**
	 * Resolve the Media Hub post for a whole set of videos in one pass.
	 *
	 * Listing abilities enrich every row with its post, so doing this one video
	 * at a time meant a full `post_content` scan and a `get_post()` per row.
	 * This runs at most three queries no matter how many videos are asked for:
	 * one to check the cached pointers, one scan for whatever is left, and one
	 * to prime the post cache before the block attributes are read.
	 *
	 * @param array<int, int> $cached Map of media-hub video ID => the videos row's cached post_id (0 when unset).
	 * @return array<int, int> Map of video ID => post ID, 0 where the video has no Media Hub post.
	 */
	protected function findVideoPostIds( array $cached ) {
		$resolved = array();
		$pointers = array();
		foreach ( $cached as $video_id => $post_id ) {
			$video_id = (int) $video_id;
			if ( ! $video_id ) {
				continue;
			}
			$resolved[ $video_id ] = 0;
			if ( (int) $post_id ) {
				$pointers[ $video_id ] = (int) $post_id;
			}
		}

		if ( ! $resolved ) {
			return array();
		}

		global $wpdb;

		// Trust a cached pointer only while it still names a live Media Hub post.
		if ( $pointers ) {
			$ids          = array_values( array_unique( $pointers ) );
			$placeholders = implode( ', ', array_fill( 0, count( $ids ), '%d' ) );
			$live         = array_map(
				'intval',
				(array) $wpdb->get_col( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- batched id lookup; the per-post alternative is a get_post() per row.
					$wpdb->prepare(
						"SELECT ID FROM {$wpdb->posts} WHERE post_type = 'pp_video_block' AND post_status != 'trash' AND ID IN ( {$placeholders} )", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $placeholders is a generated list of %d.
						$ids
					)
				)
			);
			foreach ( $pointers as $video_id => $post_id ) {
				if ( in_array( $post_id, $live, true ) ) {
					$resolved[ $video_id ] = $post_id;
				}
			}
		}

		$pending = array();
		foreach ( $resolved as $video_id => $post_id ) {
			if ( ! $post_id ) {
				$pending[] = $video_id;
			}
		}
		if ( ! $pending ) {
			return $resolved;
		}

		// One scan for every unresolved video instead of one per row. The ids are
		// integers, and the trailing [,}] pins the match to a whole attribute value
		// so `"id":5` can no longer match `"id":50`. The block attributes still decide.
		$pattern    = '"id":(' . implode( '|', $pending ) . ')[,}]';
		$candidates = array_map(
			'intval',
			(array) $wpdb->get_col( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- the link lives in post_content, so no meta query or WP_Query can express it.
				$wpdb->prepare(
					"SELECT ID FROM {$wpdb->posts} WHERE post_type = 'pp_video_block' AND post_status != 'trash' AND post_content REGEXP %s ORDER BY ID DESC LIMIT %d",
					$pattern,
					count( $pending ) * 4 + 20
				)
			)
		);

		if ( ! $candidates ) {
			return $resolved;
		}

		// One query for every candidate's post, instead of one per candidate.
		_prime_post_caches( $candidates, false, false );

		foreach ( $candidates as $candidate ) {
			$block    = ( new \PrestoPlayer\Models\ReusableVideo( $candidate ) )->getBlock();
			$block_id = ! empty( $block['attrs']['id'] ) ? (int) $block['attrs']['id'] : 0;
			// Candidates come back newest first, so the first hit wins — same as before.
			if ( $block_id && isset( $resolved[ $block_id ] ) && ! $resolved[ $block_id ] ) {
				$resolved[ $block_id ] = $candidate;
			}
		}

		return $resolved;
	}

	/**
	 * JSON Schema for output. Optional — defaults to empty.
	 *
	 * @return array<string, mixed>
	 */
	public function getOutputSchema() {
		return array();
	}

	/**
	 * Build the WP Abilities API registration payload.
	 *
	 * The permission callback is wrapped with the OAuth {@see ScopeGuard} so a
	 * Bearer-authenticated request lacking the required scope is rejected with a
	 * `WP_Error` before the capability check runs. Cookie / application-password
	 * requests fall straight through to {@see self::checkPermission()}. The
	 * wrapper is guarded with `class_exists()` so abilities keep working even
	 * when the OAuth service is unavailable.
	 *
	 * @return array<string, mixed>
	 */
	public function getConfig() {
		$permission_callback = array( $this, 'checkPermission' );

		if ( class_exists( ScopeGuard::class ) ) {
			$permission_callback = ScopeGuard::wrapPermissionCallback( $permission_callback, $this );
		}

		// Normalise deprecated arg aliases (e.g. `id` -> `video_id`) before the
		// ability runs, so execute() only ever sees the canonical names.
		$execute_callback = function ( $input ) {
			return $this->execute( $this->normalizeAliases( (array) $input ) );
		};

		return array(
			'label'               => $this->getLabel(),
			'description'         => $this->getDescription(),
			'category'            => $this->getCategory(),
			'input_schema'        => $this->applyAliasesToSchema( $this->getInputSchema() ),
			'output_schema'       => $this->getOutputSchema(),
			'permission_callback' => $permission_callback,
			'execute_callback'    => $execute_callback,
			'meta'                => array(
				'show_in_rest' => true,
				'annotations'  => $this->getAnnotations(),
				'mcp'          => array( 'public' => true ),
			),
		);
	}

	/**
	 * Deprecated input aliases — map a canonical parameter name to the older
	 * names still accepted on input. Override in abilities that renamed a
	 * parameter so existing callers keep working (e.g. `video_id` <= `id`).
	 *
	 * @return array<string, array<int, string>> canonical => alias names.
	 */
	public function getAliases() {
		return array();
	}

	/**
	 * Copy any provided alias value onto its canonical key (when the canonical
	 * is absent), then drop the alias keys, so execute() only sees canonical
	 * names. No-op for abilities without aliases.
	 *
	 * @param array<string, mixed> $input Raw input.
	 * @return array<string, mixed>
	 */
	public function normalizeAliases( array $input ) {
		foreach ( $this->getAliases() as $canonical => $aliases ) {
			foreach ( (array) $aliases as $alias ) {
				if ( isset( $input[ $alias ] ) && ! isset( $input[ $canonical ] ) ) {
					$input[ $canonical ] = $input[ $alias ];
				}
				unset( $input[ $alias ] );
			}
		}
		return $input;
	}

	/**
	 * Expose each alias as an optional input property and drop the canonical key
	 * from `required` — an alias may satisfy it, and the real requirement is
	 * enforced in execute() after {@see self::normalizeAliases()}.
	 *
	 * @param array<string, mixed> $schema Input schema.
	 * @return array<string, mixed>
	 */
	protected function applyAliasesToSchema( $schema ) {
		$aliases = $this->getAliases();
		if ( empty( $aliases ) || ! is_array( $schema ) || ! isset( $schema['properties'] ) || ! is_array( $schema['properties'] ) ) {
			return $schema;
		}

		$properties = $schema['properties'];
		$required   = isset( $schema['required'] ) && is_array( $schema['required'] ) ? $schema['required'] : array();

		foreach ( $aliases as $canonical => $alias_names ) {
			if ( ! isset( $properties[ $canonical ] ) ) {
				continue;
			}
			foreach ( (array) $alias_names as $alias ) {
				$alias_prop                = $properties[ $canonical ];
				$alias_prop['description'] = sprintf(
					/* translators: %s: the canonical parameter name. */
					__( 'Deprecated alias for "%s"; accepted for backward compatibility. Prefer the canonical name.', 'presto-player' ),
					$canonical
				);
				$properties[ $alias ] = $alias_prop;
			}
			$required = array_values( array_diff( $required, array( $canonical ) ) );
		}

		$schema['properties'] = $properties;
		if ( $required ) {
			$schema['required'] = $required;
		} else {
			unset( $schema['required'] );
		}
		return $schema;
	}

	/**
	 * Add the canonical `video_id` key (mirroring the row's `id`) to an output
	 * row, so the value callers carry to other video abilities matches their
	 * `video_id` input. Keeps `id` for backward compatibility.
	 *
	 * Also carries the embed pair the Media Hub screen shows on every row —
	 * `post_id` and its `[presto_player id=N]` shortcode — so a client never has
	 * to make a second call (or guess) to embed a video it just listed. Both are
	 * empty when the video has no Media Hub post yet.
	 *
	 * `shares_post_with` and `tags` come along for the same reason: the shortcode
	 * is not unique when two rows point at one post, and the tags a video is
	 * filed under live on the post rather than the row.
	 *
	 * @param array<string, mixed> $row      Output row containing `id`.
	 * @param array<int, int>|null $post_ids Pre-resolved video ID => post ID map, for callers
	 *                                       formatting many rows (see {@see self::findVideoPostIds()}).
	 * @return array<string, mixed>
	 */
	protected function withVideoId( array $row, ?array $post_ids = null ) {
		$video_id = isset( $row['id'] ) ? (int) $row['id'] : 0;

		if ( null !== $post_ids ) {
			$post_id = isset( $post_ids[ $video_id ] ) ? (int) $post_ids[ $video_id ] : 0;
		} else {
			$post_id = $video_id ? $this->findVideoPostId( $video_id, (int) ( $row['post_id'] ?? 0 ) ) : 0;
		}

		$row = array_intersect_key(
			$row,
			array_flip( array( 'id', 'title', 'type', 'src', 'external_id', 'attachment_id' ) )
		);
		if ( $video_id ) {
			$row['video_id'] = $video_id;
		}
		// Derived at read time, never stored: WordPress already measured every
		// uploaded file, so there is nothing here worth a column of its own. Embed
		// providers do not tell us, hence 0 — which the schema documents as
		// "length unknown".
		$row['duration'] = 0;
		if ( ! empty( $row['attachment_id'] ) ) {
			$meta            = wp_get_attachment_metadata( (int) $row['attachment_id'] );
			$row['duration'] = ! empty( $meta['length'] ) ? (int) $meta['length'] : 0;
		}
		$row['post_id']          = $post_id;
		$row['shortcode']        = $post_id ? '[presto_player id=' . $post_id . ']' : '';
		$row['shares_post_with'] = $this->videoIdsSharingPost( $post_id, $video_id );
		$row['tags']             = $this->videoTagRows( $post_id );

		return $row;
	}

	/**
	 * Bring a player time (chapter marker, overlay window) down to the MM:SS the
	 * player parses.
	 *
	 * The player splits on ":" and only ever reads the first two parts as minutes and
	 * seconds, so an HH:MM:SS value is silently mis-timed. Callers hand us either form,
	 * so fold the hours into the minutes here rather than storing something unplayable.
	 * Anything that isn't a time comes back empty for the caller to reject — an agent
	 * guessing at the format should be told, not have "abc" written into the block.
	 *
	 * @param mixed $time Time as given.
	 * @return string Normalized MM:SS, or '' when the input isn't a time.
	 */
	protected function normalizeTime( $time ) {
		if ( ! is_string( $time ) || ! preg_match( '/^(?:(\d+):)?(\d+):([0-5]?\d)$/', trim( $time ), $m ) ) {
			return '';
		}
		return sprintf( '%d:%02d', ( (int) $m[1] * 60 ) + (int) $m[2], (int) $m[3] );
	}

	/**
	 * Reduce stored chapter rows to the {time, title} pairs the abilities return.
	 *
	 * @param array<int|string, mixed> $chapters Stored chapters.
	 * @return array<int, array<string, string>>
	 */
	protected function normalizeChapterRows( array $chapters ) {
		$out = array();
		foreach ( $chapters as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$out[] = array(
				'time'  => isset( $row['time'] ) ? (string) $row['time'] : '',
				'title' => isset( $row['title'] ) ? (string) $row['title'] : '',
			);
		}
		return $out;
	}

	/**
	 * Output schema for the `shares_post_with` field {@see self::withVideoId()} adds.
	 *
	 * @return array<string, mixed>
	 */
	protected function sharesPostWithSchema() {
		return array(
			'type'        => 'array',
			'items'       => array( 'type' => 'integer' ),
			'description' => __( 'Other live Media Hub video_ids pointing at the same post. Normally empty. When it is not, the shortcode names a post that more than one video claims, so it cannot embed one of them on its own — and chapter abilities will refuse the videos whose player block is not the one in that post.', 'presto-player' ),
		);
	}

	/**
	 * Output schema for the `tags` field {@see self::withVideoId()} adds.
	 *
	 * @return array<string, mixed>
	 */
	protected function videoTagsSchema() {
		return array(
			'type'        => 'array',
			'description' => __( 'Media Tags on this video. Pass any of these names or slugs as the list-videos `tag` filter.', 'presto-player' ),
			'items'       => array(
				'type'       => 'object',
				'properties' => array(
					'id'   => array( 'type' => 'integer' ),
					'name' => array( 'type' => 'string' ),
					'slug' => array( 'type' => 'string' ),
				),
			),
		);
	}

	/**
	 * Category slug. Pro overrides to "presto-player-pro".
	 *
	 * @return string
	 */
	protected function getCategory() {
		return 'presto-player';
	}
}
