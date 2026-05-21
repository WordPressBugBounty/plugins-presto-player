import { __ } from '@wordpress/i18n';
import { useCallback } from 'react';
import { Container, Switch, toast } from '@bsf/force-ui';
import SettingsPageShell from '../shared/SettingsPageShell';
import SectionCard from '../shared/SectionCard';
import useSettingOption from '../../../hooks/useSettingOption';
import useRegisterActivePage from '../../../hooks/useRegisterActivePage';
import { OPTION_KEYS } from '../config';

const ContributePage = ( { registerActivePage } ) => {
	const { data, setData, save, reset, isDirty, isSaving, isLoading } =
		useSettingOption( OPTION_KEYS.usageOptin, 'no' );

	const isEnabled = data === 'yes';

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
		<SettingsPageShell
			title={ __( 'Contribute', 'presto-player' ) }
			isDirty={ isDirty }
			isSaving={ isSaving }
			isLoading={ isLoading }
			onSave={ handleSave }
		>
			<SectionCard>
				<Container direction="column" className="gap-4">
					<Switch
						size="md"
						value={ isEnabled }
						onChange={ ( val ) => setData( val ? 'yes' : 'no' ) }
						label={ {
							heading: __(
								'Help shape the future of Presto Player.',
								'presto-player'
							),
							description: (
								<span className="block">
									{ __(
										'Share how you use the plugin so we can build features that matter, fix issues faster, and make smarter decisions.',
										'presto-player'
									) }{ ' ' }
									<a
										href="https://prestoplayer.com/share-usage-data/"
										target="_blank"
										rel="noreferrer"
										className="text-brand-primary-600 hover:underline"
									>
										{ __( 'Learn More', 'presto-player' ) }
									</a>
								</span>
							),
						} }
					/>
				</Container>
			</SectionCard>
		</SettingsPageShell>
	);
};

export default ContributePage;
