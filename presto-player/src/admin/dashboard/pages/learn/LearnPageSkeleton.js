import { Container, Skeleton } from '@bsf/force-ui';

const CHAPTER_COUNT = 5;

const LearnPageSkeleton = () => {
	return (
		<Container
			containerType="flex"
			direction="column"
			gap="md"
			className="p-8 max-w-4xl mx-auto w-full"
		>
			<Container.Item>
				<Skeleton
					variant="rectangular"
					className="h-8 w-24 rounded"
				/>
				<Skeleton
					variant="rectangular"
					className="h-4 mt-3 w-full max-w-3xl rounded"
				/>
				<Skeleton
					variant="rectangular"
					className="h-4 mt-2 w-[85%] max-w-3xl rounded"
				/>
			</Container.Item>

			{ /* Skeleton chapter cards */ }
			{ Array( CHAPTER_COUNT )
				.fill( 0 )
				.map( ( _, i ) => (
					<Container.Item key={ `chapter-${ i }` }>
						<div className="rounded-lg border border-solid border-border-subtle bg-background-primary px-5 py-4 flex items-start justify-between gap-4">
							<div className="flex-1 min-w-0">
								<Skeleton
									variant="rectangular"
									className="h-5 rounded"
									style={ {
										width: [ '10rem', '11rem', '10rem', '13rem', '9.5rem' ][ i ],
									} }
								/>
								<Skeleton
									variant="rectangular"
									className="h-3.5 mt-2 rounded"
									style={ {
										width: [ '24rem', '22rem', '28rem', '24rem', '32rem' ][ i ],
									} }
								/>
							</div>
							<div className="shrink-0 flex items-center gap-3 pt-1">
								<Skeleton
									variant="rectangular"
									className="w-12 h-5 rounded-full"
								/>
								<Skeleton
									variant="rectangular"
									className="w-5 h-5 rounded"
								/>
							</div>
						</div>
					</Container.Item>
				) ) }
		</Container>
	);
};

export default LearnPageSkeleton;
