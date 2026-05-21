import { Check } from 'lucide-react';

const ProgressPill = ( { completed, total } ) => {
	const isComplete = total > 0 && completed === total;

	const base =
		'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border border-solid';

	const style = isComplete
		? 'bg-brand-background-50 text-brand-hover-700 border-brand-background-hover-100'
		: 'bg-background-secondary text-text-secondary border-border-subtle';

	return (
		<span className={ `${ base } ${ style }` }>
			{ isComplete && <Check className="w-3 h-3" /> }
			{ completed }/{ total }
		</span>
	);
};

export default ProgressPill;
