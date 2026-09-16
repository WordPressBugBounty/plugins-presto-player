/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
const { Button } = wp.components;
const { useState, useEffect } = wp.element;
const { useSelect } = wp.data;

export default ( { onChoose } ) => {
	const [ video, setVideo ] = useState( null );
	const [ canSelect, setCanSelect ] = useState( false );

	const selectedId = useSelect( ( select ) =>
		select( 'presto-player/bunny-popup' ).ui( 'selectedId' )
	);
	const videos = useSelect( ( select ) =>
		select( 'presto-player/bunny-popup' ).videos()
	);

	// update selected video when videos or selected id changes
	useEffect( () => {
		setVideo(
			selectedId ? videos.find( ( item ) => item.guid === selectedId ) : null
		);
	}, [ videos, selectedId ] );

	// set if we can select if video has available resolutions
	useEffect( () => {
		// eslint-disable-next-line eqeqeq -- Bunny's API returns `status` as a number in some payloads and a numeric string in others; loose equality is the existing, intentional behaviour here.
		if ( video?.status == 3 && video?.availableResolutions.length ) {
			setCanSelect( true );
			return;
		}
		setCanSelect( video?.status > 3 && video?.status < 5 );
	}, [ video?.availableResolutions ] );

	return (
		<Button
			isPrimary
			disabled={ ! canSelect }
			onClick={ () => onChoose( video ) }
		>
			{ video?.id && ! canSelect
				? __( 'Please wait, video is encoding...', 'presto-player' )
				: __( 'Choose', 'presto-player' ) }
		</Button>
	);
};
