import { __ } from '@wordpress/i18n';
import { Text } from '@bsf/force-ui';
import { ArrowRight } from 'lucide-react';

const CLAUDE_CONNECTORS_URL = 'https://claude.ai/settings/connectors';

const STEPS = [
	__( 'Copy the endpoint URL above.', 'presto-player' ),
	__(
		'In Claude, open Settings → Connectors → Add custom connector and paste it.',
		'presto-player'
	),
	__(
		'Approve the connection — Presto Player’s tools appear automatically.',
		'presto-player'
	),
];

/**
 * Primary, Claude-first connect block — a bordered card holding the
 * "Connect with Claude →" link and the three quick steps.
 */
const ClaudeConnect = () => (
	<div className="rounded-xl border border-solid border-border-subtle bg-white p-5 shadow-sm sm:p-6">
		<div className="flex flex-col gap-4">
			<a
				href={ CLAUDE_CONNECTORS_URL }
				target="_blank"
				rel="noopener noreferrer"
				className="group inline-flex items-center gap-2 self-start no-underline"
			>
				<span className="text-base font-semibold text-link-primary group-hover:underline">
					{ __( 'Connect with Claude', 'presto-player' ) }
				</span>
				<ArrowRight className="size-5 shrink-0 text-link-primary" />
			</a>

			<ol className="m-0 flex list-none flex-col gap-2.5 p-0">
				{ STEPS.map( ( step, index ) => (
					<li key={ index } className="flex items-start gap-2.5">
						<span
							aria-hidden="true"
							className="mt-px inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-background-secondary text-[11px] font-semibold leading-none text-text-secondary"
						>
							{ index + 1 }
						</span>
						<Text size="sm" className="text-text-secondary leading-relaxed">
							{ step }
						</Text>
					</li>
				) ) }
			</ol>
		</div>
	</div>
);

export default ClaudeConnect;
