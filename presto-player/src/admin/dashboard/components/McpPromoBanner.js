import { __ } from '@wordpress/i18n';
import { useState } from 'react';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { useLocation } from '../router/router';

const STORAGE_KEY = 'prestoPlayerMcpPromoDismissed';

// Reading the window.localStorage property itself throws a SecurityError when
// site data is blocked, and this banner renders above the whole dashboard — so
// every touch goes through here.
const withStorage = ( callback ) => {
	try {
		return callback( window.localStorage );
	} catch ( e ) {
		return false;
	}
};

const aiSettingsUrl = () =>
	`${ window.location.pathname }?page=presto-dashboard&tab=Settings&section=mcp`;

const EXAMPLES = [
	__( 'Create a video from a link', 'presto-player' ),
	__( 'Ask for your video analytics', 'presto-player' ),
];

/**
 * Promo showcasing the AI capabilities, shown only on the Dashboard home
 * (not every tab). Hidden once dismissed and when the WordPress version can't
 * run the Abilities API.
 */
const McpPromoBanner = () => {
	const [ dismissed, setDismissed ] = useState( () =>
		withStorage( ( store ) => store.getItem( STORAGE_KEY ) === '1' )
	);

	const ctx = window.prestoPlayer || {};
	const location = useLocation();
	const tab = location.params?.tab;
	const onDashboardHome = ! tab || tab === 'Dashboard';

	// canManageOptions: the section this promotes needs it, so anyone below that
	// would just land on a screen that can't load.
	if (
		dismissed ||
		ctx.abilitiesSupported === false ||
		ctx.canManageOptions === false ||
		! onDashboardHome
	) {
		return null;
	}

	const dismiss = () => {
		withStorage( ( store ) => store.setItem( STORAGE_KEY, '1' ) );
		setDismissed( true );
	};

	return (
		<div className="relative flex flex-col gap-3 border-b border-brand-border-300 bg-gradient-to-r from-brand-background-50 to-white px-6 py-4 md:flex-row md:items-center md:gap-6">
			<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-primary-50">
				<Sparkles
					className="size-5 text-brand-primary-600"
					aria-hidden="true"
				/>
			</span>

			<div className="flex flex-1 flex-col gap-2">
				<p className="m-0 text-sm font-semibold text-text-primary">
					{ __( 'Explore Presto Player AI Abilities', 'presto-player' ) }
				</p>
				<div className="flex flex-wrap gap-2">
					{ EXAMPLES.map( ( example ) => (
						<span
							key={ example }
							className="inline-flex items-center rounded-full border border-brand-border-300 bg-white px-2.5 py-1 text-xs text-text-secondary"
						>
							{ example }
						</span>
					) ) }
				</div>
			</div>

			<div className="flex shrink-0 items-center gap-2">
				<a
					href={ aiSettingsUrl() }
					className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary-600 px-3 py-1.5 text-sm font-semibold text-white no-underline hover:opacity-90"
				>
					{ __( 'Set up AI', 'presto-player' ) }
					<ArrowRight className="size-4" aria-hidden="true" />
				</a>
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

export default McpPromoBanner;
