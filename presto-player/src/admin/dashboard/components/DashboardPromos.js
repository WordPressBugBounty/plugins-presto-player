import { useState } from 'react';
import { useLocation } from '../router/router';
import { isPromoDismissed } from './PromoBanner';
import McpPromoBanner, { MCP_PROMO_KEY } from './McpPromoBanner';
import SkinPromoBanner, { SKIN_PROMO_KEY } from './SkinPromoBanner';

/**
 * Picks which feature promo sits under the navbar on the Dashboard home. Only
 * ever one — two full-width strips above the dashboard is too much chrome.
 *
 * Newest release first: the MCP promo shipped in 4.4.0 and anyone who never
 * dismissed it would otherwise permanently outrank whatever ships next.
 */
const DashboardPromos = () => {
	// Dismissals are also tracked in memory, not just read back from storage:
	// writes throw and get swallowed when site data is blocked (Safari's "block
	// all cookies", Firefox strict), and without this the X would be a no-op.
	const [ closed, setClosed ] = useState( () => new Set() );
	const dismiss = ( key ) =>
		setClosed( ( previous ) => new Set( previous ).add( key ) );
	const isHidden = ( key ) => closed.has( key ) || isPromoDismissed( key );

	const ctx = window.prestoPlayer || {};
	const location = useLocation();
	const tab = location.params?.tab;

	if ( tab && tab !== 'Dashboard' ) {
		return null;
	}

	// One strip per page load. Sliding the next promo into the slot the user
	// just closed reads as the X being broken; it waits for the next load.
	if ( closed.size ) {
		return null;
	}

	// The MCP section reads /wp/v2/settings and needs the Abilities API, so
	// anyone missing either would just land on a screen that can't load.
	const mcpAvailable =
		ctx.abilitiesSupported !== false && ctx.canManageOptions !== false;

	// The skin is not gated on manage_options — it is news, not a settings link.
	if ( ! isHidden( SKIN_PROMO_KEY ) ) {
		return <SkinPromoBanner onDismiss={ () => dismiss( SKIN_PROMO_KEY ) } />;
	}

	if ( mcpAvailable && ! isHidden( MCP_PROMO_KEY ) ) {
		return <McpPromoBanner onDismiss={ () => dismiss( MCP_PROMO_KEY ) } />;
	}

	return null;
};

export default DashboardPromos;
