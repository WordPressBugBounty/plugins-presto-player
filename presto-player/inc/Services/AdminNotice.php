<?php
/**
 * Temporary admin notice service.
 *
 * @package PrestoPlayer
 */

namespace PrestoPlayer\Services;

/**
 * Stores and displays a one-time admin notice.
 */
class AdminNotice {

	const NOTICE_FIELD = 'presto_player_temp_admin_notice';

	/**
	 * Display the stored admin notice, then remove it.
	 *
	 * @return void
	 */
	public static function displayAdminNotice() {
		$option       = get_option( self::NOTICE_FIELD );
		$message      = isset( $option['message'] ) ? $option['message'] : false;
		$notice_level = ! empty( $option['notice-level'] ) ? $option['notice-level'] : 'notice-error';

		if ( $message ) {
			printf(
				'<div class="notice %s is-dismissible"><p>%s</p></div>',
				esc_attr( $notice_level ),
				wp_kses_post( $message )
			);
			delete_option( self::NOTICE_FIELD );
		}
	}

	/**
	 * Queue an error notice.
	 *
	 * @param string $message Notice message.
	 * @return void
	 */
	public static function displayError( $message ) {
		self::updateOption( $message, 'notice-error' );
	}

	/**
	 * Queue a warning notice.
	 *
	 * @param string $message Notice message.
	 * @return void
	 */
	public static function displayWarning( $message ) {
		self::updateOption( $message, 'notice-warning' );
	}

	/**
	 * Queue an info notice.
	 *
	 * @param string $message Notice message.
	 * @return void
	 */
	public static function displayInfo( $message ) {
		self::updateOption( $message, 'notice-info' );
	}

	/**
	 * Queue a success notice.
	 *
	 * @param string $message Notice message.
	 * @return void
	 */
	public static function displaySuccess( $message ) {
		self::updateOption( $message, 'notice-success' );
	}

	/**
	 * Store the notice message and level for later display.
	 *
	 * @param string $message      Notice message.
	 * @param string $notice_level Notice CSS level class.
	 * @return void
	 */
	protected static function updateOption( $message, $notice_level ) {
		update_option(
			self::NOTICE_FIELD,
			array(
				'message'      => $message,
				'notice-level' => $notice_level,
			)
		);
	}
}
