import { __ } from '@wordpress/i18n';
import { useState } from 'react';
import { Dialog, Button } from '@bsf/force-ui';

const ConfirmDialog = ( {
	open,
	title,
	description,
	confirmLabel,
	cancelLabel,
	confirmVariant = 'primary',
	confirmDestructive = false,
	onConfirm,
	onCancel,
	children,
} ) => {
	const [ isBusy, setIsBusy ] = useState( false );

	const handleConfirm = async () => {
		setIsBusy( true );
		try {
			await onConfirm?.();
		} finally {
			setIsBusy( false );
		}
	};

	return (
		<Dialog
			design="simple"
			exitOnEsc
			scrollLock
			open={ open }
			setOpen={ ( next ) => {
				if ( ! next ) {
					onCancel?.();
				}
			} }
		>
			<Dialog.Backdrop />
			<Dialog.Panel>
				<Dialog.Header>
					<Dialog.Title>{ title }</Dialog.Title>
				</Dialog.Header>

				{ ( description || children ) && (
					<Dialog.Body>
						{ description && (
							<Dialog.Description>
								{ description }
							</Dialog.Description>
						) }
						{ children }
					</Dialog.Body>
				) }

				<Dialog.Footer>
					<Button variant="ghost" onClick={ onCancel } disabled={ isBusy }>
						{ cancelLabel || __( 'Cancel', 'presto-player' ) }
					</Button>
					<Button
						variant={ confirmVariant }
						destructive={ confirmDestructive }
						onClick={ handleConfirm }
						disabled={ isBusy }
						loading={ isBusy }
					>
						{ confirmLabel || __( 'Confirm', 'presto-player' ) }
					</Button>
				</Dialog.Footer>
			</Dialog.Panel>
		</Dialog>
	);
};

export default ConfirmDialog;
