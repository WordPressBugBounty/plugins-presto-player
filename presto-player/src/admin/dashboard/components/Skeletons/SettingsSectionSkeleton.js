import { Skeleton } from '@bsf/force-ui';

const SectionSkeleton = ( { children } ) => (
	<div className="bg-white p-6 box-border shadow-sm rounded-xl flex flex-col gap-4">
		{ children }
	</div>
);

const CardHeader = () => (
	<div className="flex flex-col gap-1">
		<Skeleton className="h-5 w-28 rounded-md" />
		<Skeleton className="h-3 w-56 rounded-md" />
	</div>
);

const FieldRow = ( { labelWidth = 'w-24' } ) => (
	<div className="flex flex-col gap-2">
		<Skeleton className={ `h-3 ${ labelWidth } rounded-md` } />
		<Skeleton className="h-9 w-full rounded-md" />
	</div>
);

const ToggleRow = () => (
	<div className="flex items-center justify-between gap-4">
		<div className="flex flex-col gap-1">
			<Skeleton className="h-4 w-32 rounded-md" />
			<Skeleton className="h-3 w-48 rounded-md" />
		</div>
		<Skeleton className="h-5 w-9 rounded-full shrink-0" />
	</div>
);

const GenericCard = () => (
	<SectionSkeleton>
		<CardHeader />
		<FieldRow labelWidth="w-20" />
		<FieldRow labelWidth="w-28" />
		<ToggleRow />
	</SectionSkeleton>
);

// `cards` mirrors the real page's <SectionCard> count so the skeleton doesn't
// visually over- or under-claim the eventual layout. Almost every settings
// page renders exactly one SectionCard — default = 1. Pages that genuinely
// render more (e.g. EmailCapture with its optional CsvExportSection) opt in
// via the `skeletonCards` field on their SETTINGS_PAGES entry.
const SettingsSectionSkeleton = ( { cards = 1 } ) => (
	<div className="flex flex-col gap-6">
		{ Array.from( { length: Math.max( 1, cards ) } ).map( ( _, index ) => (
			<GenericCard key={ index } />
		) ) }
	</div>
);

export default SettingsSectionSkeleton;
