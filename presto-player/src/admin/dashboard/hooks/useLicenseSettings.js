import { useState, useEffect, useCallback } from 'react';
import wpApiFetch from '@wordpress/api-fetch';

// Module-level cache so remounts of the License page (e.g. switching away and
// back in the Settings sidebar) don't re-fetch the status from the server.
// Activate/deactivate responses keep it in sync.
let cachedStatus = null;

const useLicenseSettings = () => {
	const [ isLoading, setIsLoading ] = useState( cachedStatus === null );
	const [ isActivating, setIsActivating ] = useState( false );
	const [ isDeactivating, setIsDeactivating ] = useState( false );
	const [ isActive, setIsActive ] = useState( cachedStatus?.active ?? false );
	const [ licenseKey, setLicenseKey ] = useState( cachedStatus?.key ?? '' );

	useEffect( () => {
		if ( cachedStatus !== null ) {
			return;
		}

		const fetchStatus = async () => {
			setIsLoading( true );
			try {
				const data = await wpApiFetch( {
					path: '/presto-player/v1/license/status',
				} );
				cachedStatus = { active: !! data.active, key: data.key || '' };
				setIsActive( cachedStatus.active );
				setLicenseKey( cachedStatus.key );
			} catch ( err ) {
				// eslint-disable-next-line no-console
				console.error(
					'useLicenseSettings: failed to fetch license status',
					err
				);
			} finally {
				setIsLoading( false );
			}
		};

		fetchStatus();
	}, [] );

	const activate = useCallback( async ( key ) => {
		setIsActivating( true );
		try {
			const data = await wpApiFetch( {
				path: '/presto-player/v1/license/activate',
				method: 'POST',
				data: { key },
			} );
			cachedStatus = { active: true, key: data.key || '' };
			setIsActive( true );
			setLicenseKey( cachedStatus.key );
			return data;
		} finally {
			setIsActivating( false );
		}
	}, [] );

	const deactivate = useCallback( async () => {
		setIsDeactivating( true );
		try {
			const data = await wpApiFetch( {
				path: '/presto-player/v1/license/deactivate',
				method: 'POST',
			} );
			cachedStatus = { active: false, key: '' };
			setIsActive( false );
			setLicenseKey( '' );
			return data;
		} finally {
			setIsDeactivating( false );
		}
	}, [] );

	return {
		isLoading,
		isActivating,
		isDeactivating,
		isActive,
		licenseKey,
		activate,
		deactivate,
	};
};

export default useLicenseSettings;
