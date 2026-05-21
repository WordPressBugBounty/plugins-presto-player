import { __ } from '@wordpress/i18n';
import { Container, Switch, Label, Input, Text } from '@bsf/force-ui';
import { ExternalLink } from 'lucide-react';
import SettingsPageShell from '../shared/SettingsPageShell';
import SectionCard from '../shared/SectionCard';
import useSimpleSettingsPage from '../../../hooks/useSimpleSettingsPage';
import { OPTION_KEYS } from '../config';

const DEFAULTS = {
	nocookie: false,
	channel_id: '',
};

const YouTubePage = ( { registerActivePage } ) => {
	const { data, update, handleSave, isDirty, isSaving, isLoading } =
		useSimpleSettingsPage( OPTION_KEYS.youtube, DEFAULTS, registerActivePage );

	return (
		<SettingsPageShell
			title={ __( 'YouTube', 'presto-player' ) }
			isDirty={ isDirty }
			isSaving={ isSaving }
			isLoading={ isLoading }
			onSave={ handleSave }
		>
			<SectionCard title={ __( 'YouTube', 'presto-player' ) }>
				<Container direction="column" className="gap-4">
					<Switch
						size="md"
						value={ !! data.nocookie }
						onChange={ ( val ) => update( { nocookie: val } ) }
						label={ {
							heading: __( 'Privacy-Enhanced Mode', 'presto-player' ),
							description: __(
								'Embed YouTube videos without using cookies that track viewing behaviour.',
								'presto-player'
							),
						} }
					/>

					<Container.Item className="flex flex-col gap-2">
						<Label size="sm">{ __( 'Channel ID', 'presto-player' ) }</Label>
						<Input
							size="md"
							value={ data.channel_id || '' }
							onChange={ ( val ) => update( { channel_id: val } ) }
						/>
						<Label size="xs" variant="help">
							{ __(
								'Enter the ID of your channel to enable YouTube Subscribe button functionality.',
								'presto-player'
							) }{ ' ' }
							<Text
								as="a"
								href="https://support.google.com/youtube/answer/3250431?hl=en"
								target="_blank"
								rel="noreferrer"
								size="xs"
								className="text-brand-primary-600 hover:underline inline-flex items-center gap-1"
							>
								{ __( 'Find my channel id', 'presto-player' ) }
								<ExternalLink className="w-3 h-3" />
							</Text>
						</Label>
					</Container.Item>
				</Container>
			</SectionCard>
		</SettingsPageShell>
	);
};

export default YouTubePage;
