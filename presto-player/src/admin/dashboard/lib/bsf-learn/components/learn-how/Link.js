import { Text } from '@bsf/force-ui';

const Link = ( { prefix, text, url, target = '_blank' } ) => (
	<div className="text-sm flex gap-1">
		{ prefix && <span>{ prefix }</span> }
		<Text
			as="a"
			href={ url }
			target={ target }
			className="text-gs-primary underline"
		>
			{ text || url }
		</Text>
	</div>
);

export default Link;
