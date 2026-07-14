import React, { useState, useEffect, useCallback, useRef } from 'react';
import { __ } from '@wordpress/i18n';
import debounce from 'debounce-promise';

// Deliberately hand-rolled rather than reusing the D4 VideoSelector (react-select/AsyncSelect):
// the divi-d5 bundle externalizes react/react-dom to Divi VB's shared window.vendor.React to avoid
// the two-React-copies hook error (#321), and pulling react-select in here reintroduces that risk
// plus extra weight. This picker reuses the same presto_fetch_videos endpoint and debounce-promise.
// TODO: revisit sharing a common video-search hook / ComboboxControl once the VB React setup allows.

// resolve ajaxurl + nonce: D5 app-iframe has PrestoPlayerDiviD5Data injected by PHP
function getAjaxConfig() {
	const d5 = window.PrestoPlayerDiviD5Data || window.parent?.PrestoPlayerDiviD5Data || {};
	const pp = window.prestoPlayer || window.parent?.prestoPlayer || {};
	return {
		ajaxurl: d5.ajaxurl || pp.ajaxurl || window.ajaxurl || window.parent?.ajaxurl || '',
		nonce: d5.nonce || pp.nonce || '',
	};
}

function fetchVideos( search = '', postId = '' ) {
	const { ajaxurl: url, nonce } = getAjaxConfig();
	const body = new URLSearchParams( {
		action: 'presto_fetch_videos',
		_wpnonce: nonce || '',
	} );
	if ( search ) body.set( 'search', search );
	if ( postId ) body.set( 'post_id', String( postId ) );

	return fetch( url, {
		method: 'POST',
		credentials: 'same-origin',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Cache-Control': 'no-cache',
		},
		body,
	} )
		.then( ( r ) => {
			if ( ! r.ok ) {
				throw new Error( `Request failed: ${ r.status }` );
			}
			return r.json();
		} )
		.then( ( r ) => {
			// The AJAX handler returns HTTP 200 with { success: false } on nonce/cap failure.
			if ( ! r?.success ) {
				throw new Error( r?.data?.message || 'Request failed' );
			}
			return ( r.data || [] ).map( ( v ) => ( { value: v.ID, label: v.post_title || __( 'Untitled', 'presto-player' ) } ) );
		} );
}

const fieldName = 'presto/media-hub';

export default function MediaHubField( { value, onChange } ) {
	const [ options, setOptions ] = useState( [] );
	const [ inputValue, setInputValue ] = useState( '' );
	const [ isOpen, setIsOpen ] = useState( false );
	const [ loading, setLoading ] = useState( false );
	const [ error, setError ] = useState( false );
	const wrapRef = useRef( null );
	const valueRef = useRef( value );
	valueRef.current = value;
	const reqRef = useRef( 0 );

	const selectedLabel = options.find( ( o ) => String( o.value ) === String( value ) )?.label || '';

	// initial load: fetch list + selected video
	useEffect( () => {
		let cancelled = false;
		// join the same request sequence as debouncedSearch so an early
		// search can't get clobbered by this slower initial load
		const myReq = ++reqRef.current;
		setLoading( true );
		setError( false );
		Promise.all( [
			fetchVideos( '' ),
			value ? fetchVideos( '', value ) : Promise.resolve( [] ),
		] )
			.then( ( [ list, current ] ) => {
				if ( cancelled || myReq !== reqRef.current ) return;
				const merged = [ ...list ];
				( current || [] ).forEach( ( v ) => {
					if ( ! merged.find( ( o ) => o.value === v.value ) ) merged.push( v );
				} );
				setOptions( merged );
			} )
			.catch( ( err ) => {
				if ( cancelled || myReq !== reqRef.current ) return;
				// eslint-disable-next-line no-console
				console.error( 'Presto Player: failed to fetch videos', err );
				setError( true );
			} )
			.finally( () => {
				if ( ! cancelled && myReq === reqRef.current ) setLoading( false );
			} );
		return () => {
			cancelled = true;
		};
	}, [] ); // run once on mount

	const debouncedSearch = useCallback(
		debounce( ( term ) => {
			const myReq = ++reqRef.current;
			setLoading( true );
			setError( false );
			return fetchVideos( term )
				.then( ( list ) => {
					// ignore stale responses that resolve after a newer search
					if ( myReq !== reqRef.current ) return list;
					setOptions( ( prev ) => {
						const selected = prev.find( ( o ) => String( o.value ) === String( valueRef.current ) );
						if ( selected && ! list.find( ( o ) => String( o.value ) === String( selected.value ) ) ) {
							return [ selected, ...list ];
						}
						return list;
					} );
					return list;
				} )
				.catch( ( err ) => {
					if ( myReq !== reqRef.current ) return;
					// eslint-disable-next-line no-console
					console.error( 'Presto Player: failed to fetch videos', err );
					setError( true );
				} )
				.finally( () => {
					if ( myReq === reqRef.current ) setLoading( false );
				} );
		}, 400 ),
		[]
	);

	function handleInputChange( e ) {
		const term = e.target.value;
		setInputValue( term );
		debouncedSearch( term );
	}

	function handleSelect( option ) {
		onChange( { inputValue: String( option.value ) } );
		setIsOpen( false );
		setInputValue( '' );
	}

	// close on outside click
	useEffect( () => {
		if ( ! isOpen ) return;
		function handler( e ) {
			if ( wrapRef.current && ! wrapRef.current.contains( e.target ) ) {
				setIsOpen( false );
			}
		}
		document.addEventListener( 'mousedown', handler );
		return () => document.removeEventListener( 'mousedown', handler );
	}, [ isOpen ] );

	const containerStyle = {
		position: 'relative',
		fontFamily: 'inherit',
		fontSize: '13px',
	};
	const triggerStyle = {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: '6px 8px',
		border: '1px solid #ccc',
		borderRadius: '3px',
		background: '#fff',
		cursor: 'pointer',
		minHeight: '32px',
	};
	const dropdownStyle = {
		position: 'absolute',
		top: '100%',
		left: 0,
		right: 0,
		zIndex: 9999,
		background: '#fff',
		border: '1px solid #ccc',
		borderTop: 'none',
		borderRadius: '0 0 3px 3px',
		maxHeight: '220px',
		overflowY: 'auto',
		boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
	};
	const inputStyle = {
		width: '100%',
		padding: '6px 8px',
		border: 'none',
		borderBottom: '1px solid #eee',
		outline: 'none',
		fontSize: '13px',
		boxSizing: 'border-box',
	};
	const itemStyle = ( selected ) => ( {
		padding: '6px 10px',
		cursor: 'pointer',
		background: selected ? '#f0f0f0' : 'transparent',
	} );

	return (
		<div ref={ wrapRef } style={ containerStyle }>
			<div
				style={ triggerStyle }
				onClick={ () => setIsOpen( ( v ) => ! v ) }
				role="button"
				tabIndex={ 0 }
				onKeyDown={ ( e ) => e.key === 'Enter' && setIsOpen( ( v ) => ! v ) }
			>
				<span style={ { flexGrow: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selectedLabel ? '#333' : '#999' } }>
					{ selectedLabel || __( 'Choose a video…', 'presto-player' ) }
				</span>
				<span style={ { marginLeft: '6px', color: '#999', fontSize: '10px' } }>{ isOpen ? '▲' : '▼' }</span>
			</div>

			{ isOpen && (
				<div style={ dropdownStyle }>
					<input
						style={ inputStyle }
						type="text"
						value={ inputValue }
						onChange={ handleInputChange }
						placeholder={ __( 'Search videos…', 'presto-player' ) }
						autoFocus
					/>
					{ loading && (
						<div style={ { padding: '8px 10px', color: '#999' } }>{ __( 'Loading…', 'presto-player' ) }</div>
					) }
					{ ! loading && error && (
						<div style={ { padding: '8px 10px', color: '#cc1818' } }>{ __( 'Could not load videos. Please reload and try again.', 'presto-player' ) }</div>
					) }
					{ ! loading && ! error && options.length === 0 && (
						<div style={ { padding: '8px 10px', color: '#999' } }>{ __( 'No videos found.', 'presto-player' ) }</div>
					) }
					{ ! loading &&
						options.map( ( opt ) => (
							<div
								key={ opt.value }
								style={ itemStyle( String( opt.value ) === String( value ) ) }
								onMouseDown={ ( e ) => {
									e.preventDefault();
									handleSelect( opt );
								} }
							>
								{ opt.label }
							</div>
						) ) }
				</div>
			) }
		</div>
	);
}

MediaHubField.fieldName = fieldName;
