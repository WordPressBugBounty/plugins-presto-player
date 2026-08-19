import { useEffect, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';

/**
 * Fetches the registered abilities catalog from the read-only REST endpoint.
 * Only runs when AI access is enabled (no point fetching when the feature is off).
 *
 * @param {boolean} enabled Whether AI access is on.
 * @return {{abilities: Array, counts: Object, loading: boolean, error: any}} State.
 */
const useAbilities = ( enabled ) => {
	const [ abilities, setAbilities ] = useState( [] );
	const [ counts, setCounts ] = useState( { total: 0, free: 0, pro: 0 } );
	const [ loading, setLoading ] = useState( false );
	const [ error, setError ] = useState( null );

	useEffect( () => {
		if ( ! enabled ) {
			return undefined;
		}

		let active = true;
		setLoading( true );
		setError( null );

		apiFetch( { path: '/presto-player/v1/abilities' } )
			.then( ( res ) => {
				if ( ! active ) {
					return;
				}
				setAbilities( Array.isArray( res?.abilities ) ? res.abilities : [] );
				setCounts( res?.counts || { total: 0, free: 0, pro: 0 } );
			} )
			.catch( ( err ) => {
				if ( active ) {
					setError( err );
				}
			} )
			.finally( () => {
				if ( active ) {
					setLoading( false );
				}
			} );

		return () => {
			active = false;
		};
	}, [ enabled ] );

	return { abilities, counts, loading, error };
};

export default useAbilities;
