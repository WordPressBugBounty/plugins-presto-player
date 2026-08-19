import { __ } from '@wordpress/i18n';
import { Download } from 'lucide-react';
import LinkButton from './LinkButton';

/**
 * Inline note shown under the master switch when the MCP Adapter plugin is
 * required. Offers a one-click install/activate action and a real manual
 * download link as a fallback if the request fails.
 *
 * @param {Object} props
 * @param {Object} props.adapter     Install lifecycle from useMcpAdapterInstall.
 * @param {string} props.downloadUrl Manual download URL for the adapter zip.
 */
const McpAdapterRequiredNote = ( { adapter, downloadUrl } ) => {
	const { status, busy, install, activate } = adapter;
	const isInstalledButInactive = status === 'inactive';

	let statusText = null;
	if ( busy && isInstalledButInactive ) {
		statusText = __( 'Activating…', 'presto-player' );
	} else if ( busy ) {
		statusText = __( 'Installing…', 'presto-player' );
	}

	return (
		<div className="text-sm text-text-secondary">
			{ __( 'Requires the MCP Adapter plugin.', 'presto-player' ) }{ ' ' }
			<LinkButton
				onClick={ isInstalledButInactive ? activate : install }
				disabled={ busy }
				aria-busy={ busy }
			>
				<span aria-live="polite">{ statusText }</span>
				{ ! busy && (
					<>
						<Download className="size-3" />
						{ isInstalledButInactive
							? __( 'Activate MCP Adapter', 'presto-player' )
							: __( 'Install MCP Adapter', 'presto-player' ) }
					</>
				) }
			</LinkButton>{ ' ' }
			<span className="text-text-tertiary">
				{ __( 'or', 'presto-player' ) }{ ' ' }
				<LinkButton href={ downloadUrl }>
					{ __( 'download it manually', 'presto-player' ) }
				</LinkButton>
			</span>
		</div>
	);
};

export default McpAdapterRequiredNote;
