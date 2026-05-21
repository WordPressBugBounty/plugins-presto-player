import { __ } from '@wordpress/i18n';

/**
 * Returns the CTA copy + click handler for the in-app pro-gate surfaces:
 *
 *   1. No Pro plugin                          → "Upgrade Now"      → external pricing
 *   2. Pro plugin active, no license OR key   → "Activate License" → in-app license tab
 *   3. Pro plugin active + licensed           → caller should hide the CTA
 *
 * State flags (`isLicenseInvalid`, `hasLicenseKey`, `renewLink`) are also
 * returned so callers that want to *differentiate* the invalid-key state
 * (e.g. top-of-dashboard banner, WP admin notice) can override the defaults.
 *
 * Pass the dashboard's `history` so SPA callers soft-navigate; non-SPA callers
 * (e.g. the block-editor modal) omit it and get a hard navigation to the same URL.
 */
const useUpgradeCTA = ( history ) => {
	const data = window?.prestoPlayer || {};
	const isProPluginActive = !! data.isProPluginActive;
	const isPremium = !! data.isPremium;
	const hasLicenseKey = !! data.hasLicenseKey;
	const isProUnlicensed = isProPluginActive && ! isPremium;
	const isLicenseInvalid = isProUnlicensed && hasLicenseKey;

	const externalUpgradeLink =
		data.upgradeLink ||
		data.upgrade_link ||
		'https://prestoplayer.com/pricing/';

	const renewLink =
		data.renewLink || 'https://my.prestomade.com/my-account/';

	const dashboardUrl = data.dashboardUrl || 'admin.php?page=presto-dashboard';
	const licenseSettingsHref = `${ dashboardUrl }&tab=Settings&section=license`;

	const label = isProUnlicensed
		? __( 'Activate License', 'presto-player' )
		: __( 'Upgrade Now', 'presto-player' );

	const onClick = ( e ) => {
		if ( isProUnlicensed ) {
			e?.preventDefault?.();
			if ( history?.push ) {
				history.push( { tab: 'Settings', section: 'license' } );
			} else {
				window.location.href = licenseSettingsHref;
			}
			return;
		}
		// Skip when an <a target="_blank" href> already handles the click,
		// otherwise we'd double-open the pricing page.
		const target = e?.currentTarget;
		if ( target?.tagName === 'A' && target.target === '_blank' ) {
			return;
		}
		window.open( externalUpgradeLink, '_blank', 'noopener noreferrer' );
	};

	return {
		label,
		isProUnlicensed,
		isLicenseInvalid,
		isProPluginActive,
		isPremium,
		hasLicenseKey,
		href: isProUnlicensed ? licenseSettingsHref : externalUpgradeLink,
		licenseSettingsHref,
		externalUpgradeLink,
		renewLink,
		onClick,
	};
};

export default useUpgradeCTA;
