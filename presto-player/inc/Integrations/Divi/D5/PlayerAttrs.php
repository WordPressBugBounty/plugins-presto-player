<?php
/**
 * Maps Divi D5 module attributes for the Presto Player video module.
 *
 * @package presto-player
 */

namespace PrestoPlayer\Integrations\Divi\D5;

/**
 * Maps raw D5 module attribute arrays to player options.
 */
class PlayerAttrs {

	/**
	 * Converts raw D5 attrs into a normalized player options array.
	 *
	 * @param array<string, mixed> $attrs Raw D5 module attribute array.
	 * @return array<string, mixed>
	 */
	public static function map( array $attrs ): array {
		// Desktop breakpoint only; responsive per-device video/override values aren't supported.
		$video_id     = (int) ( $attrs['videoId']['innerContent']['desktop']['value'] ?? 0 );
		$url_override = (string) ( $attrs['urlOverride']['innerContent']['desktop']['value'] ?? '' );

		$overrides = array();
		if ( '' !== $url_override ) {
			$overrides['src'] = esc_url_raw( $url_override );
		}

		return array(
			'video_id'  => $video_id,
			'overrides' => $overrides,
		);
	}
}
