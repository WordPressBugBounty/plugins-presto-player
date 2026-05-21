import { Button, Container, Title, Text } from '@bsf/force-ui';
import { Lock } from 'lucide-react';
import useUpgradeCTA from '../../../hooks/useUpgradeCTA';
import { useHistory } from '../../../router/router';

const ProGate = ( { children, enabled, title, description } ) => {
	const history = useHistory();
	const { label, href, onClick, isProUnlicensed } = useUpgradeCTA( history );

	if ( enabled ) {
		return children;
	}

	return (
		<div className="relative min-h-[260px] overflow-hidden p-4">
			<div
				inert=""
				aria-hidden="true"
				className="blur-[2px] opacity-60 pointer-events-none select-none px-6 py-4"
			>
				{ children }
			</div>
			<div className="absolute inset-0 bg-white/40 flex items-center justify-center p-4">
				<Container
					direction="column"
					className="bg-white rounded-lg border border-border-subtle shadow-pro-gate-cta p-6 max-w-[340px] w-full items-center text-center gap-4"
				>
					<div className="w-11 h-11 rounded-full flex items-center justify-center bg-background-secondary">
						<Lock className="w-5 h-5 text-icon-secondary" />
					</div>

					<Container direction="column" className="items-center gap-1.5">
						<Title tag="h4" title={ title } size="sm" />
						<Text size="sm" className="text-text-secondary leading-5">
							{ description }
						</Text>
					</Container>

					<Button
						tag="a"
						href={ href }
						target={ isProUnlicensed ? '_self' : '_blank' }
						rel={ isProUnlicensed ? undefined : 'noreferrer' }
						onClick={ onClick }
						variant="primary"
						size="sm"
						className="mt-1 no-underline hover:no-underline"
					>
						{ label }
					</Button>
				</Container>
			</div>
		</div>
	);
};

export default ProGate;
