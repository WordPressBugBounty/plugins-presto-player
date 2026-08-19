import { __ } from '@wordpress/i18n';
import { Container, Switch, Text, Tooltip } from '@bsf/force-ui';
import { Info } from 'lucide-react';
import SettingsPageShell from '../shared/SettingsPageShell';
import SectionCard from '../shared/SectionCard';
import useSimpleSettingsPage from '../../../hooks/useSimpleSettingsPage';
import useMcpAdapterInstall from '../../../hooks/useMcpAdapterInstall';
import { OPTION_KEYS } from '../config';
import ConnectWizard from './components/ConnectWizard';
import McpAdapterRequiredNote from './components/McpAdapterRequiredNote';
import AbilitiesList from './components/AbilitiesList';

const DEFAULTS = {
	enabled: false,
	allow_changes: false,
};

const buildEndpointUrl = ( ctx ) => {
	const root = ctx.root || ( ctx.siteUrl ? `${ ctx.siteUrl }/wp-json/` : '' );
	if ( ! /^https?:\/\//i.test( root ) ) {
		return '';
	}
	return root.replace( /\/$/, '' ) + '/presto-player/v1/mcp';
};

const McpPage = ( { registerActivePage } ) => {
	const { data, savedData, update, handleSave, isDirty, isSaving, isLoading } =
		useSimpleSettingsPage( OPTION_KEYS.mcp, DEFAULTS, registerActivePage );

	const ctx = window.prestoPlayer || {};
	const abilitiesSupported = ctx.abilitiesSupported !== false;

	const masterOn = !! data.enabled && abilitiesSupported;
	const allowChanges = masterOn && !! data.allow_changes;

	// The switches follow the draft so they feel responsive, but the connector
	// and the abilities list have to follow what's actually persisted — the
	// server reads the saved option, so showing the endpoint before Save meant
	// you could paste it into Claude and get a 404.
	const savedOn = !! savedData.enabled && abilitiesSupported;
	const savedAllowChanges = savedOn && !! savedData.allow_changes;

	const adapter = useMcpAdapterInstall( ctx.mcpAdapterStatus );
	const isAdapterActive = adapter.status === 'active';
	const endpointUrl = buildEndpointUrl( ctx );
	const username = ctx.currentUser?.user_login || '<your_username>';
	const siteUrl = ctx.siteUrl || '';
	const appPasswordsUrl = `${ siteUrl }/wp-admin/profile.php#application-passwords-section`;
	const adapterDownloadUrl =
		ctx.mcpAdapterDownloadUrl ||
		'https://github.com/WordPress/mcp-adapter/releases/download/v0.5.0/mcp-adapter.zip';

	const connectorTooltip = (
		<Tooltip
			content={ __(
				'MCP (Model Context Protocol) is the open standard that lets AI assistants like Claude, ChatGPT and Cursor securely connect to your site. Add this connector in your AI tool to give it access to your videos and analytics.',
				'presto-player'
			) }
			arrow
			placement="right"
		>
			<Info className="size-4 text-icon-secondary cursor-help shrink-0" />
		</Tooltip>
	);

	return (
		<SettingsPageShell
			title={ __( 'AI Abilities & MCP', 'presto-player' ) }
			isDirty={ isDirty }
			isSaving={ isSaving }
			isLoading={ isLoading }
			onSave={ handleSave }
		>
			<SectionCard>
				<Container direction="column" className="gap-4">
					<Switch
						size="md"
						disabled={ ! abilitiesSupported }
						value={ masterOn }
						onChange={ ( val ) =>
							update( {
								enabled: val,
								...( ! val && { allow_changes: false } ),
							} )
						}
						label={ {
							heading: __( 'Enable AI access', 'presto-player' ),
							description: __(
								'Let AI assistants like Claude, ChatGPT and Cursor connect to your site and read your videos and analytics. When off, no AI tool can see or do anything.',
								'presto-player'
							),
						} }
					/>
					{ ! abilitiesSupported && (
						<Text size="sm" className="text-text-secondary">
							{ __(
								'AI access requires WordPress 6.9 or later. Please update WordPress to enable this feature.',
								'presto-player'
							) }
						</Text>
					) }
					<Switch
						size="md"
						disabled={ ! masterOn }
						value={ allowChanges }
						onChange={ ( val ) => update( { allow_changes: val } ) }
						label={ {
							heading: __( 'Allow AI to make changes', 'presto-player' ),
							description: __(
								'Let connected assistants create, update and delete videos and settings. When off, AI access is read-only.',
								'presto-player'
							),
						} }
					/>
					{ savedOn && ! isAdapterActive && (
						<McpAdapterRequiredNote
							adapter={ adapter }
							downloadUrl={ adapterDownloadUrl }
						/>
					) }
				</Container>
			</SectionCard>

			{ savedOn && isAdapterActive && ! endpointUrl && (
				<SectionCard
					title={ __( 'MCP / Connector', 'presto-player' ) }
					titleAddon={ connectorTooltip }
				>
					<Text size="sm" className="text-text-secondary">
						{ __(
							'We could not determine your site’s REST API URL, so the connection details are unavailable. Please reload the page or check your site address settings.',
							'presto-player'
						) }
					</Text>
				</SectionCard>
			) }

			{ savedOn && isAdapterActive && endpointUrl && (
				<SectionCard
					title={ __( 'MCP / Connector', 'presto-player' ) }
					titleAddon={ connectorTooltip }
				>
					<ConnectWizard
						endpointUrl={ endpointUrl }
						username={ username }
						appPasswordsUrl={ appPasswordsUrl }
					/>
				</SectionCard>
			) }

			{ savedOn && (
				<SectionCard>
					<AbilitiesList
						enabled={ savedOn }
						allowChanges={ savedAllowChanges }
					/>
				</SectionCard>
			) }
		</SettingsPageShell>
	);
};

export default McpPage;
