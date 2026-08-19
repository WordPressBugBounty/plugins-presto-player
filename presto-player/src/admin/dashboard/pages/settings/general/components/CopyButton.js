import { __ } from '@wordpress/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@bsf/force-ui';
import { Check, Copy, X } from 'lucide-react';

const legacyCopy = ( text ) => {
	const textarea = document.createElement( 'textarea' );
	textarea.value = text;
	textarea.style.position = 'fixed';
	textarea.style.opacity = '0';
	document.body.appendChild( textarea );
	textarea.select();
	let ok = false;
	try {
		ok = document.execCommand( 'copy' );
	} finally {
		document.body.removeChild( textarea );
	}
	return ok;
};

const copyText = ( text ) => {
	if ( window.navigator.clipboard && window.isSecureContext ) {
		return window.navigator.clipboard.writeText( text ).catch( () => {
			if ( ! legacyCopy( text ) ) {
				throw new Error( 'copy-failed' );
			}
		} );
	}
	if ( ! legacyCopy( text ) ) {
		return Promise.reject( new Error( 'copy-failed' ) );
	}
	return Promise.resolve();
};

/**
 * Reusable copy-to-clipboard button with a transient "Copied" confirmation.
 *
 * @param {Object} props
 * @param {string} props.textToCopy Text placed on the clipboard.
 * @param {string} [props.label]    Optional visible label (icon-only if absent).
 * @param {string} [props.variant]  force-ui Button variant.
 */
const CopyButton = ( { textToCopy, label, variant = 'outline' } ) => {
	const [ copied, setCopied ] = useState( false );
	const [ failed, setFailed ] = useState( false );
	const timerRef = useRef();

	useEffect( () => () => clearTimeout( timerRef.current ), [] );

	const handleCopy = useCallback( () => {
		if ( ! textToCopy ) {
			return;
		}
		copyText( textToCopy )
			.then( () => {
				setFailed( false );
				setCopied( true );
				clearTimeout( timerRef.current );
				timerRef.current = setTimeout( () => setCopied( false ), 1500 );
			} )
			.catch( () => {
				setCopied( false );
				setFailed( true );
				clearTimeout( timerRef.current );
				timerRef.current = setTimeout( () => setFailed( false ), 1500 );
			} );
	}, [ textToCopy ] );

	let icon = <Copy className="text-icon-primary size-4" />;
	if ( copied ) {
		icon = <Check className="text-icon-success size-4" />;
	} else if ( failed ) {
		icon = <X className="text-icon-error size-4" />;
	}

	let statusLabel = label || __( 'Copy to clipboard', 'presto-player' );
	if ( copied ) {
		statusLabel = __( 'Copied', 'presto-player' );
	} else if ( failed ) {
		statusLabel = __( 'Copy failed', 'presto-player' );
	}

	const buttonLabel = label ? statusLabel : null;

	return (
		<Button
			size="md"
			variant={ variant }
			icon={ icon }
			iconPosition="left"
			onClick={ handleCopy }
			aria-label={ statusLabel }
		>
			{ buttonLabel }
		</Button>
	);
};

export default CopyButton;
