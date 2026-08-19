import { __, sprintf } from '@wordpress/i18n';
import { useMemo, useState } from 'react';
import { Input, Skeleton, Text, Tooltip } from '@bsf/force-ui';
import {
	ArrowUpRight,
	ChevronDown,
	ChevronUp,
	Clock,
	Lock,
	Search,
} from 'lucide-react';
import useAbilities from '../../../../hooks/useAbilities';

/**
 * Read abilities are active whenever AI access is on; write/destructive abilities
 * also require the "Allow AI to make changes" toggle. Mirrors Module::shouldRegister().
 *
 * @param {string}  type         read|write|destructive.
 * @param {boolean} allowChanges Whether the write toggle is on.
 * @return {boolean} Whether the ability is currently active.
 */
const isActive = ( type, allowChanges ) =>
	type === 'read' ? true : !! allowChanges;

/**
 * A pro ability is locked when the pro plugin is not active (available === false).
 *
 * @param {Object} ability Ability item from the REST list.
 * @return {boolean} Whether the ability is a locked pro ability.
 */
const isProLocked = ( ability ) =>
	ability.tier === 'pro' && ability.available === false;

/**
 * An upcoming ability is built but held back from this release — it is listed
 * for the roadmap only and is never registered.
 *
 * @param {Object} ability Ability item from the REST list.
 * @return {boolean} Whether the ability ships in a future release.
 */
const isUpcoming = ( ability ) => ability.upcoming === true;

/**
 * Abilities that count towards the "x of y active" figures: everything that is
 * neither locked behind Pro nor deferred to a future release.
 *
 * @param {Object}  ability      Ability item from the REST list.
 * @param {boolean} allowChanges Whether the write toggle is on.
 * @return {boolean} Whether the ability is currently active.
 */
const countsAsActive = ( ability, allowChanges ) =>
	! isProLocked( ability ) &&
	! isUpcoming( ability ) &&
	isActive( ability.type, allowChanges );

const inactiveReason = ( type, allowChanges ) => {
	if ( type !== 'read' && ! allowChanges ) {
		return __(
			'Turn on "Allow AI to make changes" to activate.',
			'presto-player'
		);
	}
	return '';
};

/**
 * The chip label is the ability slug after the namespace prefix,
 * e.g. "presto-player/list-videos" -> "list-videos".
 *
 * @param {string} name Fully-qualified ability name.
 * @return {string} The short slug.
 */
const abilitySlug = ( name ) =>
	String( name || '' )
		.split( '/' )
		.pop();

/**
 * Derives a display group from the ability name. Rules are evaluated in order
 * and the first match wins; empty groups are skipped at render time.
 *
 * @param {string} name Fully-qualified ability name.
 * @return {string} The group label.
 */
const groupFor = ( name ) => {
	const n = String( name || '' ).toLowerCase();

	if ( n.includes( 'preset' ) ) {
		return __( 'Presets', 'presto-player' );
	}
	if ( n.includes( 'chapter' ) ) {
		return __( 'Chapters', 'presto-player' );
	}
	if (
		n.includes( 'views' ) ||
		n.includes( 'drop-off' ) ||
		n.includes( 'top-videos' ) ||
		n.includes( 'top-viewers' )
	) {
		return __( 'Analytics', 'presto-player' );
	}
	if (
		n.includes( 'caption' ) ||
		n.includes( 'transcribe' ) ||
		n.includes( 'translate' ) ||
		n.includes( 'bunny' )
	) {
		return __( 'Bunny & Captions', 'presto-player' );
	}
	if (
		n.includes( 'learndash' ) ||
		n.includes( 'course' ) ||
		n.includes( 'quiz' ) ||
		n.includes( 'playlist' )
	) {
		return __( 'LMS & Playlists', 'presto-player' );
	}
	if ( n.includes( 'setting' ) ) {
		return __( 'Settings', 'presto-player' );
	}
	return __( 'Videos', 'presto-player' );
};

// The one group whose unreleased abilities are still worth showing as a
// roadmap. Upcoming abilities in any other group are hidden from the list.
const UPCOMING_GROUP = __( 'LMS & Playlists', 'presto-player' );

/**
 * Whether an ability belongs in the list at all. Upcoming abilities only show
 * for the roadmap group; everywhere else they are dropped so both the chips and
 * the totals describe what actually ships.
 *
 * @param {Object} ability Ability item from the REST list.
 * @return {boolean} Whether the ability is listed.
 */
const isListed = ( ability ) =>
	! isUpcoming( ability ) || groupFor( ability.name ) === UPCOMING_GROUP;

// Render order for the groups, basic first then advanced. Groups with no
// matching abilities are skipped.
const GROUP_ORDER = [
	__( 'Videos', 'presto-player' ),
	__( 'Presets', 'presto-player' ),
	__( 'Chapters', 'presto-player' ),
	__( 'Settings', 'presto-player' ),
	__( 'Analytics', 'presto-player' ),
	__( 'Bunny & Captions', 'presto-player' ),
	__( 'LMS & Playlists', 'presto-player' ),
];

// Order inside a group: CRUD first (create, read, update, delete), then the
// special operations. Anything not listed keeps its incoming order at the end.
const SLUG_ORDER = [
	'create-video-youtube',
	'create-video-vimeo',
	'create-video-self-hosted',
	'list-videos',
	'get-video',
	'update-video',
	'delete-video',
	'get-video-shortcode',
	'get-video-attributes',
	'update-video-attributes',
	'list-video-tags',
	'create-video-tag',
	'rename-video-tag',
	'delete-video-tag',

	'create-preset',
	'list-presets',
	'get-preset',
	'update-preset',
	'delete-preset',

	'chapters-list',
	'chapters-save',
	'chapters-generate-from-captions-deterministic',

	'get-settings',
	'update-settings',

	'list-top-videos',
	'list-top-viewers',
	'get-video-views',
	'get-video-drop-off',

	'upload-bunny-video',
	'create-video-bunny',
	'list-bunny-collections',
	'captions-list',
	'captions-upload',
	'captions-bulk-upload',
	'captions-transcribe-bunny',
	'captions-translate',
	'captions-bulk-translate-collection',

	'create-playlist',
	'update-playlist',
	'create-smart-playlist',
	'course-create-from-collection',
	'link-video-to-learndash-step',
];

const orderIndex = ( name ) => {
	const index = SLUG_ORDER.indexOf( abilitySlug( name ) );
	return index === -1 ? SLUG_ORDER.length : index;
};

/**
 * The "Upcoming" pill. Deliberately not the Lock treatment used for Pro-gated
 * abilities — these are not upsells, they simply ship in a later release.
 *
 * @param {Object} props
 * @param {string} props.className Extra classes for the wrapper.
 */
const UpcomingBadge = ( { className = '' } ) => (
	<span
		className={
			'inline-flex items-center gap-1 rounded-full bg-badge-background-disabled px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-tertiary ' +
			className
		}
	>
		<Clock className="size-2.5 shrink-0" aria-hidden="true" />
		{ __( 'Upcoming', 'presto-player' ) }
	</span>
);

const ariaLabelFor = ( ability, locked, active ) => {
	if ( isUpcoming( ability ) ) {
		/* translators: %s: ability label. */
		return sprintf( __( '%s (upcoming)', 'presto-player' ), ability.label );
	}
	if ( locked ) {
		/* translators: %s: ability label. */
		return sprintf( __( '%s (requires Pro)', 'presto-player' ), ability.label );
	}
	if ( active ) {
		/* translators: %s: ability label. */
		return sprintf( __( '%s (active)', 'presto-player' ), ability.label );
	}
	/* translators: %s: ability label. */
	return sprintf( __( '%s (inactive)', 'presto-player' ), ability.label );
};

const AbilityChip = ( { ability, allowChanges, hideUpcomingBadge } ) => {
	// An upcoming ability is never registered, so it is never active — that
	// takes precedence over the pro lock. A pro ability is "locked" only when
	// the pro plugin is not active (available === false); when pro is active it
	// renders like any free chip.
	const upcoming = isUpcoming( ability );
	const locked = ! upcoming && isProLocked( ability );
	const active = countsAsActive( ability, allowChanges );
	const slug = abilitySlug( ability.name );
	let reason = inactiveReason( ability.type, allowChanges );
	if ( upcoming ) {
		reason = __( 'Coming in a future release.', 'presto-player' );
	} else if ( locked ) {
		reason = __( 'Requires Presto Player Pro.', 'presto-player' );
	}

	const baseClass =
		'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs leading-none cursor-default transition-opacity duration-200 ';
	let stateClass =
		'border-border-subtle bg-background-secondary text-text-secondary ' +
		( active ? '' : 'opacity-50' );
	if ( upcoming ) {
		stateClass =
			'border-dashed border-border-strong bg-background-secondary text-text-tertiary';
	} else if ( locked ) {
		stateClass =
			'border-brand-border-300 bg-brand-background-50 text-brand-primary-600';
	}

	return (
		<Tooltip
			placement="top"
			arrow
			content={
				<div className="flex flex-col gap-0.5 max-w-60">
					<span className="font-semibold">{ ability.label }</span>
					{ ability.description && (
						<span className="opacity-90">{ ability.description }</span>
					) }
					<span className="font-mono opacity-70 text-[10px]">{ slug }</span>
					{ reason && <span className="opacity-90">{ reason }</span> }
				</div>
			}
		>
			<span
				className={ baseClass + stateClass }
				tabIndex={ 0 }
				aria-label={ [
					ariaLabelFor( ability, locked, active ),
					ability.description,
					reason,
				]
					.filter( Boolean )
					.join( '. ' ) }
			>
				{ locked && <Lock className="size-3 shrink-0" aria-hidden="true" /> }
				{ ability.label }
				{ upcoming && ! hideUpcomingBadge && (
					<UpcomingBadge className="ml-1" />
				) }
			</span>
		</Tooltip>
	);
};

const AbilityGroup = ( { title, abilities, allowChanges } ) => {
	const activeInGroup = abilities.filter( ( a ) =>
		countsAsActive( a, allowChanges )
	).length;
	// Upcoming chips stay visible but never count.
	const totalInGroup = abilities.filter( ( a ) => ! isUpcoming( a ) ).length;
	// When nothing in the group ships yet, the badge sits on the heading instead
	// of repeating on every chip, and the "0 of n active" count is meaningless.
	const groupUpcoming = abilities.every( isUpcoming );

	return (
		<div className="flex flex-col gap-2 py-3">
			<div className="flex items-center gap-2">
				<Text size="sm" weight={ 600 } className="text-text-primary">
					{ title }
				</Text>
				{ groupUpcoming ? (
					<UpcomingBadge />
				) : (
					<Text size="xs" className="text-text-tertiary">
						{ sprintf(
							/* translators: 1: active count in group, 2: total in group. */
							__( '%1$d of %2$d', 'presto-player' ),
							activeInGroup,
							totalInGroup
						) }
					</Text>
				) }
			</div>
			<div className="flex flex-wrap gap-1.5">
				{ abilities.map( ( ability ) => (
					<AbilityChip
						key={ ability.name }
						ability={ ability }
						allowChanges={ allowChanges }
						hideUpcomingBadge={ groupUpcoming }
					/>
				) ) }
			</div>
		</div>
	);
};

const AbilitiesBody = ( { abilities, loading, error, allowChanges } ) => {
	const [ query, setQuery ] = useState( '' );

	// Group, order, and filter the abilities by the search query. The query is
	// split into words and every word must appear somewhere in the ability's
	// slug, label, or description, so intent-style searches ("create video",
	// "youtube", "captions", "update preset") all resolve.
	const groups = useMemo( () => {
		const tokens = query.trim().toLowerCase().split( /\s+/ ).filter( Boolean );
		const byGroup = {};

		abilities.forEach( ( ability ) => {
			if ( tokens.length ) {
				const haystack = (
					abilitySlug( ability.name ) +
					' ' +
					( ability.label || '' ) +
					' ' +
					( ability.description || '' )
				).toLowerCase();
				if ( ! tokens.every( ( token ) => haystack.includes( token ) ) ) {
					return;
				}
			}
			const group = groupFor( ability.name );
			( byGroup[ group ] = byGroup[ group ] || [] ).push( ability );
		} );

		return GROUP_ORDER.filter( ( title ) => byGroup[ title ]?.length ).map(
			( title ) => ( {
				title,
				items: byGroup[ title ]
					.slice()
					.sort( ( a, b ) => orderIndex( a.name ) - orderIndex( b.name ) ),
			} )
		);
	}, [ abilities, query ] );

	if ( loading ) {
		return (
			<div className="flex flex-col gap-3">
				{ Array.from( { length: 6 } ).map( ( _, i ) => (
					<Skeleton
						key={ i }
						variant="rectangular"
						className="h-6 w-full rounded"
					/>
				) ) }
			</div>
		);
	}

	if ( error ) {
		return (
			<Text size="sm" className="text-text-secondary">
				{ __(
					'Could not load the abilities list. Reload the page to try again.',
					'presto-player'
				) }
			</Text>
		);
	}

	if ( ! abilities.length ) {
		return (
			<Text size="sm" className="text-text-secondary">
				{ __( 'No abilities are registered.', 'presto-player' ) }
			</Text>
		);
	}

	return (
		<div className="flex flex-col gap-1">
			<Input
				type="text"
				size="sm"
				value={ query }
				onChange={ ( value ) => setQuery( value || '' ) }
				label={ __( 'Search abilities', 'presto-player' ) }
				placeholder={ __( 'Search abilities', 'presto-player' ) }
				prefix={
					<Search
						className="size-4 text-icon-secondary shrink-0"
						aria-hidden="true"
					/>
				}
				className="w-full sm:max-w-xs [&_label]:sr-only"
			/>

			{ groups.length ? (
				<div className="divide-y divide-border-subtle">
					{ groups.map( ( group ) => (
						<AbilityGroup
							key={ group.title }
							title={ group.title }
							abilities={ group.items }
							allowChanges={ allowChanges }
						/>
					) ) }
				</div>
			) : (
				<Text size="sm" className="text-text-tertiary py-3 block">
					{ __( 'No abilities match your search.', 'presto-player' ) }
				</Text>
			) }
		</div>
	);
};

/**
 * Collapsible "Abilities" section. The header (chevron + title + active count)
 * is always visible; the search box and grouped ability chips show when expanded.
 * Closed by default. The fetch runs while AI access is on regardless of the
 * open state so the count is available in the header even while collapsed.
 *
 * @param {Object}  props
 * @param {boolean} props.enabled      Whether AI access is on (gates the fetch).
 * @param {boolean} props.allowChanges Whether write abilities are active.
 */
const AbilitiesList = ( { enabled, allowChanges } ) => {
	const [ open, setOpen ] = useState( false );
	const { abilities: allAbilities, loading, error } = useAbilities( enabled );

	// The REST catalog carries every upcoming ability; only the roadmap group's
	// are shown, so the list is built off the filtered catalog, not counts.total.
	const abilities = useMemo(
		() => allAbilities.filter( isListed ),
		[ allAbilities ]
	);

	// Upcoming abilities are never registered, so the header count is taken off
	// the shipping set only — "x of y active" describes what this release has,
	// not the roadmap chips rendered underneath it.
	const shipping = useMemo(
		() => allAbilities.filter( ( ability ) => ! isUpcoming( ability ) ),
		[ allAbilities ]
	);

	const activeCount = shipping.filter( ( a ) =>
		countsAsActive( a, allowChanges )
	).length;
	const totalCount = shipping.length;

	return (
		<div className="flex flex-col">
			<div className="flex items-center gap-2">
				<button
					type="button"
					className="flex items-center gap-2 bg-transparent border-0 p-0 cursor-pointer text-left w-full"
					onClick={ () => setOpen( ( prev ) => ! prev ) }
					aria-expanded={ open }
				>
					{ open ? (
						<ChevronUp className="size-4 text-text-secondary shrink-0" />
					) : (
						<ChevronDown className="size-4 text-text-secondary shrink-0" />
					) }
					<Text size="sm" weight={ 600 } className="text-text-primary">
						{ __( 'Abilities', 'presto-player' ) }
					</Text>
					<Text size="sm" className="text-text-tertiary">
						{ sprintf(
							/* translators: 1: active ability count, 2: total ability count. */
							__( '%1$d of %2$d active', 'presto-player' ),
							activeCount,
							totalCount
						) }
					</Text>
				</button>
				<a
					href={ `${ window.location.pathname }?page=presto-dashboard&tab=Learn&chapter=presto-player-ai` }
					className="inline-flex items-center gap-1 text-sm font-medium text-brand-primary-600 no-underline hover:underline shrink-0 ml-auto"
				>
					{ __( 'Learn more', 'presto-player' ) }
					<ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
				</a>
			</div>

			{ open && (
				<div className="mt-3">
					<AbilitiesBody
						abilities={ abilities }
						loading={ loading }
						error={ error }
						allowChanges={ allowChanges }
					/>
				</div>
			) }
		</div>
	);
};

export default AbilitiesList;
