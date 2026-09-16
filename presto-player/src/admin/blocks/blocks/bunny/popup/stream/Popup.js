/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
const { DropZone, DropZoneProvider, Notice } = wp.components;
const { useEffect } = wp.element;
const { dispatch, useSelect } = wp.data;

import './Popup.scss';

import Sidebar from './Sidebar';
import Videos from './video/Videos';
import Collections from './collections/Collections';
import Header from './Header';
import Footer from './Footer';
import CollectionHeader from './CollectionHeader';
import Uploads from './upload/Uploads';

import MediaPopupTemplate from '@/admin/blocks/shared/media/MediaPopupTemplate';

export default ( { onClose, onChoose } ) => {
	const isPrivate = useSelect( ( select ) =>
		select( 'presto-player/bunny-popup' ).isPrivate()
	);
	const uploads = useSelect( ( select ) =>
		select( 'presto-player/bunny-popup' ).uploads()
	);
	const currentCollection = useSelect( ( select ) =>
		select( 'presto-player/bunny-popup' ).currentCollection()
	);
	const errors = useSelect( ( select ) =>
		select( 'presto-player/bunny-popup' ).errors()
	);

	useEffect( () => {
		dispatch( 'presto-player/bunny-popup' ).setVideosFetched( false );
		dispatch( 'presto-player/bunny-popup' ).setCollections( [] );
		dispatch( 'presto-player/bunny-popup' ).setVideos( [] );
	}, [] );

	const onCloseConfirm = () => {
		if ( uploads.length ) {
			// eslint-disable-next-line no-alert -- Native confirm is the existing admin UX for discarding pending uploads; replacing it with a custom modal is out of scope here.
			const r = confirm( 'Discard your uploads?' );
			if ( r ) {
				onClose();
				dispatch( 'presto-player/bunny-popup' ).setUploads( [] );
			}
			return;
		}
		onClose();
	};

	const addUpload = ( files ) => {
		dispatch( 'presto-player/bunny-popup' ).addUploads( files );
	};
	const removeUpload = ( file ) => {
		dispatch( 'presto-player/bunny-popup' ).removeUpload( file );
	};

	/**
	 * Modal Title
	 *
	 * @return string
	 */
	const title = isPrivate
		? __( 'Private Stream Library', 'presto-player' )
		: __( 'Public Stream Library', 'presto-player' );

	/**
	 * Main Content
	 *
	 * @return {JSX.Element} The dropzone-wrapped popup body.
	 */
	const mainContent = () => {
		return (
			<DropZoneProvider className="presto-stream-popup__dropzone">
				<div className="presto-stream-popup__body">
					{ !! errors.length &&
						errors.map( ( error ) => {
							return (
								<Notice
									key={ error }
									className="presto-stream-popup__notice"
									status="error"
									onRemove={ () =>
										dispatch( 'presto-player/bunny-popup' ).removeError( error )
									}
								>
									{ error }
								</Notice>
							);
						} ) }

					{ /* Show back button or collections */ }
					{ !! currentCollection ? <CollectionHeader /> : <Collections /> }

					<div className="presto-stream-popup__layout">
						<Videos />
					</div>

					<DropZone label={ 'Drop files' } onFilesDrop={ addUpload } />
				</div>
			</DropZoneProvider>
		);
	};

	/**
	 * Modal Header
	 */
	const header = (
		<Header
			afterUpload={
				<Uploads
					uploads={ uploads }
					removeUpload={ removeUpload }
					isPrivate={ isPrivate }
				/>
			}
		/>
	);

	const sidebar = <Sidebar />;

	/**
	 * Modal Footer
	 */
	const footer = <Footer onChoose={ onChoose } />;

	return (
		<MediaPopupTemplate
			title={ title }
			header={ header }
			mainContent={ mainContent() }
			onClose={ onCloseConfirm }
			footer={ footer }
			sidebar={ sidebar }
		/>
	);
};
