<?php
/**
 * Video model.
 *
 * @package PrestoPlayer
 * @subpackage Models
 */

namespace PrestoPlayer\Models;

use PrestoPlayer\Services\Abilities\Ability;
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
	 * Query var marking the WP_Query whose SQL we only want to read.
	 *
	 * @var string
	 */
	const SQL_ONLY_QUERY_VAR = 'presto_player_sql_only';

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
		'post_id',
		'created_by',
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
			$title = get_the_title( $this->attributes->attachment_id );
			$src   = wp_get_attachment_url( $this->attributes->attachment_id );
			// The attachment is the source of truth on read: rename a file in the
			// Media Library and the Media Hub follows it. Letting the stored row win
			// here changed the title on every existing site instead. Which title gets
			// stored is maybeAutoCreateTitle()'s call, not this one's.
			$this->attributes->title = $title ? $title : $this->attributes->title;
			$this->attributes->src   = $src ? $src : $this->attributes->src;
		}

		return $this;
	}

	/**
	 * Get the video's embedded title from the provider's own oEmbed endpoint.
	 *
	 * @param string $src  Video source URL.
	 * @param string $type Video type, used to pick the provider endpoint.
	 * @return string|\WP_Error Embedded title, or WP_Error on HTTP failure.
	 */
	public function getEmbeddedTitle( $src = '', $type = '' ) {
		$endpoints = array(
			'youtube' => 'https://www.youtube.com/oembed?format=json&url=',
			'vimeo'   => 'https://vimeo.com/api/oembed.json?url=',
		);

		if ( empty( $src ) || empty( $endpoints[ $type ] ) ) {
			return '';
		}

		$response = wp_remote_get( $endpoints[ $type ] . rawurlencode( $src ) );
		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$api_response = json_decode( wp_remote_retrieve_body( $response ), true );

		return is_array( $api_response ) ? ( $api_response['title'] ?? '' ) : '';
	}

	/**
	 * Maybe auto-create title if not set.
	 *
	 * @param array $args Video attributes.
	 * @return array
	 */
	public function maybeAutoCreateTitle( $args ) {
		// A title the caller gave us is the one we store — deriving one is only
		// ever for filling in a blank.
		if ( ! empty( $args['title'] ) ) {
			return $args;
		}
		if ( empty( $args['src'] ) ) {
			return $args;
		}

		$type  = isset( $args['type'] ) ? $args['type'] : '';
		$title = $this->providerTitle( $args['src'], $type );

		$args['title'] = '' !== $title ? $title : $this->titleFromSrc( $args['src'], $type );

		return $args;
	}

	/**
	 * The title the provider gives this video, when it has one to give.
	 *
	 * @param string $src  Source URL.
	 * @param string $type Video type.
	 * @return string Empty when the provider has no title, or isn't one we ask.
	 */
	protected function providerTitle( $src, $type ) {
		if ( ! in_array( $type, array( 'youtube', 'vimeo' ), true ) ) {
			return '';
		}
		$title = $this->getEmbeddedTitle( $src, $type );
		return is_wp_error( $title ) ? '' : (string) $title;
	}

	/**
	 * A readable title for a source URL: the filename, or the URL itself.
	 *
	 * Embed types keep the raw url so a failed oEmbed lookup doesn't turn
	 * e.g. /watch?v=x into the title "Watch".
	 *
	 * @param string $src  Source URL.
	 * @param string $type Video type.
	 * @return string
	 */
	protected function titleFromSrc( $src, $type ) {
		if ( in_array( $type, array( 'youtube', 'vimeo' ), true ) ) {
			return $src;
		}
		$path = wp_parse_url( $src, PHP_URL_PATH );
		$name = $path ? pathinfo( rawurldecode( $path ), PATHINFO_FILENAME ) : '';
		return $name ? ucwords( str_replace( array( '-', '_' ), ' ', $name ) ) : $src;
	}

	/**
	 * A LIKE clause over the title a caller is actually shown.
	 *
	 * On read, set() lets a non-empty attachment title win — so matching the stored
	 * column alone reported rows whose title has nothing to do with the search term
	 * (a row renamed through update-video while its file is shared with another
	 * video), and missed rows renamed in the Media Library. The COALESCE mirrors
	 * set(), so a search hit and the title it comes back with always agree.
	 *
	 * @param string $term Title substring to match.
	 * @return string Prepared SQL condition, without a leading keyword.
	 */
	protected function titleLike( $term ) {
		global $wpdb;

		return $wpdb->prepare(
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $wpdb->posts is a core table name.
			"COALESCE( NULLIF( ( SELECT `post_title` FROM {$wpdb->posts} WHERE `ID` = `attachment_id` ), '' ), `title` ) LIKE %s",
			'%' . $wpdb->esc_like( sanitize_text_field( $term ) ) . '%'
		);
	}

	/**
	 * Search videos by title substring.
	 *
	 * @param string $term       Title substring to match.
	 * @param int    $page       Page number (1-based).
	 * @param int    $per_page   Items per page.
	 * @param int    $created_by Restrict to videos owned by this user id (0 = no restriction).
	 * @return object Object with total, per_page, page and data (array of Video models).
	 */
	public function searchByTitle( $term, $page = 1, $per_page = 50, $created_by = 0 ) {
		global $wpdb;

		$where = 'WHERE ' . $this->titleLike( $term ) . " AND (deleted_at IS NULL OR deleted_at = '0000-00-00 00:00:00')";
		if ( (int) $created_by ) {
			$where .= $wpdb->prepare( ' AND `created_by` = %d', (int) $created_by );
		}

		return $this->pagedResults( $where, $page, $per_page );
	}

	/**
	 * Fetch the videos filed under a Media Tag, newest first.
	 *
	 * Media Tags live on the pp_video_block post rather than on the video row, so
	 * the tagged posts decide which rows come back — resolved to the video ids
	 * their blocks render, since the post_id column can't be trusted (see
	 * taggedPostScope()).
	 *
	 * @param int    $term_id    pp_video_tag term ID.
	 * @param int    $page       Page number (1-based).
	 * @param int    $per_page   Items per page.
	 * @param int    $created_by Restrict to videos owned by this user id (0 = no restriction).
	 * @param string $term       Optional title substring to also match.
	 * @param int    $author     Restrict to posts authored by this user id (0 = no restriction).
	 * @return object Object with total, per_page, page and data (array of Video models).
	 */
	public function fetchByTag( $term_id, $page = 1, $per_page = 50, $created_by = 0, $term = '', $author = 0 ) {
		global $wpdb;

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- taggedPostScope() builds prepared/integer SQL.
		$where = 'WHERE ' . $this->taggedPostScope( (int) $term_id, (int) $author ) . " AND (deleted_at IS NULL OR deleted_at = '0000-00-00 00:00:00')";
		if ( (int) $created_by ) {
			$where .= $wpdb->prepare( ' AND `created_by` = %d', (int) $created_by );
		}
		if ( '' !== $term ) {
			// Same title the caller is shown — see titleLike().
			$where .= ' AND ' . $this->titleLike( $term );
		}

		return $this->pagedResults( $where, $page, $per_page );
	}

	/**
	 * The condition restricting the videos table to the posts filed under a tag.
	 *
	 * Matching `post_id` alone missed nearly everything: the column is unset or
	 * stale on most rows (never written outside the block editor, left behind by
	 * duplicates and re-imports), so live tags answered with zero videos. The real
	 * link is the block's own `id` attribute in the tagged post's content — the
	 * same resolution the abilities layer uses — so the tagged posts' content is
	 * read once and the ids it names go in as `id IN ( … )`, with `post_id`
	 * kept as a union for rows whose content names no id. When no post carries
	 * the tag the condition matches nothing — `IN ()` is a syntax error, and
	 * `IN ( SELECT 0 )` matched every row that has no post at all.
	 *
	 * @param int $term_id pp_video_tag term ID.
	 * @param int $author  Restrict to posts by this author (0 = no restriction).
	 * @return string SQL condition.
	 */
	protected function taggedPostScope( $term_id, $author ) {
		global $wpdb;

		$sql = $this->taggedPostIdsSql( $term_id, $author );
		if ( '' !== $sql ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- $sql is the statement WP_Query prepared; content lives in post_content only.
			$rows = (array) $wpdb->get_results( "SELECT `ID`, `post_content` FROM {$wpdb->posts} WHERE `ID` IN ( {$sql} )", ARRAY_A );
		} else {
			// get_posts() suppresses the filters that made the statement unnestable, so
			// the ids come back clean.
			$ids = array();
			foreach ( get_posts( $this->taggedPostQueryArgs( $term_id, $author ) ) as $post ) {
				$ids[] = $post instanceof \WP_Post ? (int) $post->ID : (int) $post;
			}
			$rows = array();
			if ( $ids ) {
				$placeholders = implode( ', ', array_fill( 0, count( $ids ), '%d' ) );
				$rows         = (array) $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- content lives in post_content only.
					$wpdb->prepare( "SELECT `ID`, `post_content` FROM {$wpdb->posts} WHERE `ID` IN ( {$placeholders} )", $ids ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $placeholders is a generated list of %d.
					ARRAY_A
				);
			}
		}

		if ( ! $rows ) {
			return '1 = 0';
		}

		$post_ids  = array();
		$video_ids = array();
		foreach ( $rows as $row ) {
			$post_ids[] = (int) $row['ID'];
			$video_ids  = array_merge( $video_ids, $this->blockVideoIds( (string) $row['post_content'] ) );
		}

		$scope = '`post_id` IN ( ' . implode( ', ', $post_ids ) . ' )';
		if ( $video_ids ) {
			$scope = '( `id` IN ( ' . implode( ', ', array_unique( $video_ids ) ) . ' ) OR ' . $scope . ' )';
		}

		return $scope;
	}

	/**
	 * The video ids the player blocks in a post's content point at.
	 *
	 * Parsed rather than pattern-matched: a post can hold more than one player
	 * block, and any earlier block carrying an `id` of its own — an image, a
	 * reusable display naming a post — would be read as the video instead. Same
	 * resolution the abilities layer uses.
	 *
	 * @param string $content Post content.
	 * @return int[]
	 */
	protected function blockVideoIds( $content ) {
		if ( ! function_exists( 'parse_blocks' ) || '' === trim( $content ) ) {
			return array();
		}

		return $this->playerBlockIds( parse_blocks( $content ) );
	}

	/**
	 * Walk parsed blocks, nested ones included, for the ids player blocks name.
	 *
	 * @param array<array<string, mixed>> $blocks Parsed blocks.
	 * @return int[]
	 */
	protected function playerBlockIds( array $blocks ) {
		$ids = array();

		foreach ( $blocks as $block ) {
			if ( ! empty( $block['blockName'] )
				&& in_array( $block['blockName'], Ability::PLAYER_BLOCKS, true )
				&& ! empty( $block['attrs']['id'] ) ) {
				$ids[] = (int) $block['attrs']['id'];
			}
			if ( ! empty( $block['innerBlocks'] ) ) {
				$ids = array_merge( $ids, $this->playerBlockIds( $block['innerBlocks'] ) );
			}
		}

		return $ids;
	}

	/**
	 * The SELECT WP_Query would run for the posts filed under a Media Tag.
	 *
	 * Borrowing the query keeps the visibility rules WordPress's own — `perm` and
	 * the author scope decide what a low-capability user may see, and a second
	 * hand-written copy of that is exactly the sort of thing that drifts into a
	 * leak. Nothing is fetched: the SQL is captured off `posts_request` and
	 * `posts_pre_query` short-circuits the query before it reaches the database.
	 *
	 * @param int $term_id pp_video_tag term ID.
	 * @param int $author  Restrict to posts by this author (0 = no restriction).
	 * @return string SELECT statement.
	 */
	protected function taggedPostIdsSql( $term_id, $author ) {
		$sql = $this->querySql( $this->taggedPostQueryArgs( $term_id, $author ) );

		// `IN ( … )` needs a statement that selects exactly one column. A
		// plugin filtering posts_fields or posts_clauses_request (search and
		// multilingual plugins do) can add a second, and MySQL answers that with
		// error 1241 — which surfaces as an empty listing rather than a failure.
		// LIMIT and SQL_CALC_FOUND_ROWS are just as illegal inside IN (error
		// 1235), and a pre_get_posts hook setting posts_per_page adds both.
		// Hand back nothing and let the caller run the query itself.
		if ( preg_match( '/\bLIMIT\b|\bSQL_CALC_FOUND_ROWS\b/i', $sql ) ) {
			return '';
		}

		return $this->isSingleColumnSelect( $sql ) ? $sql : '';
	}

	/**
	 * The WP_Query arguments describing the posts filed under a Media Tag.
	 *
	 * @param int $term_id pp_video_tag term ID.
	 * @param int $author  Restrict to posts by this author (0 = no restriction).
	 * @return array<string, mixed>
	 */
	protected function taggedPostQueryArgs( $term_id, $author ) {
		$args = array(
			'post_type'           => 'pp_video_block',
			'post_status'         => array( 'publish', 'draft', 'pending', 'private', 'future' ),
			'posts_per_page'      => -1, // phpcs:ignore WordPress.WP.PostsPerPage.posts_per_page_posts_per_page -- the scope needs every tagged post; the videos listing pages the result.
			'fields'              => 'ids',
			'perm'                => 'readable',
			'no_found_rows'       => true,
			'ignore_sticky_posts' => true,
			'tax_query'           => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query -- the tag filter is the point of the query.
				array(
					'taxonomy' => 'pp_video_tag',
					'field'    => 'term_id',
					'terms'    => array( $term_id ),
				),
			),
		);
		if ( $author ) {
			$args['author'] = $author;
		}

		return $args;
	}

	/**
	 * The SQL a WP_Query would run, without running it.
	 *
	 * `posts_request` hands over the finished statement, and `posts_pre_query`
	 * short-circuits the query before it ever reaches the database.
	 *
	 * @param array<string, mixed> $args WP_Query arguments.
	 * @return string
	 */
	protected function querySql( array $args ) {
		$args[ self::SQL_ONLY_QUERY_VAR ] = true;

		$sql = '';
		// Both filters answer for our query only. Anything else running while they
		// are attached — a query fired from a pre_get_posts hook, a menu, a sitemap —
		// must come back with its own posts, not the empty set that short-circuits
		// this one.
		$mine    = function ( $query ) {
			return $query instanceof \WP_Query && $query->get( self::SQL_ONLY_QUERY_VAR );
		};
		$capture = function ( $request, $query ) use ( &$sql, $mine ) {
			if ( $mine( $query ) ) {
				$sql = (string) $request;
			}
			return $request;
		};
		$skip    = function ( $posts, $query ) use ( $mine ) {
			return $mine( $query ) ? array() : $posts;
		};

		add_filter( 'posts_request', $capture, 10, 2 );
		add_filter( 'posts_pre_query', $skip, 10, 2 );
		new \WP_Query( $args );
		remove_filter( 'posts_request', $capture, 10 );
		remove_filter( 'posts_pre_query', $skip, 10 );

		return $sql;
	}

	/**
	 * Whether a SELECT statement returns exactly one column, so it can be nested
	 * as an `IN ( … )` subquery.
	 *
	 * @param string $sql SELECT statement.
	 * @return bool
	 */
	protected function isSingleColumnSelect( $sql ) {
		if ( ! preg_match( '/^\s*SELECT\s+(?:SQL_CALC_FOUND_ROWS\s+)?(?:DISTINCT\s+)?(.*?)\s+FROM\s/is', (string) $sql, $matches ) ) {
			return false;
		}

		$columns = trim( $matches[1] );
		if ( '' === $columns ) {
			return false;
		}

		// A comma inside a function call is still one column, so only the ones at
		// the top level split the list.
		$depth = 0;
		$len   = strlen( $columns );
		for ( $i = 0; $i < $len; $i++ ) {
			if ( '(' === $columns[ $i ] ) {
				++$depth;
			} elseif ( ')' === $columns[ $i ] ) {
				--$depth;
			} elseif ( ',' === $columns[ $i ] && $depth < 1 ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Run a paged listing over the videos table for an already-prepared WHERE.
	 *
	 * @param string $where    Prepared WHERE clause, keyword included.
	 * @param int    $page     Page number (1-based).
	 * @param int    $per_page Items per page.
	 * @return object Object with total, per_page, page and data (array of Video models).
	 */
	protected function pagedResults( $where, $page, $per_page ) {
		global $wpdb;

		$page     = max( 1, (int) $page );
		$per_page = min( 200, max( 1, (int) $per_page ) );
		$table    = $wpdb->prefix . $this->table;

		$total = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- custom table.
			"SELECT count(id) FROM {$table} {$where}" // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared -- Table name is a class property; $where is prepared by the caller.
		);

		$results = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- custom table.
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared -- Table name is a class property; $where is prepared by the caller.
			"SELECT * FROM {$table} {$where} ORDER BY `id` DESC " . $wpdb->prepare( 'LIMIT %d OFFSET %d', $per_page, $per_page * ( $page - 1 ) )
		);

		return (object) array(
			'total'    => $total,
			'per_page' => $per_page,
			'page'     => $page,
			'data'     => $this->parseResults( $results ),
		);
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

		// Same claim guard as update() (#1181): a brand new row is still a writer,
		// and without this a dedupe-miss (e.g. a swapped video source) mints a row
		// that freely claims a post another live row already owns.
		if ( ! empty( $args['post_id'] ) && $this->postClaimedByOther( (int) $args['post_id'], (int) $this->id ) ) {
			unset( $args['post_id'] );
		}

		$args = $this->maybeAutoCreateTitle( $args );

		// Create.
		return parent::create( $args );
	}

	/**
	 * Update a video record.
	 *
	 * @param array $args Video attributes.
	 * @return Model|\WP_Error
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

		// One reusable video post plays one video, so a row must not claim a post
		// another live row already owns — that is what let chapters saved for one
		// video land on another (#1181). Guarding here rather than in the REST
		// controller covers every writer: the editor's create and update routes,
		// the abilities, and anything added later.
		if ( ! empty( $args['post_id'] ) && $this->postClaimedByOther( (int) $args['post_id'], (int) $this->id ) ) {
			unset( $args['post_id'] );
			// A write that was nothing but the pointer has nothing left to do, and
			// answering "saved" would tell the caller the video moved when it did
			// not. Writes that carry other fields still go through with the pointer
			// dropped, so a rename never fails over a pointer nobody asked about.
			if ( ! $args ) {
				return new \WP_Error(
					'post_already_claimed',
					__( 'Another video already points at that video post.', 'presto-player' ),
					array( 'status' => 409 )
				);
			}
		}

		return parent::update( $args );
	}

	/**
	 * Whether another live row already points at this reusable video post.
	 *
	 * Only pp_video_block posts are exclusive — a regular post or page legitimately
	 * embeds many videos.
	 *
	 * @param int $post_id  Post the row wants to claim.
	 * @param int $video_id The row doing the claiming, excluded from the count.
	 * @return bool
	 */
	protected function postClaimedByOther( $post_id, $video_id ) {
		if ( ! $post_id || 'pp_video_block' !== get_post_type( $post_id ) ) {
			return false;
		}

		global $wpdb;
		return (bool) (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- ownership count for a single write.
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->prefix}presto_player_videos WHERE post_id = %d AND id != %d AND (deleted_at IS NULL OR deleted_at = '0000-00-00 00:00:00')",
				$post_id,
				$video_id
			)
		);
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
