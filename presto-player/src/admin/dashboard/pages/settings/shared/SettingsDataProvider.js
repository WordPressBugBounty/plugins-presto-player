import {
	createContext,
	useContext,
	useEffect,
	useRef,
	useState,
	useCallback,
	useMemo,
} from 'react';
import wpApiFetch from '@wordpress/api-fetch';
import isEqual from 'lodash/isEqual';

const SettingsDataContext = createContext( null );

export const useSettingsData = () => {
	const ctx = useContext( SettingsDataContext );
	if ( ! ctx ) {
		throw new Error(
			'useSettingsData must be used inside <SettingsDataProvider>'
		);
	}
	return ctx;
};

const SettingsDataProvider = ( { children } ) => {
	const [ settings, setSettings ] = useState( {} );
	const [ lastSaved, setLastSaved ] = useState( {} );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ loadError, setLoadError ] = useState( null );
	const [ savingKeys, setSavingKeys ] = useState( () => new Set() );

	// Mirror state into refs so stable callbacks (saveSlice, resetKey) can read
	// the freshest values without listing them as deps and losing their identity.
	const settingsRef = useRef( settings );
	const lastSavedRef = useRef( lastSaved );
	useEffect( () => {
		settingsRef.current = settings;
	}, [ settings ] );
	useEffect( () => {
		lastSavedRef.current = lastSaved;
	}, [ lastSaved ] );

	// Guards against React 18 StrictMode's double-invoke of mount effects in dev.
	const hasFetched = useRef( false );

	const fetchSettings = useCallback( async () => {
		setIsLoading( true );
		setLoadError( null );
		try {
			const response = await wpApiFetch( { path: '/wp/v2/settings' } );
			setSettings( response );
			setLastSaved( response );
		} catch ( err ) {
			// eslint-disable-next-line no-console
			console.error( 'SettingsDataProvider: initial fetch failed', err );
			setLoadError( err );
		} finally {
			setIsLoading( false );
		}
	}, [] );

	useEffect( () => {
		if ( hasFetched.current ) {
			return;
		}
		hasFetched.current = true;
		fetchSettings();
	}, [ fetchSettings ] );

	const updateLocal = useCallback( ( key, value ) => {
		setSettings( ( prev ) => {
			const next = typeof value === 'function' ? value( prev[ key ] ) : value;
			// Returning the same reference when unchanged avoids a spurious render,
			// and lets callers' early-return no-ops propagate correctly.
			if ( isEqual( prev[ key ], next ) ) {
				return prev;
			}
			return { ...prev, [ key ]: next };
		} );
	}, [] );

	const resetKey = useCallback( ( key ) => {
		setSettings( ( prev ) => {
			const target = lastSavedRef.current[ key ];
			if ( isEqual( prev[ key ], target ) ) {
				return prev;
			}
			return { ...prev, [ key ]: target };
		} );
	}, [] );

	const mutateSaving = useCallback( ( keys, op ) => {
		setSavingKeys( ( prev ) => {
			const next = new Set( prev );
			keys.forEach( ( k ) => next[ op ]( k ) );
			return next;
		} );
	}, [] );

	const saveSlice = useCallback(
		async ( keys ) => {
			if ( ! Array.isArray( keys ) || keys.length === 0 ) {
				return;
			}

			mutateSaving( keys, 'add' );

			try {
				const current = settingsRef.current;
				// Skip null as well as undefined. WP interprets a null in the
				// request body as "delete/reset this option", and refuses the
				// call with `rest_invalid_stored_value` whenever the current
				// stored value doesn't pass the registered schema. A settings
				// save is never meant to delete, so we never send null.
				const payload = keys.reduce( ( acc, k ) => {
					if ( current[ k ] !== undefined && current[ k ] !== null ) {
						acc[ k ] = current[ k ];
					}
					return acc;
				}, {} );

				if ( Object.keys( payload ).length === 0 ) {
					return;
				}

				const response = await wpApiFetch( {
					path: '/wp/v2/settings',
					method: 'POST',
					data: payload,
				} );

				// WP's POST /wp/v2/settings may legitimately omit keys it considers
				// unchanged. Fall back to the current draft in that case so we don't
				// clobber a saved-but-unreturned field with `undefined`.
				const mergeFromResponse = ( prev ) => {
					const next = { ...prev };
					keys.forEach( ( k ) => {
						if (
							response &&
							Object.prototype.hasOwnProperty.call( response, k )
						) {
							next[ k ] = response[ k ];
						} else if ( current[ k ] !== undefined ) {
							next[ k ] = current[ k ];
						}
					} );
					return next;
				};

				setLastSaved( mergeFromResponse );
				setSettings( mergeFromResponse );

				return response;
			} finally {
				mutateSaving( keys, 'delete' );
			}
		},
		[ mutateSaving ]
	);

	const value = useMemo(
		() => ( {
			settings,
			lastSaved,
			isLoading,
			loadError,
			retryLoad: fetchSettings,
			savingKeys,
			updateLocal,
			resetKey,
			saveSlice,
		} ),
		[
			settings,
			lastSaved,
			isLoading,
			loadError,
			fetchSettings,
			savingKeys,
			updateLocal,
			resetKey,
			saveSlice,
		]
	);

	return (
		<SettingsDataContext.Provider value={ value }>
			{ children }
		</SettingsDataContext.Provider>
	);
};

export default SettingsDataProvider;
