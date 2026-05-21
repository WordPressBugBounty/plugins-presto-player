import { Text } from '@bsf/force-ui';
import { __, sprintf } from '@wordpress/i18n';

const Checklist = ( { items } ) => {
	return (
		<div className="space-y-2">
			{ items.map( ( item, index ) => (
				<div key={ index } className="flex items-start gap-2">
					<Text
						size={ 14 }
						weight={ 600 }
						color="primary"
						className="flex-shrink-0"
					>
						{ sprintf(
							__( 'Step %d:', 'presto-player' ),
							index + 1
						) }
					</Text>
					<Text size={ 14 } color="secondary">
						{ item.text }
					</Text>
				</div>
			) ) }
		</div>
	);
};

export default Checklist;
