<?php
/**
 * Byte-range video streamer.
 *
 * @package PrestoPlayer
 */

namespace PrestoPlayer\Services;

/**
 * Streams a file to the browser with HTTP byte-range support.
 */
class Streamer {

	/**
	 * Path to the file being streamed.
	 *
	 * @var string
	 */
	private $path = '';

	/**
	 * Open file stream resource.
	 *
	 * @var resource|false|string
	 */
	private $stream = '';

	/**
	 * Number of bytes to read per chunk.
	 *
	 * @var int
	 */
	private $buffer = 0;

	/**
	 * Start byte of the requested range.
	 *
	 * @var int
	 */
	private $start = -1;

	/**
	 * End byte of the requested range.
	 *
	 * @var int
	 */
	private $end = -1;

	/**
	 * Total size of the file in bytes.
	 *
	 * @var int
	 */
	private $size = 0;

	/**
	 * MIME type of the file being streamed.
	 *
	 * @var string
	 */
	private $type = '';

	/**
	 * Constructor.
	 *
	 * @param string $file_path Path to the file to stream.
	 * @param string $file_type MIME type of the file.
	 * @param int    $buffer    Number of bytes to read per chunk.
	 */
	public function __construct( $file_path, $file_type, $buffer = 102400 ) {
		$this->path   = $file_path;
		$this->type   = $file_type;
		$this->buffer = $buffer;
	}

	/**
	 * Start streaming video content.
	 *
	 * @return void
	 */
	public function start() {
		$this->open();
		$this->set_header();
		$this->stream();
		$this->end();
	}

	/**
	 * Open stream
	 */
	private function open() {

		$this->stream = fopen( $this->path, 'rb' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen -- Byte-range video streaming requires a low-level file handle; WP_Filesystem cannot stream ranges.

		if ( ! $this->stream ) {
			die( 'Could not open stream for reading' );
		}
	}

	/**
	 * Set proper header to serve the video content
	 */
	private function set_header() {

		$this->start = 0;
		$this->size  = filesize( $this->path );
		$this->end   = $this->size - 1;

		ob_get_clean();
		header( 'Content-Type: ' . $this->type );
		header( 'Cache-Control: max-age=2592000, public' );
		header( 'Expires: ' . gmdate( 'D, d M Y H:i:s', time() + 2592000 ) . ' GMT' );
		header( 'Last-Modified: ' . gmdate( 'D, d M Y H:i:s', @filemtime( $this->path ) ) . ' GMT' );
		header( 'Accept-Ranges: 0-' . $this->end );

		if ( isset( $_SERVER['HTTP_RANGE'] ) ) {

			$c_start = $this->start;
			$c_end   = $this->end;

			$parts = explode( '=', sanitize_text_field( wp_unslash( $_SERVER['HTTP_RANGE'] ) ), 2 );
			if ( count( $parts ) < 2 ) {
				header( 'HTTP/1.1 416 Requested Range Not Satisfiable' );
				header( "Content-Range: bytes $this->start-$this->end/$this->size" );
				exit;
			}
			$range = $parts[1];
			if ( strpos( $range, ',' ) !== false ) {
				header( 'HTTP/1.1 416 Requested Range Not Satisfiable' );
				header( "Content-Range: bytes $this->start-$this->end/$this->size" );
				exit;
			}
			if ( '-' == $range ) {
				$c_start = $this->size - substr( $range, 1 );
			} else {
				$range   = explode( '-', $range );
				$c_start = $range[0];
				$c_end   = ( isset( $range[1] ) && is_numeric( $range[1] ) ) ? $range[1] : $c_end;
			}
			$c_end = ( $c_end > $this->end ) ? $this->end : $c_end;
			if ( $c_start > $c_end || $c_start > $this->size - 1 || $c_end >= $this->size ) {
				header( 'HTTP/1.1 416 Requested Range Not Satisfiable' );
				header( "Content-Range: bytes $this->start-$this->end/$this->size" );
				exit;
			}
			$this->start = $c_start;
			$this->end   = $c_end;
			$length      = $this->end - $this->start + 1;
			fseek( $this->stream, $this->start );
			header( 'HTTP/1.1 206 Partial Content' );
			header( 'Content-Length: ' . $length );
			header( "Content-Range: bytes $this->start-$this->end/" . $this->size );
		} else {

			header( 'Content-Length: ' . $this->size );
		}
	}

	/**
	 * Perform the streaming of calculated range.
	 */
	private function stream() {

		$i = $this->start;
		set_time_limit( 0 );

		while ( ! feof( $this->stream ) && $i <= $this->end ) {
			$bytes_to_read = $this->buffer;
			if ( ( $i + $bytes_to_read ) > $this->end ) {
				$bytes_to_read = $this->end - $i + 1;
			}
			$data = fread( $this->stream, $bytes_to_read ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fread -- Byte-range video streaming requires direct stream reads.
			echo $data; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Raw video byte stream; escaping would corrupt binary output.
			flush();
			$i += $bytes_to_read;
		}
	}

	/**
	 * Close currently opened stream.
	 */
	private function end() {
		fclose( $this->stream ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose -- Closing the stream handle opened for byte-range streaming.
		exit;
	}
}
