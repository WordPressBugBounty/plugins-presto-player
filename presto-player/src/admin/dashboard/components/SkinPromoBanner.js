import { __ } from '@wordpress/i18n';
import { Palette } from 'lucide-react';
import PromoBanner from './PromoBanner';

export const SKIN_PROMO_KEY = 'prestoPlayerSkinPromoDismissed';

/**
 * Promo for the Floating Pill player skin. Announcement only — no CTA, so it
 * never pulls anyone off the dashboard. Placement and gating live in
 * DashboardPromos.
 *
 * @param {Object}   props
 * @param {Function} props.onDismiss Called after the dismissal is stored.
 */
const SkinPromoBanner = ( { onDismiss } ) => (
	<PromoBanner
		storageKey={ SKIN_PROMO_KEY }
		onDismiss={ onDismiss }
		tag
		icon={
			<Palette className="size-5 text-brand-primary-600" aria-hidden="true" />
		}
		title={ __( 'Floating Pill', 'presto-player' ) }
	/>
);

export default SkinPromoBanner;
