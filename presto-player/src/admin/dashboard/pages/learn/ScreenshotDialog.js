import { useEffect, useState } from '@wordpress/element';
import { Dialog, Container, Skeleton, Text } from '@bsf/force-ui';
import { ImageOff } from 'lucide-react';

const { __ } = wp.i18n;

const ScreenshotDialog = ( { open, onOpenChange, title, screenshot } ) => {
	const imageUrl = screenshot?.url || '';
	const alt = screenshot?.alt || title || '';
	const [ loaded, setLoaded ] = useState( false );

	useEffect( () => {
		setLoaded( false );
	}, [ imageUrl ] );

	return (
		<Dialog open={ open } setOpen={ onOpenChange } exitOnClickOutside>
			<Dialog.Backdrop />
			<Dialog.Panel className="!w-full max-w-5xl">
				<Dialog.Header className="flex flex-row items-center justify-between">
					<Dialog.Title>{ title }</Dialog.Title>
					<Dialog.CloseButton />
				</Dialog.Header>
				<Dialog.Body style={ { padding: '0 20px 20px' } }>
					{ imageUrl ? (
						<div className="rounded-xl border border-solid border-border-strong/20 p-2 bg-background-secondary shadow-soft-shadow overflow-hidden">
							{ ! loaded && (
								<Skeleton className="w-full h-[400px] rounded-lg" />
							) }
							{ loaded && (
								<img
									src={ imageUrl }
									alt={ alt }
									decoding="async"
									className="block w-full h-auto rounded-lg border border-solid border-border-subtle"
								/>
							) }
							{ /* Hidden preloader */ }
							{ ! loaded && (
								<img
									src={ imageUrl }
									alt=""
									decoding="async"
									className="hidden"
									onLoad={ () => setLoaded( true ) }
								/>
							) }
						</div>
					) : (
						<Container
							containerType="flex"
							direction="column"
							justify="center"
							align="center"
							gap="xs"
							className="py-10"
						>
							<ImageOff className="w-8 h-8 text-text-tertiary" />
							<Text size={ 14 } color="secondary">
								{ __(
									'Screenshot coming soon.',
									'presto-player'
								) }
							</Text>
						</Container>
					) }
				</Dialog.Body>
			</Dialog.Panel>
		</Dialog>
	);
};

export default ScreenshotDialog;
