<?php
/**
 * Chapter abilities (grouped).
 *
 * @package PrestoPlayer
 * @subpackage Services\Abilities\Abilities
 */

namespace PrestoPlayer\Services\Abilities\Abilities;

use PrestoPlayer\Services\Abilities\Ability;

/**
 * Reads chapters from either the reusable block attributes or the
 * [presto_player_chapter] shortcodes embedded in the post content.
 */
class ChaptersListAbility extends Ability {

	/**
	 * {@inheritDoc}
	 */
	public function getName() {
		return 'presto-player/chapters-list';
	}

	/**
	 * {@inheritDoc}
	 */
	public function getLabel() {
		return __( 'List video chapters', 'presto-player' );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getDescription() {
		return __( 'Returns the chapters defined on a Presto Player video (either block attributes or [presto_player_chapter] shortcodes).', 'presto-player' );
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
			'required'   => array( 'post_id', 'chapters', 'total' ),
			'properties' => array(
				'post_id'  => array( 'type' => 'integer' ),
				'chapters' => array(
					'type'  => 'array',
					'items' => array(
						'type'       => 'object',
						'properties' => array(
							'time'  => array( 'type' => 'string' ),
							'title' => array( 'type' => 'string' ),
						),
					),
				),
				'total'    => array( 'type' => 'integer' ),
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
			return new \WP_Error( 'forbidden', __( 'You are not allowed to read this video.', 'presto-player' ), array( 'status' => 403 ) );
		}
		// The post this row points at plays a different row's video, so its chapters
		// belong to that video — handing them back as this one's is the bug in #1181.
		if ( $this->videoBlockBelongsToOther( $post_id, $video_id ) ) {
			return new \WP_Error(
				'video_block_not_found',
				__( 'That video has no player block in the post it points at — the post plays a different Media Hub video, so it has no chapters of its own. See shares_post_with on presto-player/get-video.', 'presto-player' ),
				array(
					'status'           => 409,
					'shares_post_with' => $this->videoIdsSharingPost( $post_id, $video_id ),
				)
			);
		}

		$chapters = $video_id ? $this->chaptersForVideo( parse_blocks( $post->post_content ), $video_id ) : null;
		if ( null === $chapters ) {
			$chapters = $this->chaptersFromBlocks( $post->post_content );
			if ( empty( $chapters ) ) {
				$chapters = $this->chaptersFromShortcodes( $post->post_content );
			}
		}

		return array(
			'post_id'  => $post_id,
			'chapters' => $chapters,
			'total'    => count( $chapters ),
		);
	}

	/**
	 * Read chapters from the reusable video block's "chapters" attribute.
	 *
	 * @param string $content Post content.
	 * @return array<int, array<string, mixed>>
	 */
	protected function chaptersFromBlocks( $content ) {
		if ( ! function_exists( 'parse_blocks' ) || '' === trim( (string) $content ) ) {
			return array();
		}
		$blocks = parse_blocks( $content );
		foreach ( $blocks as $block ) {
			$found = $this->findChapters( $block );
			if ( ! empty( $found ) ) {
				return $found;
			}
		}
		return array();
	}

	/**
	 * Chapters stored on the block that renders one specific media-hub row.
	 *
	 * Matched on the block's own `id` attribute, the same way
	 * CreatesReusableVideos::patchVideoBlockAttrs() picks its target.
	 *
	 * @param array<int|string, mixed> $blocks   Parsed blocks.
	 * @param int                      $video_id Media-hub video ID.
	 * @return array<int, array<string, mixed>>|null Null when no block here renders that row.
	 */
	protected function chaptersForVideo( array $blocks, $video_id ) {
		foreach ( $blocks as $block ) {
			if ( ! empty( $block['blockName'] )
				&& 0 === strpos( $block['blockName'], 'presto-player/' )
				&& isset( $block['attrs']['id'] )
				&& (int) $block['attrs']['id'] === (int) $video_id ) {
				$chapters = isset( $block['attrs']['chapters'] ) && is_array( $block['attrs']['chapters'] ) ? $block['attrs']['chapters'] : array();
				return $this->normalizeChapterRows( $chapters );
			}
			if ( ! empty( $block['innerBlocks'] ) ) {
				$found = $this->chaptersForVideo( $block['innerBlocks'], $video_id );
				if ( null !== $found ) {
					return $found;
				}
			}
		}
		return null;
	}

	/**
	 * Recursively look for a chapters array on this block or its inner blocks.
	 *
	 * @param array<string, mixed> $block Parsed block array.
	 * @return array<int, array<string, mixed>>
	 */
	protected function findChapters( $block ) {
		if ( isset( $block['attrs']['chapters'] ) && is_array( $block['attrs']['chapters'] ) ) {
			return $this->normalizeChapterRows( $block['attrs']['chapters'] );
		}
		if ( ! empty( $block['innerBlocks'] ) ) {
			foreach ( $block['innerBlocks'] as $inner ) {
				$found = $this->findChapters( $inner );
				if ( ! empty( $found ) ) {
					return $found;
				}
			}
		}
		return array();
	}

	/**
	 * Parse [presto_player_chapter time="..." title="..."] shortcodes.
	 *
	 * @param string $content Post content.
	 * @return array<int, array<string, mixed>>
	 */
	protected function chaptersFromShortcodes( $content ) {
		$out = array();
		if ( false === strpos( (string) $content, '[presto_player_chapter' ) ) {
			return $out;
		}
		if ( preg_match_all( '/\[presto_player_chapter([^\]]*)\]/i', $content, $matches ) ) {
			foreach ( $matches[1] as $attrs_str ) {
				$attrs = shortcode_parse_atts( $attrs_str );
				if ( ! is_array( $attrs ) ) {
					continue;
				}
				$out[] = array(
					'time'  => isset( $attrs['time'] ) ? (string) $attrs['time'] : '',
					'title' => isset( $attrs['title'] ) ? (string) $attrs['title'] : '',
				);
			}
		}
		return $out;
	}
}

/**
 * Writes a chapter list onto the player block inside a reusable video post —
 * the same place {@see ChaptersListAbility} reads it from.
 */
class ChaptersSaveAbility extends Ability {

	/**
	 * {@inheritDoc}
	 */
	public function getName() {
		return 'presto-player/chapters-save';
	}

	/**
	 * {@inheritDoc}
	 */
	public function getLabel() {
		return __( 'Save video chapters', 'presto-player' );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getDescription() {
		return __( 'Stores a chapter list on a Presto Player video. Replaces every existing chapter — pass the full list you want to end up with, or an empty array to remove them all. Takes the exact shape presto-player/chapters-list returns, so the output of presto-player/chapters-generate-from-captions-deterministic can be passed straight through. Only the chapters are touched: the preset, poster and everything else set in the editor survive.', 'presto-player' );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getAnnotations() {
		// Destructive because the existing chapter list is replaced, not merged —
		// the previous chapters are gone once this runs.
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
			'required'             => array( 'chapters' ),
			'properties'           => array(
				'video_id' => array(
					'type'        => 'integer',
					'description' => __( 'The media-hub video_id returned by a create-video-* ability. Resolved to its reusable video post.', 'presto-player' ),
				),
				'post_id'  => array(
					'type'        => 'integer',
					'description' => __( 'The pp_video_block post ID — the N in [presto_player id=N]. Use this when you already have the WordPress post ID instead of a media-hub video_id.', 'presto-player' ),
				),
				'chapters' => array(
					'type'        => 'array',
					'description' => __( 'The complete chapter list to store. Anything already saved is replaced.', 'presto-player' ),
					'items'       => array(
						'type'                 => 'object',
						'additionalProperties' => false,
						'required'             => array( 'time', 'title' ),
						'properties'           => array(
							'time'  => array(
								'type'        => 'string',
								'description' => __( 'Chapter start time as minutes:seconds, e.g. "1:30". Minutes run past 59 for long videos ("75:00"); an HH:MM:SS value is folded down to this form.', 'presto-player' ),
							),
							'title' => array(
								'type'        => 'string',
								'description' => __( 'Chapter title shown on the player marker.', 'presto-player' ),
							),
						),
					),
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
			'required'   => array( 'post_id', 'chapters', 'total' ),
			'properties' => array(
				'post_id'  => array( 'type' => 'integer' ),
				'chapters' => array(
					'type'  => 'array',
					'items' => array(
						'type'       => 'object',
						'properties' => array(
							'time'  => array( 'type' => 'string' ),
							'title' => array( 'type' => 'string' ),
						),
					),
				),
				'total'    => array( 'type' => 'integer' ),
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
			return new \WP_Error( 'forbidden', __( 'You are not allowed to edit this video.', 'presto-player' ), array( 'status' => 403 ) );
		}
		// Refuse rather than write into the neighbour: the only player block in this
		// post renders a different Media Hub row, and saving here would move that
		// video's chapters (#1181).
		if ( $this->videoBlockBelongsToOther( $post_id, $video_id ) ) {
			return new \WP_Error(
				'video_block_not_found',
				__( 'That video has no player block in the post it points at — the post plays a different Media Hub video, so saving chapters here would change the wrong video. See shares_post_with on presto-player/get-video.', 'presto-player' ),
				array(
					'status'           => 409,
					'shares_post_with' => $this->videoIdsSharingPost( $post_id, $video_id ),
				)
			);
		}

		$chapters = $this->sanitizeChapters( isset( $input['chapters'] ) ? $input['chapters'] : null );
		if ( is_wp_error( $chapters ) ) {
			return $chapters;
		}

		$blocks  = parse_blocks( $post->post_content );
		$patched = $this->patchChapters( $blocks, $chapters, $video_id );
		if ( ! $patched && $video_id ) {
			// No block here carries an id at all (content written before the block
			// stored one), so nothing in the post says which row it plays. With
			// another live row on the same post that is a coin flip, and losing it
			// writes the neighbour's chapters — the #1181 corruption this ability
			// refuses above. Only patch blind when this video is the sole claimant.
			$shared = $this->videoIdsSharingPost( $post_id, $video_id );
			if ( $shared ) {
				return new \WP_Error(
					'ambiguous_video',
					__( 'The player block in that post does not say which Media Hub video it plays, and more than one video points at the post — saving chapters here could change the wrong video. See shares_post_with on presto-player/get-video.', 'presto-player' ),
					array(
						'status'           => 409,
						'shares_post_with' => $shared,
					)
				);
			}
			$patched = $this->patchChapters( $blocks, $chapters );
		}
		if ( ! $patched ) {
			return new \WP_Error( 'no_player_block', __( 'This video has no player block to store chapters on.', 'presto-player' ), array( 'status' => 409 ) );
		}

		// wp_insert_post() unslashes what it is given, so pass slashed content or
		// a backslash inside a chapter title is eaten on every save.
		$updated = wp_update_post(
			wp_slash(
				array(
					'ID'           => $post_id,
					'post_content' => serialize_blocks( $blocks ),
				)
			),
			true
		);
		if ( is_wp_error( $updated ) ) {
			return $updated;
		}

		return array(
			'post_id'  => $post_id,
			'chapters' => $chapters,
			'total'    => count( $chapters ),
		);
	}

	/**
	 * Clean the incoming rows down to the {time, title} pairs the block stores.
	 *
	 * @param mixed $chapters Raw chapters input.
	 * @return array<int, array<string, string>>|\WP_Error
	 */
	protected function sanitizeChapters( $chapters ) {
		if ( ! is_array( $chapters ) ) {
			return new \WP_Error( 'invalid_chapters', __( 'A chapters array is required.', 'presto-player' ), array( 'status' => 400 ) );
		}

		$out = array();
		foreach ( $chapters as $row ) {
			$time = ( is_array( $row ) && isset( $row['time'] ) ) ? sanitize_text_field( (string) $row['time'] ) : '';
			$time = $this->normalizeTime( $time );
			if ( '' === $time ) {
				// An unparseable time renders no marker at all, so accepting it would
				// silently drop the row instead of telling the caller it was wrong.
				return new \WP_Error( 'invalid_chapters', __( 'Every chapter needs a time as minutes:seconds, e.g. "1:30".', 'presto-player' ), array( 'status' => 400 ) );
			}
			$out[] = array(
				'time'  => $time,
				'title' => isset( $row['title'] ) ? sanitize_text_field( (string) $row['title'] ) : '',
			);
		}

		return $out;
	}

	/**
	 * Set the chapters attribute on the player block, in place.
	 *
	 * Depth-first so the inner provider block wins over the reusable-edit
	 * wrapper it sits in. Everything else on the block is left untouched, which
	 * is why we patch rather than rebuild the content.
	 *
	 * @param array<int|string, mixed>          $blocks   Parsed blocks, by reference.
	 * @param array<int, array<string, string>> $chapters Chapters to store.
	 * @param int                               $video_id Only patch the block rendering this media-hub row; 0 takes the first player block.
	 * @return bool Whether a player block was found and patched.
	 */
	protected function patchChapters( array &$blocks, array $chapters, $video_id = 0 ) {
		foreach ( $blocks as &$block ) {
			if ( ! empty( $block['innerBlocks'] ) && $this->patchChapters( $block['innerBlocks'], $chapters, $video_id ) ) {
				return true;
			}
			// The provider blocks are the only ones with a chapters attribute, and the
			// only ones whose `id` is a Media Hub row — reusable-display keeps a post
			// id under that name, so scoping by video_id has to skip it.
			if ( empty( $block['blockName'] ) || ! in_array( $block['blockName'], self::PLAYER_BLOCKS, true ) ) {
				continue;
			}
			// A video_id scopes the write to that row's own block, so a post two
			// Media Hub rows point at can't have one video's chapters land on the other.
			if ( $video_id && (int) ( $block['attrs']['id'] ?? 0 ) !== (int) $video_id ) {
				continue;
			}
			$block['attrs']['chapters'] = $chapters;
			return true;
		}
		return false;
	}
}

/**
 * Heuristic chapter generator — splits captions by silence gaps.
 *
 * No AI used. The algorithm scans VTT cues and starts a new chapter
 * every time the gap between two cues exceeds the threshold (default 8s)
 * or the elapsed time exceeds the minimum chapter length.
 */
class ChaptersGenerateFromCaptionsAbility extends Ability {

	/**
	 * {@inheritDoc}
	 */
	public function getName() {
		return 'presto-player/chapters-generate-from-captions-deterministic';
	}

	/**
	 * {@inheritDoc}
	 */
	public function getLabel() {
		return __( 'Auto-generate chapters from captions', 'presto-player' );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getDescription() {
		return __( 'Builds a chapter list from a WebVTT caption track using silence-gap detection. No AI — fully deterministic. Returns chapter markers without writing anything; pass them to presto-player/chapters-save to store them on a video. Each title is taken from the caption text spoken at that point, so it should be reviewed and renamed before saving.', 'presto-player' );
	}

	/**
	 * {@inheritDoc}
	 */
	public function getAnnotations() {
		// Pure transform — it returns chapter markers but never writes anything,
		// so it stays available to read-only connections (presto:read scope).
		return array(
			'readonly'    => true,
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
			'required'             => array( 'vtt' ),
			'properties'           => array(
				'vtt'             => array(
					'type'        => 'string',
					'description' => __( 'WebVTT caption text.', 'presto-player' ),
				),
				'gap_seconds'     => array(
					'type'        => 'integer',
					'default'     => 8,
					'description' => __( 'Silence gap (in seconds) that starts a new chapter.', 'presto-player' ),
				),
				'min_chapter_len' => array(
					'type'        => 'integer',
					'default'     => 60,
					'description' => __( 'Minimum chapter length in seconds.', 'presto-player' ),
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
			'required'   => array( 'chapters', 'total', 'skipped_by_min_chapter_len' ),
			'properties' => array(
				'chapters'                   => array(
					'type'  => 'array',
					'items' => array(
						'type'       => 'object',
						'properties' => array(
							'time'  => array( 'type' => 'string' ),
							'title' => array( 'type' => 'string' ),
						),
					),
				),
				'total'                      => array( 'type' => 'integer' ),
				'skipped_by_min_chapter_len' => array(
					'type'        => 'integer',
					'description' => __( 'How many silence gaps were real chapter breaks but got dropped for landing sooner than min_chapter_len after the previous chapter started. If this is above zero and the chapter list looks too sparse, run the ability again with a smaller min_chapter_len.', 'presto-player' ),
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
		$vtt = isset( $input['vtt'] ) ? (string) $input['vtt'] : '';
		if ( '' === trim( $vtt ) ) {
			return new \WP_Error( 'empty_vtt', __( 'WebVTT input is required.', 'presto-player' ), array( 'status' => 400 ) );
		}
		if ( strlen( $vtt ) > 512000 ) {
			return new \WP_Error( 'vtt_too_large', __( 'WebVTT input exceeds the maximum allowed size.', 'presto-player' ), array( 'status' => 400 ) );
		}
		$gap = isset( $input['gap_seconds'] ) ? max( 1, absint( $input['gap_seconds'] ) ) : 8;
		$min = isset( $input['min_chapter_len'] ) ? max( 1, absint( $input['min_chapter_len'] ) ) : 60;

		$cues = $this->parseCues( $vtt );
		if ( empty( $cues ) ) {
			return new \WP_Error( 'no_cues', __( 'No cues found in VTT.', 'presto-player' ), array( 'status' => 400 ) );
		}

		$chapters     = array();
		$last_end     = 0.0;
		$chapter_open = false;
		$start        = 0.0;
		$title        = '';
		$skipped      = 0;

		foreach ( $cues as $i => $cue ) {
			$is_first    = ( 0 === $i );
			$gap_seconds = $cue['start'] - $last_end;
			$elapsed     = $cue['start'] - $start;

			if ( $is_first || ( $chapter_open && $gap_seconds >= $gap && $elapsed >= $min ) ) {
				if ( $chapter_open ) {
					$chapters[] = array(
						'time'  => $this->formatTime( $start ),
						'title' => $title,
					);
				}
				$start = $cue['start'];
				// Cue text is a spoken sentence, and a trailing full stop reads
				// wrong on a chapter marker.
				$title        = $this->truncate( rtrim( $cue['text'], ' .,;:!?' ), 60 );
				$chapter_open = true;
			} elseif ( $chapter_open && $gap_seconds >= $gap ) {
				++$skipped;
			}
			$last_end = $cue['end'];
		}
		if ( $chapter_open ) {
			$chapters[] = array(
				'time'  => $this->formatTime( $start ),
				'title' => $title,
			);
		}

		return array(
			'chapters'                   => $chapters,
			'total'                      => count( $chapters ),
			'skipped_by_min_chapter_len' => $skipped,
		);
	}

	/**
	 * Parse VTT cue lines into {start, end, text} entries.
	 *
	 * @param string $vtt Raw VTT.
	 * @return array<int, array{start: float, end: float, text: string}>
	 */
	protected function parseCues( $vtt ) {
		$cues  = array();
		$lines = preg_split( "/\r\n|\r|\n/", trim( $vtt ) );
		if ( ! is_array( $lines ) ) {
			return $cues;
		}
		$count = count( $lines );
		for ( $i = 0; $i < $count; $i++ ) {
			$line = trim( $lines[ $i ] );
			if ( '' === $line || 'WEBVTT' === strtoupper( $line ) ) {
				continue;
			}
			if ( false === strpos( $line, '-->' ) ) {
				continue;
			}
			$parts = preg_split( '/\s+-->\s+/', $line );
			if ( ! is_array( $parts ) || count( $parts ) < 2 ) {
				continue;
			}
			$start    = $this->timestampToSeconds( $parts[0] );
			$end_part = preg_replace( '/\s.*$/', '', $parts[1] );
			$end      = $this->timestampToSeconds( null === $end_part ? $parts[1] : $end_part );
			$text     = '';
			$j        = $i + 1;
			while ( $j < $count && '' !== trim( $lines[ $j ] ) ) {
				$text .= ( '' !== $text ? ' ' : '' ) . trim( $lines[ $j ] );
				++$j;
			}
			$cues[] = array(
				'start' => $start,
				'end'   => $end,
				'text'  => $text,
			);
			$i      = $j;
		}
		return $cues;
	}

	/**
	 * Convert VTT timestamp to seconds.
	 *
	 * @param string $ts Timestamp like "00:01:23.456".
	 * @return float
	 */
	protected function timestampToSeconds( $ts ) {
		$ts    = trim( (string) $ts );
		$parts = explode( ':', $ts );
		$h     = 0;
		$m     = 0;
		$s     = 0.0;
		if ( 3 === count( $parts ) ) {
			$h = (int) $parts[0];
			$m = (int) $parts[1];
			$s = (float) str_replace( ',', '.', $parts[2] );
		} elseif ( 2 === count( $parts ) ) {
			$m = (int) $parts[0];
			$s = (float) str_replace( ',', '.', $parts[1] );
		}
		return ( $h * 3600 ) + ( $m * 60 ) + $s;
	}

	/**
	 * Format seconds back to the MM:SS chapter time the player understands.
	 *
	 * The player reads chapter times as minutes:seconds and ignores anything past
	 * the second colon, so an HH:MM:SS value gets parsed as MM:SS — 00:01:45 lands
	 * at 1 second instead of 105, and every chapter in the first hour collapses onto
	 * the same marker. Minutes therefore run past 59 rather than rolling into hours.
	 *
	 * @param float $seconds Seconds since start.
	 * @return string
	 */
	protected function formatTime( $seconds ) {
		$total = max( 0, (int) $seconds );
		return sprintf( '%d:%02d', (int) floor( $total / 60 ), $total % 60 );
	}

	/**
	 * Truncate a string and add ellipsis if it was cut.
	 *
	 * @param string $text  Text to truncate.
	 * @param int    $limit Max characters.
	 * @return string
	 */
	protected function truncate( $text, $limit ) {
		$text = trim( (string) $text );
		if ( mb_strlen( $text ) <= $limit ) {
			return $text;
		}
		return rtrim( mb_substr( $text, 0, $limit ) ) . '…';
	}
}
