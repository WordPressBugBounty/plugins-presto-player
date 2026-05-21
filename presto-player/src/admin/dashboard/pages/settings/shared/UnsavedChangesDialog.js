import { __ } from '@wordpress/i18n';
import { useState } from 'react';
import { Dialog, Button, Loader } from '@bsf/force-ui';

const UnsavedChangesDialog = ( { open, onSave, onDiscard, onCancel } ) => {
	const [ isSaving, setIsSaving ] = useState( false );

	const handleSave = async () => {
		setIsSaving( true );
		try {
			await onSave?.();
		} finally {
			setIsSaving( false );
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
					<Dialog.Title>
						{ __( 'Unsaved changes', 'presto-player' ) }
					</Dialog.Title>
					<Dialog.Description>
						{ __(
							'You have unsaved changes on this page. What would you like to do?',
							'presto-player'
						) }
					</Dialog.Description>
				</Dialog.Header>

				<Dialog.Footer>
					<Button
						variant="outline"
						onClick={ onDiscard }
						disabled={ isSaving }
					>
						{ __( 'Discard Changes', 'presto-player' ) }
					</Button>
					<Button
						variant="primary"
						onClick={ handleSave }
						disabled={ isSaving }
						icon={
							isSaving && (
								<Loader
									icon={ null }
									size="sm"
									variant="primary"
									className="bg-transparent"
								/>
							)
						}
						iconPosition="right"
					>
						{ __( 'Save & Continue', 'presto-player' ) }
					</Button>
				</Dialog.Footer>
			</Dialog.Panel>
		</Dialog>
	);
};

export default UnsavedChangesDialog;
