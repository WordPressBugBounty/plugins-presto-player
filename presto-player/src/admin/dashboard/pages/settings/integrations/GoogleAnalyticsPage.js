import { __ } from '@wordpress/i18n';
import { Container, Switch, Label, Input } from '@bsf/force-ui';
import SettingsPageShell from '../shared/SettingsPageShell';
import SectionCard from '../shared/SectionCard';
import ProGate from '../shared/ProGate';
import useSimpleSettingsPage from '../../../hooks/useSimpleSettingsPage';
import { OPTION_KEYS } from '../config';

const DEFAULTS = {
	enable: false,
	use_existing_tag: false,
	measurement_id: '',
};

const isPremium = window.prestoPlayer?.isPremium ?? false;

const GoogleAnalyticsPage = ( { registerActivePage } ) => {
	const { data, update, handleSave, isDirty, isSaving, isLoading } =
		useSimpleSettingsPage(
			OPTION_KEYS.googleAnalytics,
			DEFAULTS,
			registerActivePage
		);

	return (
		<SettingsPageShell
			title={ __( 'Google Analytics', 'presto-player' ) }
			isDirty={ isDirty }
			isSaving={ isSaving }
			isLoading={ isLoading }
			onSave={ handleSave }
		>
			<SectionCard>
				<ProGate
					enabled={ isPremium }
					title={ __( 'Google Analytics', 'presto-player' ) }
					description={ __(
						'Send media events directly to your Google Analytics account.',
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
									'Send analytics events to your Google Analytics account.',
									'presto-player'
								),
							} }
						/>

						{ data.enable && (
							<>
								<Switch
									size="md"
									value={ !! data.use_existing_tag }
									onChange={ ( val ) => update( { use_existing_tag: val } ) }
									label={ {
										heading: __( 'Use existing on-page tag?', 'presto-player' ),
										description: __(
											"Should we use an existing Google Analytics (v4) tag? If not, we'll output one for you.",
											'presto-player'
										),
									} }
								/>

								<Container.Item className="flex flex-col gap-2">
									<Label size="sm">
										{ __( 'Measurement ID', 'presto-player' ) }
									</Label>
									<Input
										size="md"
										value={ data.measurement_id || '' }
										onChange={ ( val ) => update( { measurement_id: val } ) }
										placeholder="G-XXXXXXXXXX"
									/>
									<Label size="xs" variant="help">
										{ __(
											'Enter a Google Analytics Measurement ID, which can be found on your analytics admin page.',
											'presto-player'
										) }
									</Label>
								</Container.Item>
							</>
						) }
					</Container>
				</ProGate>
			</SectionCard>
		</SettingsPageShell>
	);
};

export default GoogleAnalyticsPage;
