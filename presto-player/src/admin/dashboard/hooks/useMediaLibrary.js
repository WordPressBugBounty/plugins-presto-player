import { __ } from '@wordpress/i18n';

export const useMediaLibrary = ( updateCallback ) => {
	const openMediaLibrary = ( fieldName ) => ( e ) => {
		e.preventDefault();

		const frame = wp.media( {
			title: __( 'Select Image', 'presto-player' ),
			button: {
				text: __( 'Set Image', 'presto-player' ),
			},
			multiple: false,
			library: {
				type: 'image',
			},
		} );

		frame.imageWasSelected = false;

		frame.on( 'select', () => {
			const attachment = frame
				.state()
				.get( 'selection' )
				.first()
				.toJSON();

			const fileUrl = attachment.url;
			frame.imageWasSelected = true;
			updateCallback( { [ fieldName ]: fileUrl } );
		} );

		frame.open();
	};

	const getFilename = ( fileURL, maxLength = 30 ) => {
		if ( ! fileURL ) {
			return '';
		}

		try {
			const url = new URL( fileURL );
			const fullName = url.pathname.split( '/' ).pop();

			if ( ! fullName ) {
				return '';
			}

			if ( fullName.length <= maxLength ) {
				return fullName;
			}

			const extIndex = fullName.lastIndexOf( '.' );
			const name = fullName.substring( 0, extIndex );
			const ext = fullName.substring( extIndex );

			const truncated = name.substring( 0, maxLength - ext.length - 3 );
			return `${ truncated }...${ ext }`;
		} catch ( e ) {
			return fileURL;
		}
	};

	return { openMediaLibrary, getFilename };
};
