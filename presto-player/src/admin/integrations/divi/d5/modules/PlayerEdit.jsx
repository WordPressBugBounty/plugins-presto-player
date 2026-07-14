import React from 'react';
import { __ } from '@wordpress/i18n';
import RenderPlayer from '../../modules/PrestoPlayer/RenderPlayer.jsx';

// copy prestoPlayer globals into app-window from top window when running in D5 iframe
const pp = window.prestoPlayer || window.parent?.prestoPlayer || {};
if ( ! window.prestoPlayer?.plugin_url && pp.plugin_url ) {
	window.prestoPlayer = { ...( window.prestoPlayer || {} ), ...pp };
}

// RenderPlayer uses window.et_fb_options.et_admin_load_nonce (D4 global).
// In D5 that object doesn't exist; polyfill from PrestoPlayerDiviD5Data (injected by PHP)
// so the AJAX call to presto_get_media_attributes can succeed.
if ( ! window.et_fb_options?.et_admin_load_nonce ) {
	const d5data = window.PrestoPlayerDiviD5Data || window.parent?.PrestoPlayerDiviD5Data || {};
	const nonce = d5data.nonce || pp.nonce || window.parent?.prestoPlayer?.nonce || '';
	window.et_fb_options = {
		...( window.et_fb_options || {} ),
		et_admin_load_nonce: nonce,
	};
}

export default function PlayerEdit( { attrs } ) {
	// D5 attrs are nested; guard against flatter shape that can appear before first save.
	// Narrow to a primitive so a shape like { innerContent: { desktop: {} } } yields undefined
	// (not the raw object) and correctly falls through to the "select media" curtain.
	const pick = ( a ) => {
		const v = a?.innerContent?.desktop?.value || a?.value || a;
		return typeof v === 'string' || typeof v === 'number' ? v : undefined;
	};
	const videoId = pick( attrs?.videoId );
	const urlOverride = pick( attrs?.urlOverride );

	if ( ! videoId ) {
		return <presto-video-curtain-ui>{ __( 'Please select media.', 'presto-player' ) }</presto-video-curtain-ui>;
	}

	return <RenderPlayer id={ videoId } src={ urlOverride || undefined } />;
}
