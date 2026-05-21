import { __ } from '@wordpress/i18n';
import { useState } from 'react';
import { Button, Container, Input, Label, Text, toast } from '@bsf/force-ui';
import SettingsPageShell from '../shared/SettingsPageShell';
import SectionCard from '../shared/SectionCard';
import ConfirmDialog from '../shared/ConfirmDialog';
import useLicenseSettings from '../../../hooks/useLicenseSettings';
import useRegisterActivePage from '../../../hooks/useRegisterActivePage';

const LicensePage = ( { registerActivePage } ) => {
	const {
		isLoading,
		isActivating,
		isDeactivating,
		isActive,
		licenseKey: savedLicenseKey,
		activate,
		deactivate,
	} = useLicenseSettings();

	const [ licenseKey, setLicenseKey ] = useState( '' );
	const [ confirmDeactivateOpen, setConfirmDeactivateOpen ] = useState( false );

	useRegisterActivePage( registerActivePage, {
		isDirty: false,
		save: null,
		discard: null,
	} );

	const handleActivate = async () => {
		if ( ! licenseKey.trim() ) {
			toast.error( __( 'Please enter a license key.', 'presto-player' ) );
			return;
		}
		try {
			const data = await activate( licenseKey.trim() );
			setLicenseKey( '' );
			toast.success(
				data.message || __( 'License activated successfully.', 'presto-player' )
			);
			// Pro PHP components only register on the next request, and
			// `window.prestoPlayer.isPremium` is captured as a module-level
			// const in many dashboard files — a reload is the cleanest way
			// to bring the whole dashboard up in the licensed state.
			setTimeout( () => window.location.reload(), 600 );
		} catch ( err ) {
			toast.error(
				err.message || __( 'Could not activate license.', 'presto-player' )
			);
		}
	};

	const handleDeactivate = async () => {
		try {
			const data = await deactivate();
			setConfirmDeactivateOpen( false );
			toast.success(
				data.message || __( 'License deactivated.', 'presto-player' )
			);
			setTimeout( () => window.location.reload(), 600 );
		} catch ( err ) {
			setConfirmDeactivateOpen( false );
			toast.error(
				err.message || __( 'Could not deactivate license.', 'presto-player' )
			);
		}
	};

	const placeholderText = isActive
		? __( 'Your license is activated', 'presto-player' )
		: __( 'Paste your license key here', 'presto-player' );

	return (
		<SettingsPageShell
			title={ __( 'License', 'presto-player' ) }
			isLoading={ isLoading }
		>
			<SectionCard>
				<Container direction="column" className="gap-2">
					<Label size="sm">{ __( 'License Key', 'presto-player' ) }</Label>
					<Container direction="column" className="gap-3 md:flex-row w-full">
						<Container.Item grow={ 1 } shrink={ 1 } className="w-full">
							<Input
								type="text"
								size="md"
								placeholder={ placeholderText }
								value={ isActive ? savedLicenseKey : licenseKey }
								disabled={ isActive }
								onChange={ setLicenseKey }
								className="w-full"
							/>
						</Container.Item>
						{ isActive ? (
							<Button
								variant="outline"
								destructive
								onClick={ () => setConfirmDeactivateOpen( true ) }
								disabled={ isDeactivating }
							>
								{ __( 'Deactivate', 'presto-player' ) }
							</Button>
						) : (
							<Button
								variant="primary"
								onClick={ handleActivate }
								disabled={ isActivating || ! licenseKey }
								loading={ isActivating }
							>
								{ __( 'Activate', 'presto-player' ) }
							</Button>
						) }
					</Container>
					<Text size="xs" className="text-text-tertiary">
						{ __(
							'Enter the License Key you received when you purchased this product. If you lost the key, you can retrieve it from',
							'presto-player'
						) }{ ' ' }
						<Text
							as="a"
							size="xs"
							href="https://my.prestomade.com/my-account/"
							target="_blank"
							rel="noreferrer"
							className="text-brand-primary-600 hover:underline"
						>
							{ __( 'My Account', 'presto-player' ) }
						</Text>
					</Text>
				</Container>
			</SectionCard>

			<ConfirmDialog
				open={ confirmDeactivateOpen }
				title={ __( 'Deactivate license?', 'presto-player' ) }
				description={ __(
					'You will lose access to Pro features, automatic updates, and support on this site until you reactivate.',
					'presto-player'
				) }
				confirmLabel={ __( 'Deactivate', 'presto-player' ) }
				cancelLabel={ __( 'Cancel', 'presto-player' ) }
				confirmDestructive
				onConfirm={ handleDeactivate }
				onCancel={ () => setConfirmDeactivateOpen( false ) }
			/>
		</SettingsPageShell>
	);
};

export default LicensePage;
