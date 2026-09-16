import { __ } from '@wordpress/i18n';
const { Button, TextControl, Modal, BaseControl } = wp.components;
const { useState, Fragment } = wp.element;
const { dispatch, useSelect } = wp.data;

import './CreateCollection.scss';

export default () => {
	const [ name, setName ] = useState( '' );
	const [ busy, setBusy ] = useState( false );
	const type = useSelect( ( select ) =>
		select( 'presto-player/bunny-popup' ).requestType()
	);
	const modal = useSelect( ( select ) =>
		select( 'presto-player/bunny-popup' ).ui( 'createCollection' )
	);
	const setModal = ( value ) => {
		dispatch( 'presto-player/bunny-popup' ).setUI( 'createCollection', value );
	};

	const onCreate = async () => {
		setBusy( true );
		try {
			const collection = await wp.apiFetch( {
				path: 'presto-player/v1/bunny/stream/collections',
				method: 'POST',
				data: {
					type,
					name,
				},
			} );
			dispatch( 'presto-player/bunny-popup' ).addCollection( collection );
			dispatch( 'presto-player/bunny-popup' ).setCollectionRequest(
				collection
			);
			dispatch( 'presto-player/bunny-popup' ).setVideosFetched( false );
			setName( '' );
			setModal( false );
		} catch ( e ) {
			// eslint-disable-next-line no-console -- Deliberate error reporting for a failed collection request; there is no other surface for it here.
			console.error( e );
		} finally {
			setBusy( false );
		}
	};

	return (
		<Fragment>
			<Button isSecondary onClick={ () => setModal( true ) }>
				{ __( 'Create Collection', 'presto-player' ) }
			</Button>
			{ modal && (
				<Modal
					overlayClassName="presto-modal"
					title={ 'Create New Collection' }
					shouldCloseOnClickOutside={ false }
					isDismissible={ false }
				>
					<TextControl
						className="presto-stream-create-collection__input"
						tabIndex="0"
						placeholder={ __( 'Enter a collection name', 'presto-player' ) }
						value={ name }
						onChange={ ( value ) => setName( value ) }
					/>

					<BaseControl>
						<Button
							isBusy={ busy }
							disabled={ busy }
							isPrimary
							onClick={ () => {
								onCreate();
							} }
						>
							{ __( 'Create', 'presto-player' ) }
						</Button>{ ' ' }
						<Button onClick={ () => setModal( false ) }>
							{ __( 'Cancel', 'presto-player' ) }
						</Button>
					</BaseControl>
				</Modal>
			) }
		</Fragment>
	);
};
