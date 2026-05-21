import { __ } from '@wordpress/i18n';
import { useCallback } from 'react';
import { Container, Switch, toast, Tooltip } from '@bsf/force-ui';
import { Info } from 'lucide-react';
import SettingsPageShell from '../shared/SettingsPageShell';
import SectionCard from '../shared/SectionCard';
import ProGate from '../shared/ProGate';
import useSettingOption from '../../../hooks/useSettingOption';
import useRegisterActivePage from '../../../hooks/useRegisterActivePage';
import { OPTION_KEYS } from '../config';

const DEFAULT_ANALYTICS = {
	enable: false,
	purge_data: true,
};

const isPremium = window.prestoPlayer?.isPremium ?? false;

const ViewingAnalyticsPage = ( { registerActivePage } ) => {
	const { data, setData, save, reset, isDirty, isSaving, isLoading } =
		useSettingOption( OPTION_KEYS.analytics, DEFAULT_ANALYTICS );

	const update = ( patch ) =>
		setData( ( prev ) => ( {
			...( prev || DEFAULT_ANALYTICS ),
			...patch,
		} ) );

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
			title={ __( 'Video Analytics', 'presto-player' ) }
			isDirty={ isDirty }
			isSaving={ isSaving }
			isLoading={ isLoading }
			onSave={ handleSave }
		>
			<SectionCard>
				<ProGate
					enabled={ isPremium }
					title={ __( 'Video Analytics', 'presto-player' ) }
					description={ __(
						'Track video views, watch time, and engagement metrics.',
						'presto-player'
					) }
				>
					<Container direction="column" className="gap-4">
						<Switch
							size="md"
							value={ !! data.enable }
							onChange={ ( val ) => update( { enable: val } ) }
							label={ {
								heading: __( 'Enable', 'presto-player' ),
								description: __(
									'Enable view analytics for your media.',
									'presto-player'
								),
							} }
						/>

						{ data.enable && (
							<Switch
								size="md"
								value={ !! data.purge_data }
								onChange={ ( val ) => update( { purge_data: val } ) }
								label={ {
									heading: (
										<span className="inline-flex items-center gap-1.5">
											{ __( 'Auto-Purge Data (recommended)', 'presto-player' ) }
											<Tooltip
												content={ __(
													'Analytics records older than 90 days are automatically deleted to keep your database lean. Disable only if you need long-term historical data.',
													'presto-player'
												) }
												arrow
												placement="right"
											>
												<Info className="size-3.5 text-icon-secondary cursor-help shrink-0" />
											</Tooltip>
										</span>
									),
									description: __(
										'Automatically purge data older than 90 days.',
										'presto-player'
									),
								} }
							/>
						) }
					</Container>
				</ProGate>
			</SectionCard>
		</SettingsPageShell>
	);
};

export default ViewingAnalyticsPage;
