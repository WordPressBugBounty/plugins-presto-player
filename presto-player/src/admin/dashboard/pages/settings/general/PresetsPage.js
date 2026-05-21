import { __ } from '@wordpress/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import wpApiFetch from '@wordpress/api-fetch';
import { Container, Select, toast } from '@bsf/force-ui';
import SettingsPageShell from '../shared/SettingsPageShell';
import SectionCard from '../shared/SectionCard';
import ProGate from '../shared/ProGate';
import LabelWithTooltip from '../shared/LabelWithTooltip';
import useSettingOption from '../../../hooks/useSettingOption';
import useRegisterActivePage from '../../../hooks/useRegisterActivePage';
import { useSettingsData } from '../shared/SettingsDataProvider';
import { OPTION_KEYS } from '../config';

const DEFAULT_PRESET = { default_player_preset: 0 };
const isPremium = window.prestoPlayer?.isPremium ?? false;

const PresetsPage = ( { registerActivePage } ) => {
	const video = useSettingOption( OPTION_KEYS.presets, DEFAULT_PRESET );
	const audio = useSettingOption( OPTION_KEYS.audioPresets, DEFAULT_PRESET );
	const { saveSlice } = useSettingsData();

	const [ presetList, setPresetList ] = useState( [] );
	const [ audioPresetList, setAudioPresetList ] = useState( [] );

	// Refs so that the render props always read the latest list even when
	// Force UI's Select.Button caches the render callback in useCallback.
	const presetListRef = useRef( [] );
	const audioPresetListRef = useRef( [] );
	presetListRef.current = presetList;
	audioPresetListRef.current = audioPresetList;

	useEffect( () => {
		let cancelled = false;
		Promise.all( [
			wpApiFetch( { path: '/presto-player/v1/preset' } ).catch( () => [] ),
			wpApiFetch( { path: '/presto-player/v1/audio-preset' } ).catch(
				() => []
			),
		] ).then( ( [ presets, audioPresets ] ) => {
			if ( cancelled ) {
				return;
			}
			if ( Array.isArray( presets ) ) {
				setPresetList(
					presets.map( ( p ) => ( {
						value: String( p.id ),
						label: p.name || p.title,
					} ) )
				);
			}
			if ( Array.isArray( audioPresets ) ) {
				setAudioPresetList(
					audioPresets.map( ( p ) => ( {
						value: String( p.id ),
						label: p.name || p.title,
					} ) )
				);
			}
		} );
		return () => {
			cancelled = true;
		};
	}, [] );

	const isDirty = video.isDirty || audio.isDirty;
	const isSaving = video.isSaving || audio.isSaving;
	const isLoading = video.isLoading;

	const handleSave = useCallback( async () => {
		try {
			await saveSlice( [ OPTION_KEYS.presets, OPTION_KEYS.audioPresets ] );
			toast.success( __( 'Settings saved.', 'presto-player' ), {
				autoDismiss: 3000,
			} );
		} catch ( err ) {
			toast.error( __( 'Could not save settings.', 'presto-player' ), {
				autoDismiss: 5000,
			} );
		}
	}, [ saveSlice ] );

	const handleDiscard = useCallback( () => {
		video.reset();
		audio.reset();
	}, [ video, audio ] );

	useRegisterActivePage( registerActivePage, {
		isDirty,
		save: handleSave,
		discard: handleDiscard,
	} );

	return (
		<SettingsPageShell
			title={ __( 'Presets', 'presto-player' ) }
			isDirty={ isDirty }
			isSaving={ isSaving }
			isLoading={ isLoading }
			onSave={ handleSave }
		>
			<SectionCard>
				<ProGate
					enabled={ isPremium }
					title={ __( 'Player Presets', 'presto-player' ) }
					description={ __(
						'Set default presets for video and audio players.',
						'presto-player'
					) }
				>
					<Container direction="column" className="gap-4">
						<Container.Item className="flex flex-col gap-2">
							<LabelWithTooltip
								label={ __( 'Default Video Preset', 'presto-player' ) }
								tooltip={ __(
									'This preset will be automatically applied to every new video block you add.',
									'presto-player'
								) }
							/>
							<Select
								size="md"
								combobox
								value={
									video.data?.default_player_preset
										? String( video.data.default_player_preset )
										: ''
								}
								onChange={ ( val ) =>
									video.setData( ( prev ) => ( {
										...( prev || DEFAULT_PRESET ),
										default_player_preset: val ? Number( val ) : 0,
									} ) )
								}
							>
								<Select.Button
									render={ ( val ) =>
										presetListRef.current.find(
											( p ) => p.value === String( val )
										)?.label ?? __( 'Select a preset', 'presto-player' )
									}
								/>
								<Select.Options>
									{ presetList.length > 0 ? (
										presetList.map( ( preset ) => (
											<Select.Option
												key={ preset.value }
												value={ preset.value }
											>
												{ preset.label }
											</Select.Option>
										) )
									) : (
										<Select.Option value="">
											{ __( 'No presets available', 'presto-player' ) }
										</Select.Option>
									) }
								</Select.Options>
							</Select>
						</Container.Item>

						<Container.Item className="flex flex-col gap-2">
							<LabelWithTooltip
								label={ __( 'Default Audio Preset', 'presto-player' ) }
								tooltip={ __(
									'This preset will be automatically applied to every new audio block you add.',
									'presto-player'
								) }
							/>
							<Select
								size="md"
								combobox
								value={
									audio.data?.default_player_preset
										? String( audio.data.default_player_preset )
										: ''
								}
								onChange={ ( val ) =>
									audio.setData( ( prev ) => ( {
										...( prev || DEFAULT_PRESET ),
										default_player_preset: val ? Number( val ) : 0,
									} ) )
								}
							>
								<Select.Button
									render={ ( val ) =>
										audioPresetListRef.current.find(
											( p ) => p.value === String( val )
										)?.label ?? __( 'Select a preset', 'presto-player' )
									}
								/>
								<Select.Options>
									{ audioPresetList.length > 0 ? (
										audioPresetList.map( ( preset ) => (
											<Select.Option
												key={ preset.value }
												value={ preset.value }
											>
												{ preset.label }
											</Select.Option>
										) )
									) : (
										<Select.Option value="">
											{ __( 'No audio presets available', 'presto-player' ) }
										</Select.Option>
									) }
								</Select.Options>
							</Select>
						</Container.Item>
					</Container>
				</ProGate>
			</SectionCard>
		</SettingsPageShell>
	);
};

export default PresetsPage;
