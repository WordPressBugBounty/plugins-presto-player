import { __ } from '@wordpress/i18n';
import { useState } from 'react';
import {
	Container,
	Switch,
	Label,
	Input,
	Text,
	Title,
	toast,
	Tooltip,
} from '@bsf/force-ui';
import { Info } from 'lucide-react';
import SettingsPageShell from '../shared/SettingsPageShell';
import ProGate from '../shared/ProGate';
import LabelWithTooltip from '../shared/LabelWithTooltip';
import ConfirmDialog from '../shared/ConfirmDialog';
import useSettingOption from '../../../hooks/useSettingOption';
import useRegisterActivePage from '../../../hooks/useRegisterActivePage';
import { useSettingsData } from '../shared/SettingsDataProvider';
import { OPTION_KEYS, BUNNY_STREAM_KEYS } from '../config';
// eslint-disable-next-line import/no-unresolved
import TranscriptionLanguageSelect from '@/admin/blocks/shared/components/TranscriptionLanguageSelect';

const isPremium = window.prestoPlayer?.isPremium ?? false;

const Subsection = ( { title, description, children } ) => (
	<Container.Item className="flex flex-col gap-3">
		<div className="flex flex-col gap-1">
			<Title tag="h4" title={ title } size="xs" className="font-semibold" />
			{ description && (
				<Text size="xs" className="text-text-secondary">
					{ description }
				</Text>
			) }
		</div>
		<Container.Item className="flex flex-col gap-4">
			{ children }
		</Container.Item>
	</Container.Item>
);

const CollapsibleSection = ( { title, description, children } ) => {
	return (
		<Container
			direction="column"
			className="bg-background-primary border border-solid border-border-subtle rounded-xl shadow-sm p-5 gap-4"
		>
			<Title tag="h4" title={ title } size="xs" className="font-semibold" />
			{ description && (
				<Text size="sm" className="text-text-secondary">
					{ description }
				</Text>
			) }
			<Container direction="column" className="gap-4">
				{ children }
			</Container>
		</Container>
	);
};

const BunnyNetPage = ( { registerActivePage } ) => {
	const { saveSlice } = useSettingsData();
	const stream = useSettingOption( OPTION_KEYS.bunnyStream, {} );
	const streamPublic = useSettingOption( OPTION_KEYS.bunnyStreamPublic, {} );
	const streamPrivate = useSettingOption( OPTION_KEYS.bunnyStreamPrivate, {} );
	const pullZones = useSettingOption( OPTION_KEYS.bunnyPullZones, {} );

	const [ editBunny, setEditBunny ] = useState( false );
	const [ showTranscribeConfirm, setShowTranscribeConfirm ] = useState( false );
	const [ isSaving, setIsSaving ] = useState( false );

	const updateStream = ( patch ) =>
		stream.setData( ( p ) => ( { ...( p || {} ), ...patch } ) );
	const updateStreamPublic = ( patch ) =>
		streamPublic.setData( ( p ) => ( { ...( p || {} ), ...patch } ) );
	const updateStreamPrivate = ( patch ) =>
		streamPrivate.setData( ( p ) => ( { ...( p || {} ), ...patch } ) );
	const updatePullZones = ( patch ) =>
		pullZones.setData( ( p ) => ( { ...( p || {} ), ...patch } ) );

	const isDirty =
		stream.isDirty ||
		streamPublic.isDirty ||
		streamPrivate.isDirty ||
		pullZones.isDirty;
	const isLoading = stream.isLoading;

	// Bunny rejects transcription with zero languages — surface this as a
	// save-time block via the shell's `canSave` prop, but keep `isDirty` honest
	// so the unsaved-changes modal + beforeunload guard still fire for the
	// *other* Bunny fields the user may have edited.
	const isTranscriptionInvalid =
		!! stream.data?.transcribe_enabled &&
		( ! stream.data?.transcribe_languages ||
			stream.data.transcribe_languages.length === 0 );

	const handleSave = async () => {
		if ( isTranscriptionInvalid ) {
			toast.error(
				__(
					'Please select at least one transcription language before saving.',
					'presto-player'
				)
			);
			return;
		}
		setIsSaving( true );
		try {
			await saveSlice( BUNNY_STREAM_KEYS );
			toast.success( __( 'Settings saved.', 'presto-player' ), {
				autoDismiss: 3000,
			} );
		} catch ( err ) {
			toast.error( __( 'Could not save settings.', 'presto-player' ), {
				autoDismiss: 5000,
			} );
		} finally {
			setIsSaving( false );
		}
	};

	const handleDiscard = () => {
		stream.reset();
		streamPublic.reset();
		streamPrivate.reset();
		pullZones.reset();
	};

	useRegisterActivePage( registerActivePage, {
		isDirty,
		save: handleSave,
		discard: handleDiscard,
	} );

	return (
		<SettingsPageShell
			title={ __( 'Bunny.net', 'presto-player' ) }
			isDirty={ isDirty }
			isSaving={ isSaving }
			isLoading={ isLoading }
			canSave={ isDirty && ! isSaving && ! isTranscriptionInvalid }
			onSave={ handleSave }
		>
			<ProGate
				enabled={ isPremium }
				title={ __( 'Bunny.net Integration', 'presto-player' ) }
				description={ __(
					'Serve secure, high-performance video through your Bunny.net account.',
					'presto-player'
				) }
			>
				<Container direction="column" className="gap-4">
					<CollapsibleSection
						slug="streaming-defaults"
						title={ __( 'Streaming Defaults', 'presto-player' ) }
						description={ __(
							'Default playback behavior for all Bunny.net streams.',
							'presto-player'
						) }
							>
						<Container direction="column" className="gap-4">
							<Container.Item className="flex flex-col gap-2">
								<Label size="sm">
									{ __( 'Initial Quality Level', 'presto-player' ) }
								</Label>
								<Input
									size="md"
									type="number"
									value={ stream.data?.hls_start_level ?? '' }
									placeholder="480"
									onChange={ ( val ) => updateStream( { hls_start_level: val } ) }
								/>
								<Label size="xs" variant="help">
									{ __(
										'Set the default quality start level for all streams (e.g. 240, 360, 480, 720, 1080).',
										'presto-player'
									) }
								</Label>
							</Container.Item>

							<Switch
								size="md"
								value={ !! stream.data?.disable_legacy_storage }
								onChange={ ( val ) =>
									updateStream( { disable_legacy_storage: val } )
								}
								label={ {
									heading: __(
										'Disable Classic Bunny.net Storage',
										'presto-player'
									),
									description: __(
										'This will disable Bunny.net classic storage in your block UI.',
										'presto-player'
									),
								} }
							/>
						</Container>
					</CollapsibleSection>

					<CollapsibleSection
						slug="connection-settings"
						title={ __( 'Connection Settings', 'presto-player' ) }
						description={ __(
							'Manage your Bunny.net library credentials. Only edit if you know what you\'re doing.',
							'presto-player'
						) }
						>
						<Container direction="column" className="gap-4">
							<Switch
								size="md"
								value={ editBunny }
								onChange={ setEditBunny }
								label={ {
									heading: __( 'Edit Connection Settings', 'presto-player' ),
									description: __(
										"Toggle on to view and edit your Bunny.net library and storage credentials.",
										'presto-player'
									),
								} }
							/>

							{ editBunny && (
								<Container.Item className="flex flex-col gap-4">
								<Subsection
									title={ __( 'Bunny Stream (Public)', 'presto-player' ) }
								>
									<Container.Item className="flex flex-col gap-2">
										<LabelWithTooltip
											label={ __( 'Public Stream Library ID', 'presto-player' ) }
											tooltip={ __( 'Found in your Bunny Stream library settings.', 'presto-player' ) }
										/>
										<Input
											size="md"
											value={ streamPublic.data?.video_library_id || '' }
											onChange={ ( val ) =>
												updateStreamPublic( { video_library_id: val } )
											}
										/>
									</Container.Item>
									<Container.Item className="flex flex-col gap-2">
										<LabelWithTooltip
											label={ __( 'Public Stream Library API Key', 'presto-player' ) }
											tooltip={ __( 'API key from your Bunny Stream library settings.', 'presto-player' ) }
										/>
										<Input
											size="md"
											value={ streamPublic.data?.video_library_api_key || '' }
											onChange={ ( val ) =>
												updateStreamPublic( { video_library_api_key: val } )
											}
										/>
									</Container.Item>
									<Container.Item className="flex flex-col gap-2">
										<LabelWithTooltip
											label={ __( 'Public Stream CDN Hostname', 'presto-player' ) }
											tooltip={ __( 'Pull zone hostname for your public stream (e.g. your-library.b-cdn.net).', 'presto-player' ) }
										/>
										<Input
											size="md"
											value={ streamPublic.data?.pull_zone_url || '' }
											onChange={ ( val ) =>
												updateStreamPublic( { pull_zone_url: val } )
											}
										/>
									</Container.Item>
								</Subsection>

								<Subsection
									title={ __( 'Bunny Stream (Private)', 'presto-player' ) }
								>
									<Container.Item className="flex flex-col gap-2">
										<LabelWithTooltip
											label={ __( 'Private Stream Library ID', 'presto-player' ) }
											tooltip={ __( 'Found in your private Bunny Stream library settings.', 'presto-player' ) }
										/>
										<Input
											size="md"
											value={ streamPrivate.data?.video_library_id || '' }
											onChange={ ( val ) =>
												updateStreamPrivate( { video_library_id: val } )
											}
										/>
									</Container.Item>
									<Container.Item className="flex flex-col gap-2">
										<LabelWithTooltip
											label={ __( 'Private Stream Library API Key', 'presto-player' ) }
											tooltip={ __( 'API key from your private Bunny Stream library settings.', 'presto-player' ) }
										/>
										<Input
											size="md"
											value={ streamPrivate.data?.video_library_api_key || '' }
											onChange={ ( val ) =>
												updateStreamPrivate( { video_library_api_key: val } )
											}
										/>
									</Container.Item>
									<Container.Item className="flex flex-col gap-2">
										<LabelWithTooltip
											label={ __( 'Private Stream CDN Hostname', 'presto-player' ) }
											tooltip={ __( 'Pull zone hostname for your private stream.', 'presto-player' ) }
										/>
										<Input
											size="md"
											value={ streamPrivate.data?.pull_zone_url || '' }
											onChange={ ( val ) =>
												updateStreamPrivate( { pull_zone_url: val } )
											}
										/>
									</Container.Item>
									<Container.Item className="flex flex-col gap-2">
										<LabelWithTooltip
											label={ __( 'Private Stream Token Authentication Key', 'presto-player' ) }
											tooltip={ __( 'Used to sign secure video URLs. Found in your Bunny Stream library settings under "Token Authentication".', 'presto-player' ) }
										/>
										<Input
											size="md"
											value={ streamPrivate.data?.token_auth_key || '' }
											onChange={ ( val ) =>
												updateStreamPrivate( { token_auth_key: val } )
											}
										/>
									</Container.Item>
								</Subsection>

								<Subsection
									title={ __( 'Bunny.net Storage (Classic)', 'presto-player' ) }
									description={ __(
										'To change your API key, click "Reconnect" from a Bunny.net block.',
										'presto-player'
									) }
								>
									<Container.Item className="flex flex-col gap-2">
										<LabelWithTooltip
											label={ __( 'Public ID', 'presto-player' ) }
											tooltip={ __( 'Pull zone ID for your public Bunny.net storage zone.', 'presto-player' ) }
										/>
										<Input
											size="md"
											value={ pullZones.data?.public_id || '' }
											onChange={ ( val ) =>
												updatePullZones( { public_id: val } )
											}
										/>
									</Container.Item>
									<Container.Item className="flex flex-col gap-2">
										<LabelWithTooltip
											label={ __( 'Public Host Name', 'presto-player' ) }
											tooltip={ __( 'CDN hostname for your public storage pull zone.', 'presto-player' ) }
										/>
										<Input
											size="md"
											value={ pullZones.data?.public_hostname || '' }
											onChange={ ( val ) =>
												updatePullZones( { public_hostname: val } )
											}
										/>
									</Container.Item>
									<Container.Item className="flex flex-col gap-2">
										<LabelWithTooltip
											label={ __( 'Private ID', 'presto-player' ) }
											tooltip={ __( 'Pull zone ID for your private Bunny.net storage zone.', 'presto-player' ) }
										/>
										<Input
											size="md"
											value={ pullZones.data?.private_id || '' }
											onChange={ ( val ) =>
												updatePullZones( { private_id: val } )
											}
										/>
									</Container.Item>
									<Container.Item className="flex flex-col gap-2">
										<LabelWithTooltip
											label={ __( 'Private Host Name', 'presto-player' ) }
											tooltip={ __( 'CDN hostname for your private storage pull zone.', 'presto-player' ) }
										/>
										<Input
											size="md"
											value={ pullZones.data?.private_hostname || '' }
											onChange={ ( val ) =>
												updatePullZones( { private_hostname: val } )
											}
										/>
									</Container.Item>
									<Container.Item className="flex flex-col gap-2">
										<LabelWithTooltip
											label={ __( 'Private URL Token Authentication Key', 'presto-player' ) }
											tooltip={ __( 'Security key for URL signing in classic storage. Found in your Bunny CDN pull zone settings.', 'presto-player' ) }
										/>
										<Input
											size="md"
											type="password"
											value={ pullZones.data?.private_security_key || '' }
											onChange={ ( val ) =>
												updatePullZones( { private_security_key: val } )
											}
										/>
									</Container.Item>
								</Subsection>
							</Container.Item>
							) }
						</Container>
					</CollapsibleSection>

					<CollapsibleSection
						slug="automatic-captions"
						title={ __( 'Automatic Captions', 'presto-player' ) }
						description={ __(
							'Detects speech and generates captions for new videos. Includes translation into 50+ languages.',
							'presto-player'
						) }
						>
						<Container direction="column" className="gap-4">
							<Switch
								size="md"
								value={ !! stream.data?.transcribe_enabled }
								onChange={ ( val ) => {
									if ( val ) {
										setShowTranscribeConfirm( true );
									} else {
										updateStream( { transcribe_enabled: false } );
									}
								} }
								label={ {
									heading: __(
										'Enable Automatic Caption Generation',
										'presto-player'
									),
									description: __(
										'Enable auto-captioning for every video uploaded to your Bunny.net Stream Library. Translations can be managed from the player block toolbar.',
										'presto-player'
									),
								} }
							/>

							{ !! stream.data?.transcribe_enabled && (
								<TranscriptionLanguageSelect
									value={ stream.data?.transcribe_languages || [] }
									/* eslint-disable camelcase */
									onChange={ ( transcribe_languages ) =>
										updateStream( { transcribe_languages } )
									}
									/* eslint-enable camelcase */
									showWarning
								/>
							) }
						</Container>
					</CollapsibleSection>
				</Container>
			</ProGate>

			<ConfirmDialog
				open={ showTranscribeConfirm }
				title={ __( 'Caption Generation Charges', 'presto-player' ) }
				description={ __(
					'This will automatically generate captions for every video you upload, unlocking automatic captions and translations. You will be charged $0.10 per minute for each language from your Bunny.net account balance.',
					'presto-player'
				) }
				confirmLabel={ __( 'Enable', 'presto-player' ) }
				onConfirm={ () => {
					updateStream( { transcribe_enabled: true } );
					setShowTranscribeConfirm( false );
				} }
				onCancel={ () => setShowTranscribeConfirm( false ) }
			>
				<Text
					as="a"
					href="https://docs.bunny.net/docs/stream-pricing#transcribing"
					target="_blank"
					rel="noreferrer"
					size="sm"
					className="text-brand-primary-600 hover:underline"
				>
					{ __( 'View Bunny.net pricing details', 'presto-player' ) } →
				</Text>
			</ConfirmDialog>
		</SettingsPageShell>
	);
};

export default BunnyNetPage;
