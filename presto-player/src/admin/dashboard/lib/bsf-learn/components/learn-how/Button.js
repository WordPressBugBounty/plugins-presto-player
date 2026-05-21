import { Button as FUIButton } from '@bsf/force-ui';
import { forwardRef } from '@wordpress/element';

const Button = ( { text, variant, onClick } ) => {
	const handleOnClick = ( event ) => {
		if ( !! onClick && typeof onClick === 'function' ) {
			onClick( event );
		}
	};

	return (
		<FUIButton
			variant={ variant || 'primary' }
			size="sm"
			onClick={ handleOnClick }
		>
			{ text }
		</FUIButton>
	);
};

export default forwardRef( Button );
