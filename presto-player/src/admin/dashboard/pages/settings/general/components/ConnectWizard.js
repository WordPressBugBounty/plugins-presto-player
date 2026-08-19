import { __ } from '@wordpress/i18n';
import { Text } from '@bsf/force-ui';
import CopyButton from './CopyButton';
import ClaudeConnect from './ClaudeConnect';
import AdvancedDisclosure from './AdvancedDisclosure';

/**
 * "Connect your AI assistant" panel. Surfaces the stable endpoint URL, a
 * Claude-first connect block, and a collapsed developer fallback. Scope is
 * shown by the Abilities list below, so there's no separate scope preview here.
 *
 * @param {Object} props
 * @param {string} props.endpointUrl     Stable MCP endpoint URL.
 * @param {string} props.username        Current WordPress username.
 * @param {string} props.appPasswordsUrl Application Passwords admin link.
 */
const ConnectWizard = ( { endpointUrl, username, appPasswordsUrl } ) => {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<div>
					<Text size="sm" weight={ 600 } className="text-text-primary">
						{ __( 'Your MCP endpoint', 'presto-player' ) }
					</Text>
					<Text size="xs" className="text-text-tertiary mt-0.5 block">
						{ __(
							'Paste this into your AI assistant when adding a connector.',
							'presto-player'
						) }
					</Text>
				</div>
				<div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
					<div className="flex flex-1 items-center rounded-lg border border-solid border-border-subtle bg-white px-3 py-2.5">
						<span className="min-w-0 flex-1 break-all font-mono text-[13px] leading-snug text-text-secondary">
							{ endpointUrl }
						</span>
					</div>
					<CopyButton
						textToCopy={ endpointUrl }
						label={ __( 'Copy URL', 'presto-player' ) }
					/>
				</div>
			</div>

			<ClaudeConnect />

			<AdvancedDisclosure
				endpointUrl={ endpointUrl }
				username={ username }
				appPasswordsUrl={ appPasswordsUrl }
			/>
		</div>
	);
};

export default ConnectWizard;
