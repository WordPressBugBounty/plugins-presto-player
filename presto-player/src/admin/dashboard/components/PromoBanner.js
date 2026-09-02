import { __ } from '@wordpress/i18n';
import { X, ArrowRight } from 'lucide-react';

// Reading the window.localStorage property itself throws a SecurityError when
// site data is blocked, and these banners render above the whole dashboard — so
// every touch goes through here.
const withStorage = ( callback ) => {
	try {
		return callback( window.localStorage );
	} catch ( e ) {
		return false;
	}
};

export const isPromoDismissed = ( storageKey ) =>
	withStorage( ( store ) => store.getItem( storageKey ) === '1' );

/**
 * Full-width promo strip under the navbar. Shared chrome only — each promo owns
 * its own copy, gating and storage key.
 *
 * Visibility is NOT owned here — DashboardPromos decides which promo is on
 * screen, so dismissing has to tell it rather than just hiding this subtree.
 *
 * @param {Object}        props
 * @param {JSX.Element}   props.icon       Leading icon.
 * @param {string}        props.title      Headline.
 * @param {boolean}       props.tag        Show the "New" pill beside the title.
 * @param {Array<string>} props.chips      Short example pills. Omit for none.
 * @param {string}        props.ctaLabel   Button label. Omit for announcement-only.
 * @param {string}        props.ctaHref    Button destination.
 * @param {string}        props.storageKey localStorage key holding the dismissal.
 * @param {Function}      props.onDismiss  Called after the dismissal is stored.
 */
const PromoBanner = ( {
	icon,
	title,
	tag = false,
	chips = [],
	ctaLabel,
	ctaHref,
	storageKey,
	onDismiss,
} ) => {
	const dismiss = () => {
		withStorage( ( store ) => store.setItem( storageKey, '1' ) );
		onDismiss();
	};

	return (
		<div className="relative flex flex-col gap-3 border-b border-brand-border-300 bg-gradient-to-r from-brand-background-50 to-white px-6 py-4 md:flex-row md:items-center md:gap-6">
			<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-primary-50">
				{ icon }
			</span>

			<div className="flex flex-1 flex-col gap-2">
				<p className="m-0 flex items-center gap-2 text-sm font-semibold text-text-primary">
					{ title }
					{ !! tag && (
						<span className="shrink-0 rounded-full bg-brand-primary-600 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-white">
							{ __( 'New', 'presto-player' ) }
						</span>
					) }
				</p>
				{ !! chips.length && (
					<div className="flex flex-wrap gap-2">
						{ chips.map( ( chip ) => (
							<span
								key={ chip }
								className="inline-flex items-center rounded-full border border-brand-border-300 bg-white px-2.5 py-1 text-xs text-text-secondary"
							>
								{ chip }
							</span>
						) ) }
					</div>
				) }
			</div>

			<div className="flex shrink-0 items-center gap-2">
				{ !! ctaLabel && (
					<a
						href={ ctaHref }
						className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary-600 px-3 py-1.5 text-sm font-semibold text-white no-underline hover:opacity-90"
					>
						{ ctaLabel }
						<ArrowRight className="size-4" aria-hidden="true" />
					</a>
				) }
				<button
					type="button"
					onClick={ dismiss }
					aria-label={ __( 'Dismiss', 'presto-player' ) }
					className="shrink-0 cursor-pointer border-0 bg-transparent p-1 text-icon-secondary hover:text-icon-primary"
				>
					<X className="size-4" aria-hidden="true" />
				</button>
			</div>
		</div>
	);
};

export default PromoBanner;
