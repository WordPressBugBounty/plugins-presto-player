import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '@bsf/force-ui';

const ADAPTER_SLUG = 'mcp-adapter';

const deriveStatus = ( { installed, active } ) => {
	if ( active ) {
		return 'active';
	}
	if ( installed ) {
		return 'inactive';
	}
	return 'not-installed';
};

/**
 * Drives the MCP Adapter install/activate lifecycle for the AI Access page.
 *
 * Seeds from the page-load status and keeps it fresh by re-reading the
 * plugin-status endpoint after a successful activate — no full page reload.
 * On failure it surfaces a toast so the user can fall back to a manual download.
 *
 * @param {string} initialStatus Status from the page-load global.
 * @return {{status: string, busy: boolean, install: Function, activate: Function}} Lifecycle state and actions.
 */
const useMcpAdapterInstall = ( initialStatus ) => {
	const [ status, setStatus ] = useState( initialStatus || 'not-installed' );
	const [ busy, setBusy ] = useState( false );
	const mountedRef = useRef( true );
	const busyRef = useRef( false );

	useEffect( () => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, [] );

	const refreshStatus = useCallback( async () => {
		// Never let a status re-read failure bubble up: callers run this after a
		// successful install/activate, so a failed GET must not masquerade as an
		// install/activate error or escape as an unhandled rejection.
		try {
			const response = await apiFetch( {
				path: `/presto-player/v1/plugin-status/${ ADAPTER_SLUG }`,
				method: 'GET',
			} );
			if ( mountedRef.current ) {
				setStatus( deriveStatus( response || {} ) );
			}
		} catch {
			// Leave the last known status in place.
		}
	}, [] );

	const activate = useCallback( async () => {
		if ( busyRef.current ) {
			return;
		}
		busyRef.current = true;
		setBusy( true );
		try {
			await apiFetch( {
				path: '/presto-player/v1/activate-plugin',
				method: 'POST',
				data: { plugin_slug: ADAPTER_SLUG },
			} );
			await refreshStatus();
		} catch {
			toast.error(
				__( 'Could not activate the MCP Adapter plugin.', 'presto-player' ),
				{ autoDismiss: 5000 }
			);
		} finally {
			busyRef.current = false;
			if ( mountedRef.current ) {
				setBusy( false );
			}
		}
	}, [ refreshStatus ] );

	const install = useCallback( async () => {
		if ( busyRef.current ) {
			return;
		}
		busyRef.current = true;
		setBusy( true );
		try {
			await apiFetch( {
				path: '/presto-player/v1/install-plugin',
				method: 'POST',
				data: { plugin: ADAPTER_SLUG },
			} );
		} catch {
			toast.error(
				__( 'Could not install the MCP Adapter plugin.', 'presto-player' ),
				{ autoDismiss: 5000 }
			);
			busyRef.current = false;
			if ( mountedRef.current ) {
				setBusy( false );
			}
			return;
		}
		try {
			await apiFetch( {
				path: '/presto-player/v1/activate-plugin',
				method: 'POST',
				data: { plugin_slug: ADAPTER_SLUG },
			} );
			await refreshStatus();
		} catch {
			toast.error(
				__(
					'Installed the MCP Adapter, but activation failed.',
					'presto-player'
				),
				{ autoDismiss: 5000 }
			);
			await refreshStatus();
		} finally {
			busyRef.current = false;
			if ( mountedRef.current ) {
				setBusy( false );
			}
		}
	}, [ refreshStatus ] );

	return { status, busy, install, activate };
};

export default useMcpAdapterInstall;
