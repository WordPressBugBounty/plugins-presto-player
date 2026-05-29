<?php
/**
 * Reusable Video Model.
 *
 * @package PrestoPlayer\Models
 */

namespace PrestoPlayer\Models;

use PrestoPlayer\Blocks\AudioBlock;
use PrestoPlayer\Blocks\VimeoBlock;
use PrestoPlayer\Blocks\YouTubeBlock;
use PrestoPlayer\Blocks\SelfHostedBlock;
use PrestoPlayer\Pro\Blocks\BunnyCDNBlock;
use WP_Query;

/**
 * Reusable Video Model
 */
class ReusableVideo {

	/**
	 * The post object
	 *
	 * @var \WP_Post
	 */
	public $post;

	/**
	 * The post type
	 *
	 * @var string
	 */
	private $post_type = 'pp_video_block';

	/**
	 * The setting name for instant video width option.
	 *
	 * @var string
	 */
	public const INSTANT_VIDEO_WIDTH_SETTING_KEY = 'presto_player_instant_video_width';

	/**
	 * Constructor
	 *
	 * @param int $id The post ID.
	 */
	public function __construct( $id = 0 ) {
		$this->post = \get_post( $id );
		// TODO: remove this no-op return; kept temporarily to avoid changing constructor contract in a patch release.
		// phpcs:ignore Universal.CodeAnalysis.ConstructorDestructorReturn.ReturnValueFound
		return $this;
	}

	/**
	 * Get attributes properties
	 *
	 * @param string $property The property to get.
	 * @return mixed
	 */
	public function __get( $property ) {
		return isset( $this->post->$property ) ? $this->post->$property : null;
	}

	/**
	 * Create a new video post
	 *
	 * @param array $args Arguments to pass to the wp_insert_post function.
	 *
	 * @return int
	 */
	public function create( $args = array() ) {
		return wp_insert_post(
			wp_parse_args(
				$args,
				array(
					'post_type' => $this->post_type,
				)
			)
		);
	}

	/**
	 * Fetch video posts
	 *
	 * @param array $args Arguments to pass to the WP_Query.
	 *
	 * @return \WP_Post[]
	 */
	public function fetch( $args = array() ) {
		$args = wp_parse_args(
			$args,
			array(
				'post_type'   => $this->post_type,
				'post_status' => array( 'publish' ),
			)
		);

		return ( new WP_Query( $args ) )->posts;
	}

	/**
	 * Get all video posts
	 *
	 * @param array $args Arguments to pass to the fetch method.
	 *
	 * @return \WP_Post[]
	 */
	public function all( $args = array() ) {
		$args = wp_parse_args(
			$args,
			array(
				'post_type'      => $this->post_type,
				'posts_per_page' => -1,
			)
		);

		return get_posts( $args );
	}

	/**
	 * Get the first video post
	 *
	 * @param array $args Arguments to pass to the fetch method.
	 *
	 * @return ReusableVideo|bool
	 */
	public function first( $args = array() ) {
		$fetched = $this->fetch( wp_parse_args( $args, array( 'posts_per_page' => 1 ) ) );
		return ! empty( $fetched[0] ) ? new static( $fetched[0] ) : false;
	}

	/**
	 * Get block from video post
	 *
	 * @return array
	 */
	public function getBlock() {
		if ( empty( $this->post->post_content ) ) {
			return array();
		}
		$blocks = \parse_blocks( $this->post->post_content );

		if ( empty( $blocks[0]['innerBlocks'] ) ) {
			return $blocks[0];
		}

		return ! empty( $blocks[0]['innerBlocks'][0] ) ? $blocks[0]['innerBlocks'][0] : array();
	}

	/**
	 * Get the WordPress post status of the underlying Media Hub item.
	 *
	 * Returns the raw post_status string (e.g. `publish`, `private`, `draft`)
	 * when the loaded post is a Media Hub item, or null when the post is
	 * missing or of a different type. Callers decide policy from the value;
	 * this method is intentionally data-only.
	 *
	 * @return string|null
	 */
	public function getMediaHubPostVisibility() {
		if ( ! $this->post ) {
			return null;
		}
		if ( $this->post_type !== $this->post->post_type ) {
			return null;
		}
		return $this->post->post_status;
	}

	/**
	 * Get attributes from the block
	 *
	 * @param array $overrides Attributes to override.
	 *
	 * @return array
	 */
	public function getAttributes( $overrides = array() ) {
		$block = $this->getBlock();
		if ( empty( $block ) ) {
			return '';
		}

		// Allow overriding attributes.
		$block['attrs'] = wp_parse_args( $overrides, (array) $block['attrs'] );

		// Maybe switch provider depending on url.
		if ( ! empty( $overrides ) ) {
			$block = $this->maybeSwitchProvider( $block );
		}

		switch ( $block['blockName'] ) {
			case 'presto-player/self-hosted':
				return ( new SelfHostedBlock() )->getAttributes( $block['attrs'] );

			case 'presto-player/youtube':
				return ( new YouTubeBlock() )->getAttributes( $block['attrs'] );

			case 'presto-player/vimeo':
				return ( new VimeoBlock() )->getAttributes( $block['attrs'] );

			case 'presto-player/audio':
				return ( new AudioBlock() )->getAttributes( $block['attrs'] );

			case 'presto-player/bunny':
				return class_exists( BunnyCDNBlock::class ) ?
					( new BunnyCDNBlock() )->getAttributes( $block['attrs'] ) :
					( new SelfHostedBlock() )->getAttributes( $block['attrs'] ); // in case BunnyCDN is not installed.
		}
	}

	/**
	 * Render block from video post
	 *
	 * @param array $overrides Attributes to override.
	 *
	 * @return string
	 */
	public function renderBlock( $overrides = array() ) {
		$block = $this->getBlock();

		if ( empty( $block ) ) {
			return '';
		}

		// Allow overriding attributes.
		$block['attrs'] = wp_parse_args( $overrides, (array) $block['attrs'] );

		// Maybe switch provider depending on url.
		$block = $this->maybeSwitchProvider( $block );

		// remove attachment_id if the src changes.
		if ( ! empty( $overrides['src'] ) ) {
			$block['attrs']['attachment_id'] = null;
		}

		switch ( $block['blockName'] ) {
			case 'presto-player/self-hosted':
				return ( new SelfHostedBlock( true, '1' ) )->html( $block['attrs'], '' );

			case 'presto-player/youtube':
				return ( new YouTubeBlock( true, '1' ) )->html( $block['attrs'], '' );

			case 'presto-player/vimeo':
				return ( new VimeoBlock( true, '1' ) )->html( $block['attrs'], '' );

			case 'presto-player/bunny':
				return class_exists( BunnyCDNBlock::class ) ? ( new BunnyCDNBlock( true, '1' ) )->html( $block['attrs'], '' ) : '';

			case 'presto-player/audio':
				return ( new AudioBlock( true, '1' ) )->html( $block['attrs'], '' );
		}
	}

	/**
	 * Maybe switch provider if the url is overridden
	 *
	 * @param array $block The block to check.
	 */
	protected function maybeSwitchProvider( $block ) {
		if ( empty( $block ) || ! is_array( $block ) ) {
			return $block;
		}

		if ( ! empty( $block['attrs']['src'] ) ) {
			if ( $block['attrs']['src'] ) {
				$filetype = wp_check_filetype( $block['attrs']['src'] );
				if ( isset( $filetype['type'] ) && false !== strpos( $filetype['type'], 'audio' ) ) {
					$block['blockName'] = 'presto-player/audio';
					return $block;
				}
			}

			$yt_rx             = '/^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?$/';
			$has_match_youtube = preg_match( $yt_rx, $block['attrs']['src'], $yt_matches );

			if ( $has_match_youtube ) {
				$block['blockName'] = 'presto-player/youtube';
				return $block;
			}

			$vm_rx           = '/(https?:\/\/)?(www\.)?(player\.)?vimeo\.com\/([a-z]*\/)*([‌​0-9]{6,11})[?]?.*/';
			$has_match_vimeo = preg_match( $vm_rx, $block['attrs']['src'], $vm_matches );

			if ( $has_match_vimeo ) {
				$block['blockName'] = 'presto-player/vimeo';
				return $block;
			}

			if ( empty( $block['blockName'] ) ) {
				$block['blockName'] = 'presto-player/self-hosted';
				return $block;
			}
		}

		return $block;
	}

	/**
	 * Get reusable video block function.
	 *
	 * @return string The content of the block.
	 */
	public function content() {
		return ! empty( $this->post->post_content ) ? $this->post->post_content : '';
	}

	/**
	 * Retrieves the poster image URL from the first
	 * 'presto-player/reusable-edit' block in the post content.
	 *
	 * @return string|bool The poster image URL or false if not set.
	 */
	public function getPosterFromBlock() {
		$block = $this->getBlock();

		if ( empty( $block ) ) {
			return false;
		}

		// Attempt to extract the poster attribute from the first inner block.
		return $block['attrs']['poster'] ?? '';
	}

	/**
	 * Get the count of published video posts.
	 *
	 * @return int
	 */
	public function getTotalPublished() {
		$counts = wp_count_posts( $this->post_type );
		return isset( $counts->publish ) ? (int) $counts->publish : 0;
	}

	/**
	 * Check if instant video page is enabled
	 *
	 * @return bool
	 */
	public function instantVideoPageEnabled() {
		if ( empty( $this->post->ID ) ) {
			return false;
		}
		return get_post_meta( $this->post->ID, 'presto_player_instant_video_pages_enabled', true );
	}

	/**
	 * Get instant video width.
	 *
	 * @return string|bool The video width + unit.
	 */
	public function getInstantVideoWidth() {
		if ( empty( $this->post->ID ) ) {
			return false;
		}
		$config = get_option( self::INSTANT_VIDEO_WIDTH_SETTING_KEY, '800px' );
		return ! empty( $config ) ? $config : '800px';
	}

	/**
	 * Duplicate the media post, including taxonomies, thumbnail, and meta.
	 *
	 * @return array|\WP_Error {
	 *     Duplication result or WP_Error on failure.
	 *
	 *     @type int $new_post_id  ID of the newly created post.
	 *     @type int $thumbnail_id Thumbnail ID copied from the original post.
	 * }
	 */
	public function duplicate() {
		if ( empty( $this->post->ID ) ) {
			return new \WP_Error( 'invalid_post', __( 'Invalid post ID.', 'presto-player' ) );
		}

		// Prepare new post data.
		$new_post_args = array(
			'post_title'     => isset( $this->post->post_title ) ? $this->post->post_title . ' - Copy' : '',
			'post_type'      => $this->post->post_type,
			'post_status'    => 'draft',
			'post_author'    => get_current_user_id(),
			'post_content'   => $this->post->post_content ?? '',
			'post_excerpt'   => $this->post->post_excerpt ?? '',
			'comment_status' => $this->post->comment_status ?? 'open',
			'ping_status'    => $this->post->ping_status ?? 'open',
			'page_template'  => get_post_meta( $this->post->ID, '_wp_page_template', true ),
		);

		$new_post_id = wp_insert_post( wp_slash( $new_post_args ), true );

		if ( is_wp_error( $new_post_id ) ) {
			return new \WP_Error(
				'failed_duplicate',
				__( 'Failed to duplicate.', 'presto-player' )
			);
		}

		// Copy taxonomy terms using slugs.
		$this->copyTaxonomies( $new_post_id );

		// Copy featured image.
		$thumbnail_id = $this->copyThumbnail( $new_post_id );

		// Copy post meta except for editor-specific keys.
		$this->copyMeta( $new_post_id );

		return array(
			'new_post_id'  => $new_post_id,
			'thumbnail_id' => $thumbnail_id,
		);
	}

	/**
	 * Copy taxonomy terms from the original media to the duplicated one.
	 *
	 * @param int $new_post_id New post ID.
	 *
	 * @return void
	 */
	protected function copyTaxonomies( $new_post_id ) {
		$taxonomies = get_object_taxonomies( $this->post->post_type ?? '' );

		foreach ( $taxonomies as $taxonomy ) {
			$terms = wp_get_object_terms(
				$this->post->ID,
				$taxonomy,
				array(
					'fields' => 'slugs',
				)
			);

			if ( ! empty( $terms ) && ! is_wp_error( $terms ) ) {
				wp_set_object_terms( $new_post_id, $terms, $taxonomy );
			}
		}
	}

	/**
	 * Copy the featured image from the original media to the duplicated one.
	 *
	 * @param int $new_post_id New post ID.
	 *
	 * @return int Thumbnail ID if one was copied, otherwise 0.
	 */
	protected function copyThumbnail( $new_post_id ) {
		$thumbnail_id = get_post_thumbnail_id( $this->post->ID );

		if ( $thumbnail_id ) {
			set_post_thumbnail( $new_post_id, $thumbnail_id );
		}

		return (int) $thumbnail_id;
	}

	/**
	 * Copy post meta from the original media to the duplicated one.
	 *
	 * @param int $new_post_id New post ID.
	 *
	 * @return void
	 */
	protected function copyMeta( $new_post_id ) {
		$post_meta = get_post_meta( $this->post->ID );

		if ( empty( $post_meta ) ) {
			return;
		}

		foreach ( $post_meta as $meta_key => $meta_values ) {
			// Skip _wp_page_template and _thumbnail_id as they're already handled.
			if ( '_wp_page_template' === $meta_key || '_thumbnail_id' === $meta_key ) {
				continue;
			}

			foreach ( $meta_values as $meta_value ) {
				add_post_meta( $new_post_id, $meta_key, maybe_unserialize( $meta_value ) );
			}
		}
	}

	/**
	 * Build the API response payload for a duplicated media item.
	 *
	 * @param int $new_post_id  New post ID.
	 * @param int $thumbnail_id Thumbnail ID copied from the original post.
	 *
	 * @return array
	 */
	public function buildDuplicateResponse( $new_post_id, $thumbnail_id ) {
		$new_post = get_post( $new_post_id );

		// Get tags for the new post.
		$tags      = array();
		$tag_terms = wp_get_object_terms( $new_post_id, 'pp_video_tag' );

		if ( ! is_wp_error( $tag_terms ) && is_array( $tag_terms ) ) {
			foreach ( $tag_terms as $tag_term ) {
				$tags[] = array(
					'id'   => $tag_term->term_id,
					'name' => $tag_term->name,
					'slug' => $tag_term->slug,
				);
			}
		}

		// Get author info.
		$author_id = (int) get_post_field( 'post_author', $new_post_id );

		// Get poster image from post meta or featured image.
		$poster_image   = null;
		$reusable_video = new self( $new_post_id );
		$video_details  = $reusable_video->getAttributes();

		if ( ! empty( $video_details['poster'] ) ) {
			$poster_image = $video_details['poster'];
		} elseif ( $thumbnail_id ) {
			$poster_image = wp_get_attachment_image_url( $thumbnail_id, 'full' );
		}

		return array(
			'message' => __( 'Successfully duplicated.', 'presto-player' ),
			'media'   => array(
				'id'           => $new_post_id,
				'title'        => html_entity_decode( get_the_title( $new_post_id ) ),
				'post_date'    => $new_post->post_date,
				'status'       => $new_post->post_status,
				'shortcode'    => '[presto_player id=' . $new_post_id . ']',
				'poster_image' => $poster_image,
				'tags'         => ! empty( $tags ) ? $tags : null,
				'author'       => array(
					'id'   => $author_id,
					'name' => get_the_author_meta( 'display_name', $author_id ),
				),
			),
		);
	}
}
