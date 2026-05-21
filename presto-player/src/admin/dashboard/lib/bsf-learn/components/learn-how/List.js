import { Text } from '@bsf/force-ui';

const List = ( { items } ) => {
	return (
		<ul className="list-disc ml-8">
			{ items.map( ( item, index ) => (
				<li key={ index } className="my-0.5">
					<Text size={ 14 } color="secondary">
						{ item }
					</Text>
				</li>
			) ) }
		</ul>
	);
};

export default List;
