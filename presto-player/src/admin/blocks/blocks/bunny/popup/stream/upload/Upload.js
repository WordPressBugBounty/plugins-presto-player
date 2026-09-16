import './Upload.scss';

const { useState, useEffect } = wp.element;
const { useSelect } = wp.data;
import { __ } from '@wordpress/i18n';

import chunkUpload from '@/admin/blocks/shared/media/chunk-upload';

import ProgressBar from '../ProgressBar';

export default ( { file, name, onComplete } ) => {
	const [ progress, setProgress ] = useState( 0 );
	const [ , setMessage ] = useState( __( 'Uploading', 'presto-player' ) );
	const [ error, setError ] = useState( '' );
	const [ created, setCreated ] = useState( false );
	const type = useSelect( ( select ) =>
		select( 'presto-player/bunny-popup' ).requestType()
	);
	const collection = useSelect( ( select ) =>
		select( 'presto-player/bunny-popup' ).currentCollection()
	);

	let uploader;

	const upload = async () => {
		setMessage( __( 'Uploading', 'presto-player' ) );
		uploader = chunkUpload( {
			file: file?.[ 0 ] ? file?.[ 0 ] : file,
			path: `presto-player/v1/bunny/stream/upload`,
			onProgress: ( percent ) => {
				setProgress( percent ); // leave 10% for storing
			},
			onComplete: createVideo,
			onError: ( e ) => {
				setError( e.message );
				setMessage( __( 'Error', 'presto-player' ) );
				setProgress( 0 );
			},
		} );
	};

	const createVideo = async ( { path, name: uploadedName } ) => {
		setMessage( __( 'Creating', 'presto-player' ) );
		try {
			const video = await wp.apiFetch( {
				path: 'presto-player/v1/bunny/stream/videos',
				method: 'POST',
				data: {
					type,
					name: uploadedName,
					...( collection?.guid ? { collection: collection.guid } : {} ),
				},
			} );
			setCreated( true );
			storeVideo( { path, video } );
		} catch ( e ) {
			setError( e.message );
		} finally {
			setProgress( 0 );
		}
	};

	/**
	 * Store the video on Bunny.net
	 *
	 * @param {Object} root0       The completed upload.
	 * @param {string} root0.path  Path of the uploaded file on the server.
	 * @param {Object} root0.video Video object returned by the Bunny.net API.
	 */
	const storeVideo = async ( { path, video } ) => {
		await wp.apiFetch( {
			path: 'presto-player/v1/bunny/stream/store',
			method: 'POST',
			data: {
				type,
				path,
				guid: video.guid,
			},
		} );

		onComplete();
	};

	useEffect( () => {
		upload();
		return () => {
			if ( uploader ) {
				uploader.cancel();
			}
		};
	}, [] );

	if ( created ) {
		return '';
	}

	return (
		<div className="presto-stream-upload">
			<div className="presto-stream-upload__name">
				{ !! error && error }
				{ !! name && name } { file.name }...
			</div>
			<div className="presto-stream-upload__progress">
				<ProgressBar
					className="presto-stream-upload__progress-bar"
					progress={ progress }
				/>
			</div>
		</div>
	);
};
