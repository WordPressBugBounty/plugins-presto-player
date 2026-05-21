import { __ } from '@wordpress/i18n';
import { useCallback, useState } from 'react';
import { Container, Switch, toast } from '@bsf/force-ui';
import SettingsPageShell from '../shared/SettingsPageShell';
import SectionCard from '../shared/SectionCard';
import ConfirmDialog from '../shared/ConfirmDialog';
import useSettingOption from '../../../hooks/useSettingOption';
import useRegisterActivePage from '../../../hooks/useRegisterActivePage';
import { OPTION_KEYS } from '../config';

const DEFAULT_UNINSTALL = { uninstall_data: false };

const UninstallPage = ( { registerActivePage } ) => {
	const { data, setData, save, reset, isDirty, isSaving, isLoading } =
		useSettingOption( OPTION_KEYS.uninstall, DEFAULT_UNINSTALL );

	const [ showConfirm, setShowConfirm ] = useState( false );

	const handleToggle = ( val ) => {
		if ( val ) {
			setShowConfirm( true );
			return;
		}
		setData( { uninstall_data: false } );
	};

	const handleConfirm = () => {
		setShowConfirm( false );
		setData( { uninstall_data: true } );
	};

	const handleSave = useCallback( async () => {
		try {
			await save();
			toast.success( __( 'Settings saved.', 'presto-player' ), {
				autoDismiss: 3000,
			} );
		} catch ( err ) {
			toast.error( __( 'Could not save settings.', 'presto-player' ), {
				autoDismiss: 5000,
			} );
		}
	}, [ save ] );

	useRegisterActivePage( registerActivePage, {
		isDirty,
		save: handleSave,
		discard: reset,
	} );

	return (
		<>
			<SettingsPageShell
				title={ __( 'Uninstall Options', 'presto-player' ) }
				isDirty={ isDirty }
				isSaving={ isSaving }
				isLoading={ isLoading }
				onSave={ handleSave }
			>
				<SectionCard>
					<Container direction="column" className="gap-4">
						<Switch
							size="md"
							value={ !! data?.uninstall_data }
							onChange={ handleToggle }
							label={ {
								heading: __( 'Remove data on uninstall', 'presto-player' ),
								description: __(
									'This removes all data on uninstall.',
									'presto-player'
								),
							} }
						/>
					</Container>
				</SectionCard>
			</SettingsPageShell>

			<ConfirmDialog
				open={ showConfirm }
				title={ __( 'Remove all data?', 'presto-player' ) }
				description={ __(
					'Caution: This will permanently remove all plugin data on uninstall. This action is irreversible.',
					'presto-player'
				) }
				confirmLabel={ __( 'Yes, Remove Data', 'presto-player' ) }
				confirmDestructive={ true }
				onConfirm={ handleConfirm }
				onCancel={ () => setShowConfirm( false ) }
			/>
		</>
	);
};

export default UninstallPage;
