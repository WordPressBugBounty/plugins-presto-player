import { useState, useEffect } from 'react';
import apiFetch from '@wordpress/api-fetch';
import useBsfLearn from '../useBsfLearn';
import BsfLearnChapters from './BsfLearnChapters';
import BsfLearnSkeleton from './BsfLearnSkeleton';
import LearnHowDialog from './LearnHowDialog';

const BsfLearn = ( {
	chapters: initialChapters = [],
	endpoints = null,
	className = '',
	onProgressChange,
} ) => {
	const [ apiChapters, setApiChapters ] = useState( [] );
	const [ isLoading, setIsLoading ] = useState( false );
	const [ error, setError ] = useState( null );

	// Fetch chapters from API if endpoint is provided
	useEffect( () => {
		if ( ! endpoints?.get ) {
			return;
		}

		const abortController = new AbortController();

		setIsLoading( true );
		setError( null );

		apiFetch( {
			path: endpoints.get,
			signal: abortController.signal,
		} )
			.then( ( response ) => {
				setApiChapters( response );
				setIsLoading( false );
			} )
			.catch( ( err ) => {
				setError( err.message || 'Failed to load chapters' );
				setIsLoading( false );
			} );

		return () => {
			abortController.abort();
		};
	}, [ endpoints?.get ] );

	// Determine which chapters to use - API data or prop data
	const chaptersToUse = endpoints?.get ? apiChapters : initialChapters;

	const {
		chapters,
		updateStepCompletion,
		firstIncompleteChapterId,
		progressStats,
		learnHowDialogOpen,
		currentLearnHowItem,
		openLearnHowDialog,
		setLearnHowDialogOpen,
	} = useBsfLearn( {
		initialChapters: chaptersToUse,
		saveEndpoint: endpoints?.set,
	} );

	// Call progress change callback if provided
	if ( onProgressChange && typeof onProgressChange === 'function' ) {
		onProgressChange( progressStats );
	}

	if ( isLoading ) {
		return (
			<div className={ `flex flex-col gap-2 ${ className } !bg-transparent` }>
				<BsfLearnSkeleton />
			</div>
		);
	}

	if ( error ) {
		return (
			<div className={ className }>
				<div className="text-error p-4">
					{ error }
				</div>
			</div>
		);
	}

	if ( ! chapters || chapters.length === 0 ) {
		return null;
	}

	return (
		<div className={ className }>
			<BsfLearnChapters
				chapters={ chapters }
				defaultValue={ firstIncompleteChapterId }
				onStepCompletionChange={ updateStepCompletion }
				onLearnHowClick={ openLearnHowDialog }
			/>

			<LearnHowDialog
				open={ learnHowDialogOpen }
				setOpen={ setLearnHowDialogOpen }
				item={ currentLearnHowItem }
			/>
		</div>
	);
};

export default BsfLearn;
