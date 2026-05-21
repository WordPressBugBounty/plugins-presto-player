import { __ } from '@wordpress/i18n';
import { useEffect, useState } from 'react';
import { Container, Switch, Alert, Tooltip } from '@bsf/force-ui';
import { Info } from 'lucide-react';
import SettingsPageShell from './shared/SettingsPageShell';
import SectionCard from './shared/SectionCard';
import useSimpleSettingsPage from '../../hooks/useSimpleSettingsPage';
import { OPTION_KEYS } from './config';

const DEFAULTS = {
	module_enabled: false,
	automations: true,
};

const PerformancePage = ( { registerActivePage } ) => {
	const { data, update, handleSave, isDirty, isSaving, isLoading } =
		useSimpleSettingsPage(
			OPTION_KEYS.performance,
			DEFAULTS,
			registerActivePage
		);

	const [ noteDismissed, setNoteDismissed ] = useState( false );

	// Reset dismissal when the feature is turned off so the note reappears
	// next time the user enables it — they may have forgotten the caveats.
	useEffect( () => {
		if ( ! data.module_enabled ) {
			setNoteDismissed( false );
		}
	}, [ data.module_enabled ] );

	return (
		<SettingsPageShell
			title={ __( 'Performance', 'presto-player' ) }
			isDirty={ isDirty }
			isSaving={ isSaving }
			isLoading={ isLoading }
			onSave={ handleSave }
		>
			<SectionCard>
				<Container direction="column" className="gap-4">
					<Switch
						size="md"
						value={ !! data.module_enabled }
						onChange={ ( val ) => update( { module_enabled: val } ) }
						label={ {
							heading: __( 'Dynamically Load JavaScript', 'presto-player' ),
							description: __(
								'Dynamically load javascript modules on the page which can significantly reduce javascript size and increase performance.',
								'presto-player'
							),
						} }
					/>

					{ !! data.module_enabled && ! noteDismissed && (
						<Alert
							design="stack"
							variant="info"
							title={ __( 'Please Note', 'presto-player' ) }
							content={
								<>
									{ __(
										'You may need to exclude the player script from combining, as well as enable CORS requests for some CDNs.',
										'presto-player'
									) }{ ' ' }
									<a
										href="https://prestoplayer.com/docs/performance-preferences-explained#global-player-performance-setting"
										target="_blank"
										rel="noreferrer"
										className="text-brand-primary-600 hover:underline"
									>
										{ __( 'Learn More', 'presto-player' ) }
									</a>
								</>
							}
							onClose={ () => setNoteDismissed( true ) }
						/>
					) }

					<Switch
						size="md"
						value={ !! data.automations }
						onChange={ ( val ) => update( { automations: val } ) }
						label={ {
							heading: (
								<span className="inline-flex items-center gap-1.5">
									{ __( 'Enable Ajax Requests for Progress Integrations', 'presto-player' ) }
									<Tooltip
										content={ __( 'Required for LMS, membership, and automation integrations to track video progress correctly. Disable only if you are not using any such integrations.', 'presto-player' ) }
										arrow
										placement="right"
									>
										<Info className="size-3.5 text-icon-secondary cursor-help shrink-0" />
									</Tooltip>
								</span>
							),
							description: __(
								'Keep this on unless you do not plan on using automation, LMS or membership integrations.',
								'presto-player'
							),
						} }
					/>
				</Container>
			</SectionCard>
		</SettingsPageShell>
	);
};

export default PerformancePage;
