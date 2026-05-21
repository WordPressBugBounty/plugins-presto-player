import { __ } from '@wordpress/i18n';
import { useCallback, useEffect, useState } from 'react';
import { Container, Skeleton, Text, toast } from '@bsf/force-ui';
import SettingsPageShell from '../shared/SettingsPageShell';
import SectionCard from '../shared/SectionCard';
import ProGate from '../shared/ProGate';
import useSettingOption from '../../../hooks/useSettingOption';
import useRegisterActivePage from '../../../hooks/useRegisterActivePage';
import { OPTION_KEYS } from '../config';

const DEFAULT_BRANDING = {
	logo: '',
	logo_width: 150,
	color: '#00b3ff',
	player_css: '',
};

const isPremium = window.prestoPlayer?.isPremium ?? false;

const CustomCssPage = ( { registerActivePage } ) => {
	const { data, setData, save, reset, isDirty, isSaving, isLoading } =
		useSettingOption( OPTION_KEYS.branding, DEFAULT_BRANDING );

	const [ CodeMirrorEditor, setCodeMirrorEditor ] = useState( null );
	const [ cssExtension, setCssExtension ] = useState( null );

	useEffect( () => {
		Promise.all( [
			import( '@uiw/react-codemirror' ),
			import( '@codemirror/lang-css' ),
		] ).then( ( [ CodeMirrorModule, CSSModule ] ) => {
			setCodeMirrorEditor( () => CodeMirrorModule.default );
			setCssExtension( () => CSSModule.css );
		} );
	}, [] );

	const update = ( patch ) =>
		setData( ( prev ) => ( {
			...( prev || DEFAULT_BRANDING ),
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
			title={ __( 'Custom CSS', 'presto-player' ) }
			isDirty={ isDirty }
			isSaving={ isSaving }
			isLoading={ isLoading }
			onSave={ handleSave }
		>
			<ProGate
				enabled={ isPremium }
				title={ __( 'Custom CSS', 'presto-player' ) }
				description={ __(
					'Style the player with custom CSS across your site.',
					'presto-player'
				) }
			>
				<SectionCard>
					<Container direction="column" className="gap-6">
						<Text size="sm" className="text-text-secondary">
							{ __(
								'Add custom CSS rules to fine-tune how your video player looks. Styles defined here apply globally to every Presto Player on your site.',
								'presto-player'
							) }
						</Text>
						<div className="presto-custom-css-panel presto-css-editor">
							{ ! CodeMirrorEditor || ! cssExtension ? (
								<Skeleton className="h-48 w-full" />
							) : (
								<CodeMirrorEditor
									value={ data?.player_css || '' }
									height="300px"
									extensions={ [ cssExtension() ] }
									onChange={ ( val ) => update( { player_css: val } ) }
									editable={ isPremium }
								/>
							) }
						</div>
						<Container direction="column" className="gap-2">
							<Text size="sm" weight={ 600 }>
								{ __( 'Quick Info:', 'presto-player' ) }
							</Text>
							<ul className="list-disc pl-5 m-0 flex flex-col gap-1.5">
								<li>
									<Text size="sm" className="text-text-secondary">
										{ __(
											'Use your browser’s developer tools (right-click → Inspect) to find the exact selectors before writing rules.',
											'presto-player'
										) }
									</Text>
								</li>
								<li>
									<Text size="sm" className="text-text-secondary">
										{ __(
											'Custom CSS loads after all default styles, so your rules override the player’s built-in styling without needing !important.',
											'presto-player'
										) }
									</Text>
								</li>
							</ul>
						</Container>
					</Container>
				</SectionCard>
			</ProGate>
		</SettingsPageShell>
	);
};

export default CustomCssPage;
