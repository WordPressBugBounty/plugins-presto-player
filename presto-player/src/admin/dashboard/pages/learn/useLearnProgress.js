import { useCallback, useEffect, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { toast } from '@bsf/force-ui';

const { __ } = wp.i18n;

/**
 * Fetches Learn chapters from the REST API and exposes a toggle function
 * for marking individual steps complete/incomplete.
 *
 * Each step carries a `completed` boolean merged server-side from the
 * current user's saved progress. State updates are optimistic: the UI
 * flips immediately, and we roll back on API failure with a toast.
 */
const useLearnProgress = () => {
	const [ chapters, setChapters ] = useState( [] );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ error, setError ] = useState( null );

	const loadChapters = useCallback( async () => {
		setIsLoading( true );
		try {
			const response = await apiFetch( {
				path: '/presto-player/v1/get-learn-chapters',
				method: 'GET',
			} );
			if ( Array.isArray( response ) ) {
				setChapters( response );
			}
		} catch ( err ) {
			setError( err );
			toast.error( {
				title: __( 'Failed to load learn chapters.', 'presto-player' ),
			} );
		} finally {
			setIsLoading( false );
		}
	}, [] );

	useEffect( () => {
		loadChapters();
	}, [ loadChapters ] );

	const setStepCompleted = useCallback(
		async ( chapterId, stepId, completed ) => {
			// Optimistic update.
			setChapters( ( prev ) =>
				prev.map( ( chapter ) => {
					if ( chapter.id !== chapterId ) {
						return chapter;
					}
					return {
						...chapter,
						steps: chapter.steps.map( ( step ) =>
							step.id === stepId ? { ...step, completed } : step
						),
					};
				} )
			);

			try {
				await apiFetch( {
					path: '/presto-player/v1/update-learn-progress',
					method: 'POST',
					data: { chapterId, stepId, completed },
				} );
			} catch ( err ) {
				// Revert on failure.
				setChapters( ( prev ) =>
					prev.map( ( chapter ) => {
						if ( chapter.id !== chapterId ) {
							return chapter;
						}
						return {
							...chapter,
							steps: chapter.steps.map( ( step ) =>
								step.id === stepId ? { ...step, completed: ! completed } : step
							),
						};
					} )
				);
				toast.error( {
					title: __(
						'Could not update your progress. Please try again.',
						'presto-player'
					),
				} );
			}
		},
		[]
	);

	return {
		chapters,
		isLoading,
		error,
		setStepCompleted,
		reload: loadChapters,
	};
};

export default useLearnProgress;
