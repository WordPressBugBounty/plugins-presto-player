import { useState } from '@wordpress/element';
import { ChevronDown, ChevronUp, ArrowUpRight } from 'lucide-react';
import StepItem from './StepItem';
import ProgressPill from './ProgressPill';

const { __ } = wp.i18n;

const ChapterCard = ( { chapter, defaultOpen = false, onStepToggle } ) => {
	const [ open, setOpen ] = useState( defaultOpen );

	const totalSteps = chapter.steps?.length || 0;
	const completedSteps =
		chapter.steps?.filter( ( step ) => step.completed ).length || 0;

	const handleDocsClick = ( e ) => {
		e.stopPropagation();
		if ( chapter.docsUrl ) {
			window.open( chapter.docsUrl, '_blank', 'noopener,noreferrer' );
		}
	};

	return (
		<div className="rounded-lg border border-solid border-border-subtle bg-background-primary overflow-hidden">
			{ /* Header */ }
			<button
				type="button"
				onClick={ () => setOpen( ( v ) => ! v ) }
				aria-expanded={ open }
				className="w-full flex items-start justify-between gap-4 px-5 py-4 bg-transparent border-0 cursor-pointer text-left hover:bg-background-secondary/40 transition-colors"
			>
				<div className="flex-1 min-w-0">
					<h3 className="m-0 text-base font-semibold text-text-primary">
						{ chapter.title }
					</h3>
					{ chapter.description && (
						<p className="m-0 mt-1 text-sm text-text-secondary leading-relaxed">
							{ chapter.description }
						</p>
					) }
				</div>

				<div className="shrink-0 flex items-center gap-3 pt-1">
					{ chapter.docsUrl && (
						<span
							role="button"
							tabIndex={ 0 }
							onClick={ handleDocsClick }
							onKeyDown={ ( e ) => {
								if ( e.key === 'Enter' || e.key === ' ' ) {
									handleDocsClick( e );
								}
							} }
							className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary-600 hover:text-brand-hover-700 cursor-pointer"
						>
							{ __( 'Learn how', 'presto-player' ) }
							<ArrowUpRight className="w-3.5 h-3.5" />
						</span>
					) }

					<ProgressPill
						completed={ completedSteps }
						total={ totalSteps }
					/>

					{ open ? (
						<ChevronUp className="w-5 h-5 text-text-secondary" />
					) : (
						<ChevronDown className="w-5 h-5 text-text-secondary" />
					) }
				</div>
			</button>

			{ /* Steps */ }
			{ open && (
				<div className="border-0 border-t border-solid border-border-subtle p-4 flex flex-col gap-3 bg-background-secondary/20">
					{ chapter.steps?.map( ( step ) => (
						<StepItem
							key={ step.id }
							chapterId={ chapter.id }
							step={ step }
							onToggle={ onStepToggle }
						/>
					) ) }
				</div>
			) }
		</div>
	);
};

export default ChapterCard;
