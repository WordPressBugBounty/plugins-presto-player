import { __ } from '@wordpress/i18n';
import { useCallback, useId, useMemo } from 'react';
import { flushSync } from 'react-dom';
import {
	Container,
	Input,
	Label,
	Button,
	FilePreview,
	toast,
} from '@bsf/force-ui';
import { Upload } from 'lucide-react';
import SettingsPageShell from '../shared/SettingsPageShell';
import SectionCard from '../shared/SectionCard';
import ProGate from '../shared/ProGate';
import useSettingOption from '../../../hooks/useSettingOption';
import useRegisterActivePage from '../../../hooks/useRegisterActivePage';
import { OPTION_KEYS } from '../config';
import { useMediaLibrary } from '../../../hooks/useMediaLibrary';
import ColorPicker from '../../../components/ColorPicker';

const DEFAULT_BRANDING = {
	logo: '',
	logo_width: 150,
	color: '#00b3ff',
	player_css: '',
};

const DEFAULT_LOGO_WIDTH = 150;
const LOGO_WIDTH_MIN = 1;
const LOGO_WIDTH_MAX = 400;
const BRAND_PRIMARY_600 = '#4f46e5';

const isPremium = window.prestoPlayer?.isPremium ?? false;

// MIME type for the FilePreview chip. Browsers tolerate any `image/*` value
// for the preview icon, but using the right one keeps the chip's affordance
// honest for SVG / PNG / WebP logos.
const mimeFromUrl = ( url ) => {
	const match = /\.([a-z0-9]+)(?:\?|#|$)/i.exec( url || '' );
	const ext = match ? match[ 1 ].toLowerCase() : '';
	switch ( ext ) {
		case 'png':
			return 'image/png';
		case 'gif':
			return 'image/gif';
		case 'webp':
			return 'image/webp';
		case 'svg':
			return 'image/svg+xml';
		case 'avif':
			return 'image/avif';
		case 'jpg':
		case 'jpeg':
		default:
			return 'image/jpeg';
	}
};

const clampLogoWidth = ( value ) => {
	const parsed = parseInt( value, 10 );
	if ( ! Number.isFinite( parsed ) ) {
		return DEFAULT_LOGO_WIDTH;
	}
	return Math.min( LOGO_WIDTH_MAX, Math.max( LOGO_WIDTH_MIN, parsed ) );
};

const BrandingPage = ( { registerActivePage } ) => {
	const logoInputId = useId();
	const logoWidthInputId = useId();
	const colorInputId = useId();

	const { data, setData, save, reset, isDirty, isSaving, isLoading } =
		useSettingOption( OPTION_KEYS.branding, DEFAULT_BRANDING );

	const update = useCallback(
		( patch ) =>
			setData( ( prev ) => ( {
				...( prev || DEFAULT_BRANDING ),
				...patch,
			} ) ),
		[ setData ]
	);

	const { openMediaLibrary, getFilename } = useMediaLibrary( update );

	const handleSave = useCallback( async () => {
		try {
			// Blank field → fall back to the default so the input always shows
			// a usable value after save instead of staying empty.
			if ( data.logo_width === undefined || data.logo_width === '' ) {
				flushSync( () => update( { logo_width: DEFAULT_LOGO_WIDTH } ) );
			}
			await save();
			toast.success( __( 'Settings saved.', 'presto-player' ), {
				autoDismiss: 3000,
			} );
		} catch ( err ) {
			toast.error( __( 'Could not save settings.', 'presto-player' ), {
				autoDismiss: 5000,
			} );
		}
	}, [ data, save, update ] );

	useRegisterActivePage( registerActivePage, {
		isDirty,
		save: handleSave,
		discard: reset,
	} );

	// Slider needs a numeric position even when the input is empty; falls back
	// to the default so the thumb has somewhere to sit. The number input keeps
	// the empty state and surfaces the default via the placeholder instead.
	const logoWidth = data.logo_width ?? DEFAULT_LOGO_WIDTH;
	const logoWidthInputValue = data.logo_width ?? '';

	const handleLogoWidthChange = ( val ) => {
		const next = String( val ?? '' );
		// Clearing the field unsets the key entirely — JSON serialization drops
		// `undefined` and the server-side `! empty()` fallback restores 150.
		// Avoids saving 0/null, both of which the REST schema (min:1, max:400)
		// would reject and which a stale stored 0 would propagate as 0px CSS.
		if ( next === '' ) {
			update( { logo_width: undefined } );
			return;
		}
		update( { logo_width: clampLogoWidth( next ) } );
	};

	const logoFilename = getFilename( data.logo );
	const logoFile = useMemo(
		() =>
			data.logo
				? {
						type: mimeFromUrl( data.logo ),
						name: logoFilename,
						url: data.logo,
				  }
				: null,
		[ data.logo, logoFilename ]
	);
	const sliderFillPercent =
		( ( logoWidth - LOGO_WIDTH_MIN ) / ( LOGO_WIDTH_MAX - LOGO_WIDTH_MIN ) ) *
		100;

	return (
		<SettingsPageShell
			title={ __( 'Branding', 'presto-player' ) }
			isDirty={ isDirty }
			isSaving={ isSaving }
			isLoading={ isLoading }
			onSave={ handleSave }
		>
			<SectionCard>
				<Container direction="column" className="gap-4">
					<ProGate
						enabled={ isPremium }
						title={ __( 'Custom Branding', 'presto-player' ) }
						description={ __(
							'Add your logo and personalize the player appearance.',
							'presto-player'
						) }
					>
						<Container.Item className="flex flex-col gap-2">
							<Label size="sm" htmlFor={ logoInputId }>
								{ __( 'Logo', 'presto-player' ) }
							</Label>
							<Input
								id={ logoInputId }
								type="text"
								size="md"
								readOnly
								className="cursor-pointer"
								value={ logoFilename || '' }
								placeholder={ __( 'No image selected', 'presto-player' ) }
								aria-label={ __( 'Choose a logo image', 'presto-player' ) }
								suffix={
									<Button
										variant="ghost"
										size="xs"
										icon={ <Upload className="w-4 h-4" /> }
										onClick={ openMediaLibrary( 'logo' ) }
										aria-label={ __(
											'Open media library to choose a logo',
											'presto-player'
										) }
									/>
								}
								onClick={ openMediaLibrary( 'logo' ) }
							/>
							{ logoFile && (
								<FilePreview
									file={ logoFile }
									onRemove={ () => update( { logo: '' } ) }
									size="sm"
								/>
							) }
							<Label size="xs" variant="help">
								{ __(
									'Add a logo to display in the player.',
									'presto-player'
								) }
							</Label>
						</Container.Item>

						<Container.Item className="flex flex-col gap-2">
							<Label size="sm" htmlFor={ logoWidthInputId }>
								{ __( 'Logo Max Width', 'presto-player' ) }
							</Label>
							<div className="flex items-center gap-3">
								<input
									type="range"
									min={ LOGO_WIDTH_MIN }
									max={ LOGO_WIDTH_MAX }
									value={ logoWidth }
									aria-label={ __( 'Logo max width', 'presto-player' ) }
									onChange={ ( e ) =>
										update( {
											logo_width: clampLogoWidth( e.target.value ),
										} )
									}
									className="flex-1 h-1 rounded-full appearance-none cursor-pointer accent-brand-primary-600"
									style={ {
										background: `linear-gradient(to right, ${ BRAND_PRIMARY_600 } ${ sliderFillPercent }%, #e5e7eb ${ sliderFillPercent }%)`,
									} }
								/>
								<Input
									id={ logoWidthInputId }
									type="number"
									size="md"
									className="w-24"
									value={ logoWidthInputValue }
									placeholder={ String( DEFAULT_LOGO_WIDTH ) }
									min={ LOGO_WIDTH_MIN }
									max={ LOGO_WIDTH_MAX }
									onChange={ handleLogoWidthChange }
									suffix={
										<span className="text-xs text-gray-400 pr-1">px</span>
									}
								/>
							</div>
							<Label size="xs" variant="help">
								{ __(
									'Set the maximum width of the logo in pixels.',
									'presto-player'
								) }
							</Label>
						</Container.Item>
					</ProGate>

					<Container.Item className="flex flex-col gap-2">
						<Label size="sm" htmlFor={ colorInputId }>
							{ __( 'Brand Color', 'presto-player' ) }
						</Label>
						<ColorPicker
							id={ colorInputId }
							name="color"
							value={ data.color }
							defaultColor="#00b3ff"
							onChange={ ( _name, color ) => update( { color } ) }
						/>
						<Label size="xs" variant="help">
							{ __(
								'Set the primary brand color for the player UI.',
								'presto-player'
							) }
						</Label>
					</Container.Item>
				</Container>
			</SectionCard>
		</SettingsPageShell>
	);
};

export default BrandingPage;
