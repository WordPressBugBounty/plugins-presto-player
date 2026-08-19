import { useMemo, useEffect } from '@wordpress/element';
import { Container } from '@bsf/force-ui';
import { BookOpen } from 'lucide-react';
import ChapterCard from './ChapterCard';
import LearnPageSkeleton from './LearnPageSkeleton';
import SetupCompleteCard from './SetupCompleteCard';
import useLearnProgress from './useLearnProgress';

const { __ } = wp.i18n;

const LearnPage = () => {
	const { chapters, isLoading, setStepCompleted } = useLearnProgress();

	// Deep-link support: `&chapter=<id>` opens that chapter and scrolls to it,
	// so links from the AI settings land straight on the AI Abilities chapter.
	const targetChapter = useMemo(
		() => new URLSearchParams( window.location.search ).get( 'chapter' ) || '',
		[]
	);

	useEffect( () => {
		if ( ! targetChapter || isLoading ) {
			return;
		}
		const el = document.getElementById( `learn-chapter-${ targetChapter }` );
		if ( el ) {
			el.scrollIntoView( { behavior: 'smooth', block: 'start' } );
		}
	}, [ targetChapter, isLoading ] );

	const showCelebration = useMemo( () => {
		const gettingStarted = chapters.find( ( c ) => c.id === 'getting-started' );
		if ( ! gettingStarted || ! gettingStarted.steps?.length ) {
			return false;
		}
		return gettingStarted.steps.every( ( s ) => s.completed );
	}, [ chapters ] );

	if ( isLoading ) {
		return <LearnPageSkeleton />;
	}

	return (
		<Container
			containerType="flex"
			direction="column"
			gap="md"
			className="p-8 max-w-4xl mx-auto w-full"
		>
			{ /* Header */ }
			<Container.Item>
				<h1 className="m-0 text-2xl font-semibold text-text-primary">
					{ __( 'Learn', 'presto-player' ) }
				</h1>
				<p className="m-0 mt-2 text-sm text-text-secondary leading-relaxed max-w-3xl">
					{ __(
						'Follow these chapters to set up your video player and get the most out of Presto Player — learn how to add videos, brand the player, embed, track analytics, and unlock advanced features.',
						'presto-player'
					) }
				</p>
			</Container.Item>

			{ /* Celebration banner — shown when Getting Started chapter is done */ }
			{ showCelebration && (
				<Container.Item>
					<SetupCompleteCard />
				</Container.Item>
			) }

			{ /* Chapters */ }
			{ chapters.length === 0 ? (
				<Container.Item>
					<div className="flex flex-col items-center justify-center py-16 gap-3 text-text-secondary">
						<BookOpen className="w-10 h-10 text-text-tertiary" />
						<p className="m-0 text-sm">
							{ __( 'No learn chapters available yet.', 'presto-player' ) }
						</p>
					</div>
				</Container.Item>
			) : (
				chapters.map( ( chapter ) => (
					<Container.Item key={ chapter.id }>
						<div id={ `learn-chapter-${ chapter.id }` }>
							<ChapterCard
								chapter={ chapter }
								defaultOpen={ chapter.id === targetChapter }
								onStepToggle={ setStepCompleted }
							/>
						</div>
					</Container.Item>
				) )
			) }
		</Container>
	);
};

export default LearnPage;
