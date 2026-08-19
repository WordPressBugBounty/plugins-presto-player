<?php
/**
 * Shared video-creation flow for the per-provider create abilities.
 *
 * @package PrestoPlayer
 * @subpackage Services\Abilities\Concerns
 */

namespace PrestoPlayer\Services\Abilities\Concerns;

use PrestoPlayer\Models\AudioPreset;
use PrestoPlayer\Models\Preset;
use PrestoPlayer\Models\ReusableVideo;
use PrestoPlayer\Models\Video;

/**
 * End-to-end "create a usable video" flow shared by every provider create
 * ability: it stores the Media Hub video, materializes the reusable
 * pp_video_block post, publishes a page that plays it, and returns a link plus
 * a shortcode. Both free (extends Ability) and pro (extends ProAbstractAbility)
 * abilities use this trait, so the logic lives in one place.
 */
trait CreatesReusableVideos {

	/**
	 * Run the full flow for a provider: resolve source, upsert the Media Hub
	 * video, materialize its reusable post, and return the embeddable result.
	 *
	 * @param string               $type  Provider type (youtube/vimeo/self-hosted/bunny).
	 * @param array<string, mixed> $input Validated ability input.
	 * @return array<string, mixed>|\WP_Error
	 */
	protected function createReusableVideoForSource( $type, array $input ) {
		$source = $this->resolveVideoSource( $input, $type );
		if ( is_wp_error( $source ) ) {
			return $source;
		}
		list( $where, $attrs ) = $source;

		$title = $this->resolveVideoTitle( $input, $attrs, $type );
		if ( '' !== $title ) {
			$attrs['title'] = $title;
		}

		$existing = ( new Video() )->findWhere( $where );
		if ( $existing instanceof Video ) {
			$existing_arr = $existing->toArray();
			if ( ! current_user_can( 'edit_others_posts' ) && get_current_user_id() !== (int) ( $existing_arr['created_by'] ?? 0 ) ) {
				return new \WP_Error( 'forbidden', __( 'You are not allowed to access this video.', 'presto-player' ), array( 'status' => 403 ) );
			}
			// Idempotent: the same source is the same video, so reuse the existing
			// row and its post. Notably we do NOT write the incoming title over
			// it — a create call that happened to pass a URL already in the
			// library was silently renaming someone else's video and handing back
			// its shortcode as if it were new. Renaming is update-video's job.
			return $this->respondWithReusableVideo( $existing, $input, true );
		}

		$video = ( new Video() )->updateOrCreate( $where, $attrs );
		if ( is_wp_error( $video ) ) {
			return $video;
		}
		if ( ! $video instanceof Video ) {
			return new \WP_Error( 'create_failed', __( 'Could not create the video record.', 'presto-player' ), array( 'status' => 500 ) );
		}

		return $this->respondWithReusableVideo( $video, $input );
	}

	/**
	 * Materialize the reusable post for a video and build the success payload.
	 *
	 * @param Video                $video  Media Hub video.
	 * @param array<string, mixed> $input  Ability input (used for status).
	 * @param bool                 $reused Whether an existing video was matched.
	 * @return array<string, mixed>|\WP_Error
	 */
	protected function respondWithReusableVideo( Video $video, array $input, $reused = false ) {
		$status  = ( isset( $input['status'] ) && in_array( $input['status'], array( 'publish', 'draft' ), true ) ) ? $input['status'] : 'publish';
		$post_id = $this->materializeReusableVideoPost( $video, $status );
		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}
		$post_id = (int) $post_id;

		// Publish a page that embeds the video, so the caller gets a ready-to-open
		// link — not just a shortcode to paste. Pages are a separate post type with
		// its own caps: the create-video abilities only require publish_posts, so an
		// Author gets the shortcode without a page rather than a page they aren't
		// allowed to create.
		$page_id = 0;
		if ( $this->canCreateVideoPage( $status ) ) {
			$page_id = $this->ensureVideoPage( $post_id, (string) $video->title, $status );
			if ( is_wp_error( $page_id ) ) {
				return $page_id;
			}
		}

		return $this->reusableVideoPayload( $video, $post_id, (int) $page_id, $reused );
	}

	/**
	 * Whether the current user may create the wrapper page at this status.
	 *
	 * @param string $status Post status the page would be created with.
	 * @return bool
	 */
	protected function canCreateVideoPage( $status ) {
		return 'publish' === $status
			? current_user_can( 'publish_pages' )
			: current_user_can( 'edit_pages' );
	}

	/**
	 * Meta key linking a reusable video post to its published page.
	 *
	 * @var string
	 */
	private static $page_meta_key = '_pp_video_page_id';

	/**
	 * Publish (or reuse) a page that embeds the reusable video and return its ID.
	 * Linked to the reusable post via meta so repeat idempotent creates don't
	 * spawn duplicate pages.
	 *
	 * @param int    $post_id Reusable pp_video_block post ID.
	 * @param string $title   Video title, used as the page title.
	 * @param string $status  Post status to create the page with.
	 * @return int|\WP_Error
	 */
	protected function ensureVideoPage( $post_id, $title, $status = 'publish' ) {
		$post_id  = (int) $post_id;
		$existing = (int) get_post_meta( $post_id, self::$page_meta_key, true );
		if ( $existing && 'page' === get_post_type( $existing ) && 'trash' !== get_post_status( $existing ) ) {
			return $existing;
		}

		$page_id = wp_insert_post(
			array(
				'post_type'    => 'page',
				'post_title'   => '' !== $title ? $title : __( 'Video', 'presto-player' ),
				// Mirror the video's status: a draft video must not end up
				// wrapped in a publicly reachable page.
				'post_status'  => in_array( $status, array( 'publish', 'draft' ), true ) ? $status : 'publish',
				'post_content' => '<!-- wp:presto-player/reusable-display ' . wp_json_encode( array( 'id' => $post_id ) ) . ' /-->',
			),
			true
		);
		if ( is_wp_error( $page_id ) ) {
			return $page_id;
		}
		update_post_meta( $post_id, self::$page_meta_key, (int) $page_id );
		return (int) $page_id;
	}

	/**
	 * Shared output schema for the provider create abilities.
	 *
	 * @return array<string, mixed>
	 */
	protected function reusableVideoOutputSchema() {
		return array(
			'type'       => 'object',
			'required'   => array( 'title', 'url', 'shortcode' ),
			'properties' => array(
				'title'     => array(
					'type'        => 'string',
					'description' => __( 'The video title.', 'presto-player' ),
				),
				'url'       => array(
					'type'        => 'string',
					'description' => __( 'Link to open the video — a page that plays it, created with the same status as the video. Empty if you cannot create pages.', 'presto-player' ),
				),
				'shortcode' => array(
					'type'        => 'string',
					'description' => __( 'Shortcode to embed the video anywhere.', 'presto-player' ),
				),
				'video_id'  => array( 'type' => 'integer' ),
				'post_id'   => array( 'type' => 'integer' ),
				'reused'    => array(
					'type'        => 'boolean',
					'description' => __( 'True when this source was already in the library, so an existing video was returned instead of a new one being created. Its title is left untouched.', 'presto-player' ),
				),
			),
		);
	}

	/**
	 * Resolve the request into matching (where) and stored (attrs) video columns.
	 *
	 * Precedence: guid/external_id, then attachment_id, then url. Each provider
	 * ability exposes only the source keys relevant to it.
	 *
	 * @param array<string, mixed> $input Ability input.
	 * @param string               $type  Provider type.
	 * @return array{0: array<string, mixed>, 1: array<string, mixed>}|\WP_Error
	 */
	protected function resolveVideoSource( array $input, $type ) {
		$where = array( 'type' => $type );
		$attrs = array( 'type' => $type );

		$external = '';
		if ( ! empty( $input['guid'] ) ) {
			$external = sanitize_text_field( $input['guid'] );
		} elseif ( ! empty( $input['external_id'] ) ) {
			$external = sanitize_text_field( $input['external_id'] );
		}

		if ( '' !== $external ) {
			$invalid = $this->rejectMalformedExternalId( $type, $external );
			if ( is_wp_error( $invalid ) ) {
				return $invalid;
			}
			$where['external_id'] = $external;
			$attrs['external_id'] = $external;
			// A provider that knows a playable URL for its id (Bunny's HLS
			// playlist) can pass it through: the player block renders from `src`,
			// so without this a guid-only video embeds a player with no source.
			// Kept out of $where so dedupe still keys on the id alone.
			if ( ! empty( $input['src'] ) ) {
				$attrs['src'] = esc_url_raw( $input['src'] );
			}
		} elseif ( ! empty( $input['attachment_id'] ) ) {
			$attachment_id = absint( $input['attachment_id'] );
			$attachment    = get_post( $attachment_id );
			if ( empty( $attachment ) || 'attachment' !== $attachment->post_type || ! current_user_can( 'edit_post', $attachment_id ) ) {
				return new \WP_Error( 'invalid_attachment', __( 'Invalid attachment ID.', 'presto-player' ), array( 'status' => 400 ) );
			}
			$where['attachment_id'] = $attachment_id;
			$attrs['attachment_id'] = $attachment_id;
		} elseif ( ! empty( $input['url'] ) ) {
			$src    = esc_url_raw( $input['url'] );
			$scheme = strtolower( (string) wp_parse_url( $src, PHP_URL_SCHEME ) );
			if ( ! in_array( $scheme, array( 'http', 'https' ), true ) ) {
				return new \WP_Error( 'invalid_url', __( 'Video URL must be an http(s) URL.', 'presto-player' ), array( 'status' => 400 ) );
			}
			$provider_id = $this->resolveProviderVideoId( $type, $src );
			if ( is_wp_error( $provider_id ) ) {
				return $provider_id;
			}
			if ( '' !== $provider_id ) {
				$invalid = $this->rejectMalformedExternalId( $type, $provider_id );
				if ( is_wp_error( $invalid ) ) {
					return $invalid;
				}
				// Dedupe on the provider's own id, not the URL text: youtu.be/X and
				// watch?v=X are the same video, and matching on the string filed
				// them as two.
				$where['external_id'] = $provider_id;
				$attrs['external_id'] = $provider_id;
			} else {
				$where['src'] = $src;
			}
			$attrs['src'] = $src;
		} else {
			return new \WP_Error( 'missing_source', $this->missingSourceMessage(), array( 'status' => 400 ) );
		}

		return array( $where, $attrs );
	}

	/**
	 * Reject a YouTube / Vimeo id that isn't one.
	 *
	 * Both providers only ever mint `[A-Za-z0-9_-]`. Anything else came out of a
	 * URL someone hand-crafted, and it ends up inside the block comment we
	 * serialize into the post: `sanitize_text_field()` leaves a bare `>` alone and
	 * `wp_json_encode()` doesn't escape it either, so an id carrying `-->` closes
	 * the comment early and the rest of the block renders as text on the page.
	 *
	 * @param string $type        Provider type.
	 * @param string $external_id The provider's video id.
	 * @return \WP_Error|null WP_Error when it is malformed.
	 */
	protected function rejectMalformedExternalId( $type, $external_id ) {
		if ( ! in_array( $type, array( 'youtube', 'vimeo' ), true ) ) {
			return null;
		}
		if ( preg_match( '/^[A-Za-z0-9_-]+$/', $external_id ) ) {
			return null;
		}
		return new \WP_Error(
			'invalid_url',
			/* translators: %s: provider name, e.g. YouTube. */
			sprintf( __( 'That does not look like a %s video URL.', 'presto-player' ), self::$providers[ $type ]['label'] ),
			array( 'status' => 400 )
		);
	}

	/**
	 * Hosts each provider owns, and the ability that handles them.
	 *
	 * @var array<string, array<string, mixed>>
	 */
	private static $providers = array(
		'youtube' => array(
			'hosts'   => array( 'youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'youtube-nocookie.com' ),
			'ability' => 'presto-player/create-video-youtube',
			'label'   => 'YouTube',
		),
		'vimeo'   => array(
			'hosts'   => array( 'vimeo.com', 'player.vimeo.com' ),
			'ability' => 'presto-player/create-video-vimeo',
			'label'   => 'Vimeo',
		),
	);

	/**
	 * Pull the provider's own video id out of a URL, rejecting anything the
	 * ability does not own.
	 *
	 * A scheme check alone is not enough: esc_url_raw() prepends http:// to any
	 * schemeless string, so plain prose passes it — "tell me about cats" became a
	 * published page. The host is what actually says whether this is a video at
	 * all, and checking it also catches the sibling-ability mix-up, which is one
	 * of the likelier ways an agent gets this wrong.
	 *
	 * @param string $type Provider type the ability handles.
	 * @param string $url  Sanitized source URL.
	 * @return string|\WP_Error Provider video id, '' when the type has no parser.
	 */
	protected function resolveProviderVideoId( $type, $url ) {
		if ( ! isset( self::$providers[ $type ] ) ) {
			return '';
		}

		$host = strtolower( (string) wp_parse_url( $url, PHP_URL_HOST ) );
		$host = preg_replace( '/^www\./', '', $host );

		foreach ( self::$providers as $provider => $details ) {
			if ( ! in_array( $host, $details['hosts'], true ) ) {
				continue;
			}
			if ( $provider !== $type ) {
				return new \WP_Error(
					'wrong_provider',
					sprintf(
						/* translators: 1: provider name, e.g. Vimeo. 2: ability name to call instead. */
						__( 'That is a %1$s URL — use the %2$s ability instead.', 'presto-player' ),
						$details['label'],
						$details['ability']
					),
					array( 'status' => 400 )
				);
			}

			$id = 'youtube' === $type
				? $this->youtubeIdFromUrl( $url )
				: $this->vimeoIdFromUrl( $url );
			if ( '' === $id ) {
				return new \WP_Error(
					'invalid_url',
					sprintf(
						/* translators: %s: provider name, e.g. YouTube. */
						__( 'That does not look like a %s video URL.', 'presto-player' ),
						$details['label']
					),
					array( 'status' => 400 )
				);
			}
			return $id;
		}

		return new \WP_Error(
			'invalid_url',
			sprintf(
				/* translators: %s: provider name, e.g. YouTube. */
				__( 'That is not a %s URL.', 'presto-player' ),
				self::$providers[ $type ]['label']
			),
			array( 'status' => 400 )
		);
	}

	/**
	 * The video id in a YouTube URL.
	 *
	 * @param string $url YouTube URL.
	 * @return string
	 */
	protected function youtubeIdFromUrl( $url ) {
		$id = \PrestoPlayer\Blocks\YouTubeBlock::getIdFromURL( $url );
		if ( '' !== $id ) {
			return $id;
		}

		// The block's matcher is anchored to youtube.com and youtu.be, so the
		// other hosts YouTube serves the same videos on (nocookie, music) — and
		// newer paths like /live/ — need picking apart by hand.
		$query = array();
		wp_parse_str( (string) wp_parse_url( $url, PHP_URL_QUERY ), $query );
		if ( ! empty( $query['v'] ) && is_string( $query['v'] ) ) {
			return sanitize_text_field( $query['v'] );
		}

		$segments = explode( '/', trim( (string) wp_parse_url( $url, PHP_URL_PATH ), '/' ) );
		if ( count( $segments ) > 1 && in_array( $segments[0], array( 'embed', 'shorts', 'live', 'v' ), true ) ) {
			return sanitize_text_field( $segments[1] );
		}

		return '';
	}

	/**
	 * The numeric video id in a Vimeo URL.
	 *
	 * Unlisted videos carry a second segment (vimeo.com/ID/HASH) that the id
	 * alone cannot play, which is why `src` keeps the URL as given.
	 *
	 * @param string $url Vimeo URL.
	 * @return string
	 */
	protected function vimeoIdFromUrl( $url ) {
		$segments = explode( '/', trim( (string) wp_parse_url( $url, PHP_URL_PATH ), '/' ) );

		// vimeo.com/ID and vimeo.com/ID/HASH — the hash can itself be numeric, so
		// the leading segment wins before any positional guessing.
		if ( isset( $segments[0] ) && ctype_digit( $segments[0] ) ) {
			return $segments[0];
		}

		// player.vimeo.com/video/ID, and vimeo.com/album/N/video/ID where the
		// album id would otherwise be picked up instead.
		$index = array_search( 'video', $segments, true );
		if ( false !== $index && isset( $segments[ $index + 1 ] ) && ctype_digit( $segments[ $index + 1 ] ) ) {
			return $segments[ $index + 1 ];
		}

		// vimeo.com/channels/staffpicks/ID and friends.
		$numeric = array_values( array_filter( $segments, 'ctype_digit' ) );
		return $numeric ? (string) end( $numeric ) : '';
	}

	/**
	 * Name the source keys this ability actually accepts.
	 *
	 * @return string
	 */
	protected function missingSourceMessage() {
		$schema     = $this->getInputSchema();
		$properties = isset( $schema['properties'] ) ? array_keys( $schema['properties'] ) : array();
		$keys       = array_intersect( array( 'url', 'attachment_id', 'file', 'guid' ), $properties );

		return sprintf(
			/* translators: %s: comma-separated list of accepted parameter names. */
			__( 'Provide a video source (%s).', 'presto-player' ),
			implode( ', ', $keys )
		);
	}

	/**
	 * Pick the stored title: the explicit input, or a sensible fallback when
	 * there is no url to derive one from.
	 *
	 * @param array<string, mixed> $input Ability input.
	 * @param array<string, mixed> $attrs Resolved source attributes.
	 * @param string               $type  Provider type.
	 * @return string
	 */
	protected function resolveVideoTitle( array $input, array $attrs, $type ) {
		if ( ! empty( $input['title'] ) ) {
			return sanitize_text_field( $input['title'] );
		}
		// A src or an attachment lets the Video model derive the title itself
		// (e.g. from the attachment's own title), so leave it unset.
		if ( ! empty( $attrs['src'] ) || ! empty( $attrs['attachment_id'] ) ) {
			return '';
		}
		// Nothing to derive from (e.g. a bare external GUID) — avoid a blank title.
		return ! empty( $attrs['external_id'] ) ? $attrs['external_id'] : $type . ' video';
	}

	/**
	 * Materialize (or reuse) the reusable pp_video_block post for a Media Hub video.
	 *
	 * @param Video  $video  Media Hub video.
	 * @param string $status publish|draft.
	 * @return int|\WP_Error Reusable post ID.
	 */
	protected function materializeReusableVideoPost( Video $video, $status = 'publish' ) {
		$existing = (int) $video->post_id;
		if ( $existing && 'pp_video_block' === get_post_type( $existing ) && 'trash' !== get_post_status( $existing ) ) {
			return $existing;
		}

		$title   = $video->title ? $video->title : __( 'Presto Player video', 'presto-player' );
		$post_id = ( new ReusableVideo() )->create(
			// wp_insert_post() unslashes what it is given, and
			// serialize_block_attributes() escapes `&` as a single-backslash
			// & — so without slashing here the backslash is eaten and the
			// stored src becomes `...WgXcQu0026t=42s`, which is what the block
			// renders from. Every YouTube/Vimeo share link carrying `&t=` /
			// `&list=` / `&si=` produced a dead embed. syncReusableVideoPost()
			// slashes for the same reason; this path was the one that did not.
			wp_slash(
				array(
					'post_title'   => $title,
					'post_status'  => $status,
					'post_content' => $this->buildReusableVideoContent( $video ),
				)
			)
		);
		if ( ! $post_id ) {
			return new \WP_Error( 'create_failed', __( 'Could not create the reusable video post.', 'presto-player' ), array( 'status' => 500 ) );
		}

		// Link the row to its post; roll back the post if linking fails so a
		// retry doesn't orphan it and materialize a duplicate.
		$linked = $video->update( array( 'post_id' => (int) $post_id ) );
		if ( is_wp_error( $linked ) ) {
			wp_delete_post( (int) $post_id, true );
			return $linked;
		}

		return (int) $post_id;
	}

	/**
	 * Build the success payload: title, a link to watch it, a shortcode to embed
	 * it, and the ids follow-up abilities need.
	 *
	 * @param Video $video   Media Hub video.
	 * @param int   $post_id Reusable post ID.
	 * @param int   $page_id Published page ID (for the link).
	 * @param bool  $reused  Whether an existing video was matched instead of created.
	 * @return array<string, mixed>
	 */
	protected function reusableVideoPayload( Video $video, $post_id, $page_id = 0, $reused = false ) {
		$post_id = (int) $post_id;
		$page_id = (int) $page_id;
		// Kept intentionally lean: the caller (and the user) mostly want the
		// title, a link to watch it, and a shortcode to embed it. The ids are
		// there for follow-up abilities (chapters, quiz, etc.).
		return array(
			'title'     => (string) $video->title,
			'url'       => $page_id ? (string) get_permalink( $page_id ) : '',
			'shortcode' => '[presto_player id=' . $post_id . ']',
			'video_id'  => (int) $video->id,
			'post_id'   => $post_id,
			'reused'    => (bool) $reused,
		);
	}

	/**
	 * Push a changed video row into its pp_video_block post.
	 *
	 * The row is only half the story — what visitors see comes from the post's
	 * block attributes, and the Media Hub screen lists post titles. Writing the
	 * row alone left the two out of sync: an updated src kept serving the old
	 * provider and a rename never showed up in the library.
	 *
	 * Attributes are patched in place rather than regenerated, so anything set
	 * in the editor (preset, poster, chapters, overlays) survives the update.
	 *
	 * @param Video $video The Media Hub video, already updated.
	 * @return void
	 */
	protected function syncReusableVideoPost( Video $video ) {
		$post_id = $this->findVideoPostId( (int) $video->id, (int) $video->post_id );
		if ( ! $post_id ) {
			return;
		}

		$post = get_post( $post_id );
		if ( ! $post ) {
			return;
		}

		// The videos-row ownership check upstream says nothing about the post this
		// writes to, which can belong to someone else entirely.
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}

		$update = array( 'ID' => $post_id );

		$title = (string) $video->title;
		if ( '' !== $title && $title !== $post->post_title ) {
			$update['post_title'] = $title;
		}

		$expected = 'presto-player/' . $this->providerBlockName( (string) $video->type );
		$blocks   = parse_blocks( $post->post_content );

		if ( $this->videoBlockName( $blocks, $video ) !== $expected ) {
			// The provider changed, so the old block cannot render the new source
			// (a vimeo block fed an MP4 emits a player with no video at all).
			// Rebuilding is the only correct move here.
			$update['post_content'] = $this->buildReusableVideoContent( $video );
		} elseif ( $this->patchVideoBlockAttrs( $blocks, $video ) ) {
			$update['post_content'] = serialize_blocks( $blocks );
		}

		if ( count( $update ) > 1 ) {
			// wp_insert_post() unslashes what it is given, so pass slashed data
			// or a backslash in a title is silently eaten on every sync.
			wp_update_post( wp_slash( $update ) );
		}

		// The wrapper page we handed back as `url` carries the same title, so a
		// rename has to reach it too — otherwise menus and search keep the old one.
		if ( isset( $update['post_title'] ) ) {
			$page_id = (int) get_post_meta( $post_id, self::$page_meta_key, true );
			if ( $page_id && 'page' === get_post_type( $page_id ) && current_user_can( 'edit_post', $page_id ) ) {
				wp_update_post(
					wp_slash(
						array(
							'ID'         => $page_id,
							'post_title' => $update['post_title'],
						)
					)
				);
			}
		}
	}

	/**
	 * The player block that renders a given provider.
	 *
	 * @param string $type Provider type stored on the video row.
	 * @return string Block name without the namespace.
	 */
	protected function providerBlockName( $type ) {
		switch ( $type ) {
			case 'youtube':
				return 'youtube';
			case 'vimeo':
				return 'vimeo';
			case 'audio':
				return 'audio';
			case 'bunny':
				return class_exists( '\\PrestoPlayer\\Pro\\Blocks\\BunnyCDNBlock' ) ? 'bunny' : 'self-hosted';
			default:
				return 'self-hosted';
		}
	}

	/**
	 * The URL the player block should carry for a video row.
	 *
	 * Providers render from the block's `src`, so this is what keeps an updated
	 * row and its post playing the same thing — including when only the
	 * provider's `external_id` changed.
	 *
	 * @param Video $video The Media Hub video.
	 * @return string
	 */
	protected function resolveVideoBlockSrc( Video $video ) {
		// Read into locals first: Model defines __get but no __isset, so
		// empty( $video->external_id ) is always true and every check against a
		// magic property silently takes the wrong branch.
		$type          = (string) $video->type;
		$src           = (string) $video->src;
		$external_id   = (string) $video->external_id;
		$attachment_id = (int) $video->attachment_id;

		// The stored URL wins while it still points at the same provider video:
		// rebuilding a canonical one throws away the parts only the URL carries —
		// an unlisted Vimeo hash (vimeo.com/ID/HASH) is not playable without it.
		// A changed external_id no longer matches, so that still rebuilds below.
		if ( '' !== $src && ( '' === $external_id || false !== strpos( $src, $external_id ) ) ) {
			return $src;
		}
		if ( '' !== $external_id && 'youtube' === $type ) {
			return 'https://www.youtube.com/watch?v=' . $external_id;
		}
		if ( '' !== $external_id && 'vimeo' === $type ) {
			return 'https://vimeo.com/' . $external_id;
		}
		if ( '' !== $src ) {
			return $src;
		}
		if ( $attachment_id ) {
			return (string) wp_get_attachment_url( $attachment_id );
		}

		return '';
	}

	/**
	 * The block name currently rendering a video row, if any.
	 *
	 * @param array<int|string, mixed> $blocks Parsed blocks.
	 * @param Video                    $video  The Media Hub video.
	 * @return string Block name, or '' when not found.
	 */
	protected function videoBlockName( array $blocks, Video $video ) {
		foreach ( $blocks as $block ) {
			if ( ! empty( $block['blockName'] )
				&& 0 === strpos( $block['blockName'], 'presto-player/' )
				&& isset( $block['attrs']['id'] )
				&& (int) $block['attrs']['id'] === (int) $video->id ) {
				return (string) $block['blockName'];
			}
			if ( ! empty( $block['innerBlocks'] ) ) {
				$found = $this->videoBlockName( $block['innerBlocks'], $video );
				if ( '' !== $found ) {
					return $found;
				}
			}
		}
		return '';
	}

	/**
	 * Patch the player block that renders a given video row, in place.
	 *
	 * @param array<int|string, mixed> $blocks Parsed blocks, by reference.
	 * @param Video                    $video  The Media Hub video.
	 * @return bool Whether anything changed.
	 */
	protected function patchVideoBlockAttrs( array &$blocks, Video $video ) {
		$changed = false;

		foreach ( $blocks as &$block ) {
			$is_target = ! empty( $block['blockName'] )
				&& 0 === strpos( $block['blockName'], 'presto-player/' )
				&& isset( $block['attrs']['id'] )
				&& (int) $block['attrs']['id'] === (int) $video->id;

			if ( $is_target ) {
				$src = $this->resolveVideoBlockSrc( $video );
				if ( '' !== $src && ( ! isset( $block['attrs']['src'] ) || $block['attrs']['src'] !== $src ) ) {
					$block['attrs']['src'] = $src;
					$changed               = true;
				}
				$attachment_id = (int) $video->attachment_id;
				if ( $attachment_id && ( ! isset( $block['attrs']['attachment_id'] ) || (int) $block['attrs']['attachment_id'] !== $attachment_id ) ) {
					$block['attrs']['attachment_id'] = $attachment_id;
					$changed                         = true;
				}
			}

			if ( ! empty( $block['innerBlocks'] ) && $this->patchVideoBlockAttrs( $block['innerBlocks'], $video ) ) {
				$changed = true;
			}
		}

		return $changed;
	}

	/**
	 * The site's default player preset, when it still exists.
	 *
	 * @param  string $type Provider type stored on the video row.
	 * @return int Preset ID, or 0 to leave the block on the frontend fallback.
	 */
	protected function defaultPlayerPresetId( $type = '' ) {
		// Audio players read a different option and a different table, so a video
		// preset id stamped on an audio block resolves to an unrelated preset.
		$is_audio  = 'audio' === $type;
		$settings  = get_option( $is_audio ? 'presto_player_audio_presets' : 'presto_player_presets', array() );
		$preset_id = ! empty( $settings['default_player_preset'] ) ? (int) $settings['default_player_preset'] : 0;
		if ( ! $preset_id ) {
			return 0;
		}

		$preset = $is_audio ? new AudioPreset( $preset_id ) : new Preset( $preset_id );
		return $preset->id ? $preset_id : 0;
	}

	/**
	 * Serialize the reusable-edit wrapper + provider block for a video row.
	 *
	 * @param Video $video The Media Hub video.
	 * @return string Serialized block content.
	 */
	protected function buildReusableVideoContent( Video $video ) {
		$block = $this->providerBlockName( (string) $video->type );

		$src   = $this->resolveVideoBlockSrc( $video );
		$attrs = array( 'id' => (int) $video->id );
		if ( '' !== $src ) {
			$attrs['src'] = $src;
		}
		// Without this the block carries no preset and the frontend falls back to
		// the `default` slug, so "make this my default player" stored the setting
		// and changed nothing a visitor could see.
		$preset_id = $this->defaultPlayerPresetId( (string) $video->type );
		if ( $preset_id ) {
			$attrs['preset'] = $preset_id;
		}
		$attachment_id = (int) $video->attachment_id;
		if ( $attachment_id ) {
			$attrs['attachment_id'] = $attachment_id;
		}

		$inner = array(
			'blockName'    => 'presto-player/' . $block,
			'attrs'        => $attrs,
			'innerBlocks'  => array(),
			'innerHTML'    => '',
			'innerContent' => array(),
		);

		// The wrapper div is not decoration: reusable-edit's save() returns
		// `<div {...useInnerBlocksProps.save()}>`, so markup without it fails the
		// editor's save-output comparison and every ability-created video opens
		// as an invalid block ("Attempt block recovery"). The frontend never
		// noticed because it renders server-side from the video row.
		$wrapper = array(
			'blockName'    => 'presto-player/reusable-edit',
			'attrs'        => array(),
			'innerBlocks'  => array( $inner ),
			'innerHTML'    => '<div class="wp-block-presto-player-reusable-edit"></div>',
			'innerContent' => array( '<div class="wp-block-presto-player-reusable-edit">', null, '</div>' ),
		);

		return serialize_blocks( array( $wrapper ) );
	}
}
