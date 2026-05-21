import { useState, useEffect } from 'react';
import wpApiFetch from '@wordpress/api-fetch';

const usePerformanceSettings = () => {
	const [ performance, setPerformance ] = useState( {
		module_enabled: false,
		automations: true,
	} );

	const [ isLoading, setIsLoading ] = useState( true );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ isDirty, setIsDirty ] = useState( false );

	useEffect( () => {
		const fetchAll = async () => {
			setIsLoading( true );
			try {
				const settings = await wpApiFetch( { path: '/wp/v2/settings' } );
				if ( settings.presto_player_performance ) {
					setPerformance( settings.presto_player_performance );
				}
			} catch ( err ) {
				console.error( 'usePerformanceSettings: failed to fetch settings', err );
			} finally {
				setIsLoading( false );
			}
		};

		fetchAll();
	}, [] );

	const save = async () => {
		setIsSaving( true );
		try {
			await wpApiFetch( {
				path: '/wp/v2/settings',
				method: 'POST',
				data: {
					presto_player_performance: performance,
				},
			} );
			setIsDirty( false );
		} catch ( err ) {
			setIsSaving( false );
			throw err;
		}
		setIsSaving( false );
	};

	const dirtySetPerformance = ( val ) => { setIsDirty( true ); setPerformance( val ); };

	return {
		performance,
		setPerformance: dirtySetPerformance,
		isLoading,
		isSaving,
		isDirty,
		save,
	};
};

export default usePerformanceSettings;
