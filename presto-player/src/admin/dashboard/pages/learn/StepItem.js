import { useState } from '@wordpress/element';
import { Button } from '@bsf/force-ui';
import {
	ArrowUpRight,
	Check,
	ChevronDown,
	ChevronUp,
	Circle,
	Info,
} from 'lucide-react';
import ScreenshotDialog from './ScreenshotDialog';

const { __ } = wp.i18n;

const StepItem = ( { chapterId, step, onToggle } ) => {
	const [ open, setOpen ] = useState( false );
	const [ screenshotOpen, setScreenshotOpen ] = useState( false );
	const completed = !! step.completed;

	const toggleCompleted = ( e ) => {
		e.stopPropagation();
		onToggle( chapterId, step.id, ! completed );
	};

	return (
		<div className="rounded-lg border border-solid border-border-subtle bg-background-primary">
			{ /* Header */ }
			<button
				type="button"
				onClick={ () => setOpen( ( v ) => ! v ) }
				aria-expanded={ open }
				className="w-full flex items-center gap-3 px-4 py-3 bg-transparent border-0 cursor-pointer text-left hover:bg-background-secondary/40 transition-colors"
			>
				<span
					role="button"
					tabIndex={ 0 }
					onClick={ toggleCompleted }
					onKeyDown={ ( e ) => {
						if ( e.key === 'Enter' || e.key === ' ' ) {
							toggleCompleted( e );
						}
					} }
					aria-label={
						completed
							? __( 'Mark step incomplete', 'presto-player' )
							: __( 'Mark step complete', 'presto-player' )
					}
					className={ `shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full border border-solid transition-colors cursor-pointer ${
						completed
							? 'bg-brand-primary-600 border-brand-primary-600 text-white'
							: 'bg-background-primary border-border-strong text-transparent hover:border-brand-400'
					}` }
				>
					{ completed ? (
						<Check className="w-3 h-3" />
					) : (
						<Circle className="w-0 h-0" />
					) }
				</span>

				<span className="flex-1 text-sm font-medium text-text-primary">
					{ step.title }
				</span>

				{ step.isPro && (
					<span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-background-secondary text-text-secondary border border-solid border-border-subtle">
						{ __( 'Pro', 'presto-player' ) }
					</span>
				) }

				{ open ? (
					<ChevronUp className="w-5 h-5 text-text-secondary shrink-0" />
				) : (
					<ChevronDown className="w-5 h-5 text-text-secondary shrink-0" />
				) }
			</button>

			{ /* Body */ }
			{ open && (
				<div className="border-0 border-t border-solid border-border-subtle px-4 py-4 flex items-start justify-between gap-4">
					<div className="flex-1">
						<p className="m-0 text-sm text-text-secondary leading-relaxed">
							{ step.description }
						</p>

						{ step.docsUrl && (
							<a
								href={ step.docsUrl }
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-brand-primary-600 hover:text-brand-hover-700 no-underline"
							>
								{ __( 'Read documentation', 'presto-player' ) }
								<ArrowUpRight className="w-3.5 h-3.5" />
							</a>
						) }
					</div>

					<div className="shrink-0 flex items-center gap-2">
						<button
							type="button"
							onClick={ () => setScreenshotOpen( true ) }
							aria-label={ __( 'View screenshot', 'presto-player' ) }
							className="inline-flex items-center justify-center w-8 h-8 rounded-full border-0 bg-background-primary text-text-secondary hover:text-brand-primary-600 cursor-pointer transition-colors"
						>
							<Info className="w-4 h-4" />
						</button>

						{ step.headerAction?.url && (
							<Button
								variant="primary"
								size="sm"
								onClick={ () => {
									window.open(
										step.headerAction.url,
										'_blank',
										'noopener,noreferrer'
									);
								} }
							>
								{ step.headerAction.label }
							</Button>
						) }
					</div>
				</div>
			) }

			<ScreenshotDialog
				open={ screenshotOpen }
				onOpenChange={ setScreenshotOpen }
				title={ step.title }
				screenshot={ step.screenshot }
			/>
		</div>
	);
};

export default StepItem;
