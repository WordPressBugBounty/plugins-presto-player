import { Container, Label, Tooltip } from '@bsf/force-ui';
import { Info } from 'lucide-react';

const LabelWithTooltip = ( { label, tooltip, size = 'sm', htmlFor } ) => (
	<Container direction="row" align="center" className="gap-1.5">
		<Label size={ size } htmlFor={ htmlFor }>
			{ label }
		</Label>
		{ tooltip && (
			<Tooltip content={ tooltip } arrow placement="right">
				<Info className="size-3.5 text-icon-secondary cursor-help shrink-0" />
			</Tooltip>
		) }
	</Container>
);

export default LabelWithTooltip;
