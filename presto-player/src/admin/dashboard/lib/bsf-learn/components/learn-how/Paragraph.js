import { Text } from '@bsf/force-ui';
import { classNames } from '../../helpers';

const Paragraph = ( { text, isHeading = false } ) => (
	<Text
		as={ isHeading ? 'h3' : 'p' }
		weight={ isHeading ? 600 : 400 }
		size={ isHeading ? 18 : 14 }
		color={ isHeading ? 'primary' : 'secondary' }
		className={ classNames( 'leading-relaxed', isHeading ? 'mt-4' : '' ) }
	>
		{ text }
	</Text>
);

export default Paragraph;
