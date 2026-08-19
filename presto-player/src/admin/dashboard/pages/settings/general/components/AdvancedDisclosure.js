import { __ } from '@wordpress/i18n';
import { useMemo, useState } from 'react';
import { Select, Text } from '@bsf/force-ui';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import CopyButton from './CopyButton';

const AI_CLIENTS = [
	{
		value: 'claude-desktop',
		label: __( 'Claude Desktop', 'presto-player' ),
		configFile: __(
			'~/Library/Application Support/Claude/claude_desktop_config.json (macOS) or %APPDATA%\\Claude\\claude_desktop_config.json (Windows)',
			'presto-player'
		),
		docsUrl: 'https://docs.claude.com/en/docs/mcp',
		rootKey: 'mcpServers',
	},
	{
		value: 'claude-code',
		label: __( 'Claude Code', 'presto-player' ),
		configFile: __(
			'.mcp.json (project) or ~/.claude.json (global)',
			'presto-player'
		),
		docsUrl: 'https://code.claude.com/docs/en/mcp',
		rootKey: 'mcpServers',
		cliCommand:
			'claude mcp add presto-player -- npx -y @automattic/mcp-wordpress-remote@latest',
	},
	{
		value: 'cursor',
		label: __( 'Cursor', 'presto-player' ),
		configFile: __( '~/.cursor/mcp.json', 'presto-player' ),
		docsUrl: 'https://docs.cursor.com/en/context/mcp',
		rootKey: 'mcpServers',
	},
	{
		value: 'vscode',
		label: __( 'VS Code (Copilot)', 'presto-player' ),
		configFile: __(
			'.vscode/mcp.json (project) or settings.json > mcp.servers (global)',
			'presto-player'
		),
		docsUrl:
			'https://code.visualstudio.com/docs/copilot/customization/mcp-servers',
		rootKey: 'servers',
	},
	{
		value: 'continue',
		label: __( 'Continue', 'presto-player' ),
		configFile: __( '~/.continue/config.yaml or config.json', 'presto-player' ),
		docsUrl: 'https://docs.continue.dev/customize/deep-dives/mcp',
		rootKey: 'mcpServers',
		arrayFormat: true,
	},
	{
		value: 'other',
		label: __( 'Other', 'presto-player' ),
		configFile: __( "Your client's MCP configuration file", 'presto-player' ),
		docsUrl:
			'https://modelcontextprotocol.io/docs/develop/connect-local-servers',
		rootKey: 'mcpServers',
	},
];

const buildRemoteConfig = ( client, endpointUrl, username ) => {
	const server = {
		command: 'npx',
		args: [ '-y', '@automattic/mcp-wordpress-remote@latest' ],
		env: {
			WP_API_URL: endpointUrl,
			WP_API_USERNAME: username,
			WP_API_PASSWORD: 'your-application-password',
		},
	};

	const shape = client.arrayFormat
		? { mcpServers: [ { name: 'presto-player', ...server } ] }
		: { [ client.rootKey ]: { 'presto-player': server } };

	return JSON.stringify( shape, null, 2 );
};

/**
 * Collapsed "Developer / advanced" disclosure. Documents the Application
 * Password + stdio bridge path for clients that cannot use the one-click
 * connector flow, with a per-client config snippet.
 *
 * @param {Object} props
 * @param {string} props.endpointUrl     Stable MCP endpoint URL.
 * @param {string} props.username        Current WordPress username.
 * @param {string} props.appPasswordsUrl Link to the user's Application Passwords.
 */
const AdvancedDisclosure = ( { endpointUrl, username, appPasswordsUrl } ) => {
	const [ open, setOpen ] = useState( false );
	const [ clientValue, setClientValue ] = useState( 'claude-desktop' );

	const client = useMemo(
		() =>
			AI_CLIENTS.find( ( item ) => item.value === clientValue ) ??
			AI_CLIENTS[ 0 ],
		[ clientValue ]
	);

	const config = useMemo(
		() => buildRemoteConfig( client, endpointUrl, username ),
		[ client, endpointUrl, username ]
	);

	return (
		<div className="border-t border-border-subtle pt-4">
			<button
				type="button"
				className="flex items-center gap-1.5 text-sm text-link-primary bg-transparent border-0 p-0 cursor-pointer hover:underline"
				onClick={ () => setOpen( ( prev ) => ! prev ) }
				aria-expanded={ open }
				aria-controls="presto-advanced-panel"
			>
				{ open ? (
					<ChevronUp className="size-4" />
				) : (
					<ChevronDown className="size-4" />
				) }
				{ __( 'Developer / advanced', 'presto-player' ) }
			</button>

			{ open && (
				<div id="presto-advanced-panel" className="mt-3 flex flex-col gap-3">
					<Text size="sm" className="text-text-secondary">
						{ __(
							'If your client cannot connect over OAuth, use an Application Password with the stdio bridge instead.',
							'presto-player'
						) }
					</Text>

					<div className="w-full">
						<Select
							size="md"
							by="value"
							value={ clientValue }
							onChange={ ( value ) => setClientValue( String( value ) ) }
						>
							<Select.Button
								label={ __( 'AI Client', 'presto-player' ) }
								render={ ( value ) =>
									AI_CLIENTS.find( ( item ) => item.value === value )?.label ??
									value
								}
							/>
							<Select.Options>
								{ AI_CLIENTS.map( ( item ) => (
									<Select.Option key={ item.value } value={ item.value }>
										{ item.label }
									</Select.Option>
								) ) }
							</Select.Options>
						</Select>
					</div>

					<ol className="list-decimal space-y-1.5 text-sm text-text-secondary m-0 pl-5">
						<li>
							{ __( 'Generate an Application Password —', 'presto-player' ) }{ ' ' }
							<a
								href={ appPasswordsUrl }
								target="_blank"
								rel="noopener noreferrer"
								className="text-link-primary underline inline-flex items-center gap-1"
							>
								{ __( 'Open Application Passwords', 'presto-player' ) }
								<ExternalLink className="size-3" />
							</a>
						</li>
						{ client.cliCommand && (
							<li>
								{ __(
									'Or use this CLI command to add the server quickly (you will still need to set the environment variables):',
									'presto-player'
								) }
								<div className="relative mt-2">
									<pre className="bg-background-secondary rounded-lg p-4 pr-12 overflow-x-auto text-[13px] leading-relaxed font-mono text-text-secondary m-0">
										{ client.cliCommand }
									</pre>
									<div className="absolute top-2 right-2">
										<CopyButton textToCopy={ client.cliCommand } />
									</div>
								</div>
							</li>
						) }
						<li>
							{ __( 'Copy the JSON config below into:', 'presto-player' ) }{ ' ' }
							<code className="text-[13px] bg-background-secondary px-1.5 py-0.5 rounded">
								{ client.configFile }
							</code>
						</li>
						<li>
							{ __(
								'Replace "your-application-password" with the password from Step 1, then restart the client.',
								'presto-player'
							) }
						</li>
					</ol>

					<div className="relative">
						<pre className="bg-background-secondary rounded-lg p-4 pr-12 overflow-x-auto text-[13px] leading-relaxed font-mono text-text-secondary m-0">
							{ config }
						</pre>
						<div className="absolute top-2 right-2">
							<CopyButton textToCopy={ config } />
						</div>
					</div>

					<Text size="xs" className="text-text-tertiary">
						{ __(
							'WP_API_URL — your site’s MCP endpoint. WP_API_USERNAME — your WordPress username. WP_API_PASSWORD — the application password you generated.',
							'presto-player'
						) }{ ' ' }
						<a
							href={ client.docsUrl }
							target="_blank"
							rel="noopener noreferrer"
							className="text-link-primary underline"
						>
							{ __( 'View setup docs', 'presto-player' ) }
						</a>
					</Text>
				</div>
			) }
		</div>
	);
};

export default AdvancedDisclosure;
