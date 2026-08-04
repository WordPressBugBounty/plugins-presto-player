<?php
/**
 * Post model for finding the presto player video in post content.
 *
 * @package PrestoPlayer
 */

namespace PrestoPlayer\Models;

/**
 * Finds the presto player video id in a post's content.
 */
class Post {

	/**
	 * The post being searched.
	 *
	 * @var \WP_Post
	 */
	protected $post;

	/**
	 * Ids of posts we have already followed a shortcode into.
	 *
	 * A [presto_player id=...] can point back at its own post, or at a post
	 * that points back here. Without this we'd recurse until memory runs out.
	 *
	 * @var array<int, bool>
	 */
	protected $visited = array();

	/**
	 * Constructor.
	 *
	 * @param \WP_Post $post The post to search.
	 */
	public function __construct( \WP_Post $post ) {
		$this->post                       = $post;
		$this->visited[ (int) $post->ID ] = true;
	}

	/**
	 * Find video id in post using multiple methods
	 *
	 * @return int|false
	 */
	public function findVideoId() {
		// first check for id in block.
		$id = $this->getVideoIdFromBlock();
		if ( $id ) {
			return (int) $id;
		}

		$id = $this->getVideoIdFromShortcode();
		if ( $id ) {
			return (int) $id;
		}

		$id = $this->getVideoIdFromContent();
		if ( $id ) {
			return (int) $id;
		}

		return false;
	}

	/**
	 * Find the video id from the shortcode
	 *
	 * @return int|false
	 */
	public function getVideoIdFromShortcode() {
		// Scope the regex to our own tag so the shortcode is still found when
		// nested inside an enclosing shortcode (e.g. [trp_language]).
		$pattern = get_shortcode_regex( array( 'presto_player' ) );
		$content = $this->post->post_content;

		// false when PCRE hits a backtrack/JIT limit on huge content, 0 when there is no shortcode.
		if ( ! preg_match_all( "/$pattern/", $content, $matches ) ) {
			return false;
		}

		// the regex only matches our own tag, so every match is a candidate.
		foreach ( array_keys( $matches[2] ) as $index ) {
			// [[presto_player]] is escaped: it renders as literal text, so there is no video.
			if ( '[' === $matches[1][ $index ] && ']' === $matches[6][ $index ] ) {
				continue;
			}

			if ( empty( $matches[3][ $index ] ) ) {
				continue;
			}

			// get media hub id.
			$atts = shortcode_parse_atts( $matches[3][ $index ] );
			if ( empty( $atts['id'] ) ) {
				continue;
			}

			// already been here - it's a self-reference or a loop.
			$id = (int) $atts['id'];
			if ( isset( $this->visited[ $id ] ) ) {
				continue;
			}

			$post = get_post( $id );
			// the id can point at a deleted media hub item.
			if ( ! $post instanceof \WP_Post ) {
				continue;
			}

			$this->visited[ $id ] = true;
			$original             = $this->post;
			$this->post           = $post;

			$video_id = $this->findVideoId();
			if ( $video_id ) {
				return $video_id;
			}

			// put our own post back, or findVideoId() carries on searching the
			// post we just followed instead of this one.
			$this->post = $original;
		}

		return false;
	}

	/**
	 * Get the video id from the block
	 */
	public function getVideoIdFromBlock() {
		$blocks = parse_blocks( $this->post->post_content );
		foreach ( $blocks as $block ) {
			// inside wrapper block.
			if ( 'presto-player/reusable-edit' === $block['blockName'] && ! empty( $block['innerBlocks'] ) ) {
				$block = $block['innerBlocks'][0];
			}

			// we have a reusable display block.
			if ( 'presto-player/reusable-display' === $block['blockName'] ) {
				// find the media hub post.
				if ( ! empty( $block['attrs']['id'] ) ) {
					$block = self::getMediaHubBlockFromPost( $block['attrs']['id'] );
				}
			}

			// in case block needs to be filtered.
			$block = apply_filters( 'presto_player_get_block_from_content', $block );

			// find the id attribute.
			if ( ! empty( $block ) && in_array( $block['blockName'], Block::getBlockTypes() ) ) {
				if ( ! empty( $block['attrs']['id'] ) ) {
					return $block['attrs']['id'];
				}
			}
		}

		return false;
	}

	/**
	 * Fallback - get video id from comment in content
	 */
	public function getVideoIdFromContent() {
		$content = $this->post->post_content;

		preg_match_all( '/(?<=<!--presto-player:video_id=)(.*)(?=-->)/', $content, $matches );
		if ( ! empty( $matches[0][0] ) ) {
			return (int) $matches[0][0];
		}

		return false;
	}

	/**
	 * Retrieve the inner block from media hub post.
	 *
	 * @param  int $id id of the post.
	 * @return array|false
	 */
	public static function getMediaHubBlockFromPost( $id ) {
		if ( ! $id ) {
			return false;
		}

		// get the media hub post.
		$block_post = get_post( $id );

		// if it has content, get the first block.
		if ( ! empty( $block_post->post_content ) ) {
			$inner_blocks = parse_blocks( $block_post->post_content );
			if ( ! empty( $inner_blocks[0]['innerBlocks'][0] ) ) {
				return $inner_blocks[0]['innerBlocks'][0] ?? false;
			}
		}

		return false;
	}
}
