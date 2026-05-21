import { useState } from 'react';
import { Skeleton } from '@bsf/force-ui';

const Image = ( { src, alt } ) => {
	const [ isLoaded, setIsLoaded ] = useState( false );

	return (
		<div className="relative w-full shadow-sm rounded-lg overflow-hidden">
			{ ! isLoaded && (
				<Skeleton className="w-full h-64" />
			) }
			<img
				src={ src }
				alt={ alt || '' }
				decoding="async"
				className={ `w-full h-auto border-0.5 border-solid border-border-subtle ${ isLoaded ? 'block' : 'hidden' }` }
				onLoad={ () => setIsLoaded( true ) }
			/>
		</div>
	);
};

export default Image;
