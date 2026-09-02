import { __ } from '@wordpress/i18n';
import { Sparkles } from 'lucide-react';
import PromoBanner from './PromoBanner';

export const MCP_PROMO_KEY = 'prestoPlayerMcpPromoDismissed';

const EXAMPLES = [
	__( 'Create a video from a link', 'presto-player' ),
	__( 'Ask for your video analytics', 'presto-player' ),
];

/**
 * Promo showcasing the AI capabilities. Placement and gating live in
 * DashboardPromos — this is just the copy.
 *
 * @param {Object}   props
 * @param {Function} props.onDismiss Called after the dismissal is stored.
 */
const McpPromoBanner = ( { onDismiss } ) => (
	<PromoBanner
		storageKey={ MCP_PROMO_KEY }
		onDismiss={ onDismiss }
		icon={
			<Sparkles className="size-5 text-brand-primary-600" aria-hidden="true" />
		}
		title={ __( 'Explore Presto Player AI Abilities', 'presto-player' ) }
		chips={ EXAMPLES }
		ctaLabel={ __( 'Set up AI', 'presto-player' ) }
		ctaHref={ `${ window.location.pathname }?page=presto-dashboard&tab=Settings&section=mcp` }
	/>
);

export default McpPromoBanner;
