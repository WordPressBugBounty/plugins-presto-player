import { __ } from '@wordpress/i18n';
import { useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { Container, Label, Select, Input, toast, Tooltip } from '@bsf/force-ui';
import { Info } from 'lucide-react';
import SettingsPageShell from '../shared/SettingsPageShell';
import SectionCard from '../shared/SectionCard';
import useSettingOption from '../../../hooks/useSettingOption';
import useRegisterActivePage from '../../../hooks/useRegisterActivePage';
import { OPTION_KEYS } from '../config';

const UNIT_OPTIONS = [
	{ label: 'px', value: 'px' },
	{ label: '%', value: '%' },
	{ label: 'vw', value: 'vw' },
	{ label: 'em', value: 'em' },
	{ label: 'rem', value: 'rem' },
];

const UNIT_VALUES = UNIT_OPTIONS.map( ( u ) => u.value );
// Anchored to the unit list so a stray non-numeric character in the value
// can't get swallowed into the unit slot (typing "8abc" used to save as
// "8abcpx" and then parse back as unit="abcpx", which the Select rendered).
const WIDTH_PATTERN = new RegExp( `^([\\d.]+)(${ UNIT_VALUES.join( '|' ) })$` );

const DEFAULT_WIDTH = '800px';
const DEFAULT_WIDTH_PLACEHOLDER = '800';

// Empty / unparseable values resolve to an empty value with the default unit
// so the user can clear the field while editing. The default (800px) is
// snapped back in on save so the saved option always renders as a valid
// CSS width.
const parseWidth = ( raw ) => {
	if ( ! raw ) {
		return { value: '', unit: 'px' };
	}
	const match = raw.match( WIDTH_PATTERN );
	if ( match ) {
		return { value: match[ 1 ], unit: match[ 2 ] };
	}
	return { value: '', unit: 'px' };
};

// Strip anything that isn't a digit or decimal point so the value field
// can't introduce characters that would corrupt the saved "<value><unit>"
// string.
const sanitizeWidthValue = ( raw ) => ( raw || '' ).replace( /[^\d.]/g, '' );

const MediaHubPage = ( { registerActivePage } ) => {
	const widthOption = useSettingOption( OPTION_KEYS.mediaHubWidth, '' );
	const syncOption = useSettingOption( OPTION_KEYS.mediaHubSync, true );

	const { value, unit } = useMemo(
		() => parseWidth( widthOption.data ),
		[ widthOption.data ]
	);

	const updateWidth = ( next ) => {
		const sanitized = sanitizeWidthValue( next );
		widthOption.setData( sanitized ? `${ sanitized }${ unit }` : '' );
	};
	const updateUnit = ( next ) =>
		widthOption.setData( value ? `${ value }${ next }` : '' );

	const isDirty = widthOption.isDirty || syncOption.isDirty;
	const isSaving = widthOption.isSaving || syncOption.isSaving;
	const isLoading = widthOption.isLoading;

	const handleSave = useCallback( async () => {
		try {
			// Blank field → fall back to the default so the input always shows
			// a usable value after save instead of staying empty.
			if ( ! widthOption.data ) {
				flushSync( () => widthOption.setData( DEFAULT_WIDTH ) );
			}
			await Promise.all( [ widthOption.save(), syncOption.save() ] );
			toast.success( __( 'Settings saved.', 'presto-player' ), {
				autoDismiss: 3000,
			} );
		} catch ( err ) {
			toast.error( __( 'Could not save settings.', 'presto-player' ), {
				autoDismiss: 5000,
			} );
		}
	}, [ widthOption, syncOption ] );

	const handleDiscard = useCallback( () => {
		widthOption.reset();
		syncOption.reset();
	}, [ widthOption, syncOption ] );

	useRegisterActivePage( registerActivePage, {
		isDirty,
		save: handleSave,
		discard: handleDiscard,
	} );

	return (
		<SettingsPageShell
			title={ __( 'Media Hub', 'presto-player' ) }
			isDirty={ isDirty }
			isSaving={ isSaving }
			isLoading={ isLoading }
			onSave={ handleSave }
		>
			<SectionCard>
				<Container direction="column" className="gap-4">
					<Container.Item className="flex flex-col gap-2">
						<div className="flex items-center gap-1.5">
							<Label size="sm">
								{ __( 'Default Sync Behavior', 'presto-player' ) }
							</Label>
							<Tooltip
								content={ __(
									'When enabled, blocks stay linked to their Media Hub entry and automatically reflect any changes made there.',
									'presto-player'
								) }
								arrow
								placement="right"
							>
								<Info className="size-3.5 text-icon-secondary cursor-help shrink-0" />
							</Tooltip>
						</div>
						<Select
							size="md"
							value={ syncOption.data ? 'true' : 'false' }
							onChange={ ( val ) => syncOption.setData( val === 'true' ) }
						>
							<Select.Button
								render={ ( val ) =>
									val === 'true'
										? __( 'Synced', 'presto-player' )
										: __( 'Not Synced', 'presto-player' )
								}
							/>
							<Select.Options>
								<Select.Option value="true">
									{ __( 'Synced', 'presto-player' ) }
								</Select.Option>
								<Select.Option value="false">
									{ __( 'Not Synced', 'presto-player' ) }
								</Select.Option>
							</Select.Options>
						</Select>
						<Label size="xs" variant="help">
							{ __(
								'Choose the default sync behavior of Presto Player blocks with the Media Hub.',
								'presto-player'
							) }
						</Label>
					</Container.Item>

					<Container.Item className="flex flex-col gap-2">
						<Label size="sm">
							{ __( 'Instant Video Page Width', 'presto-player' ) }
						</Label>
						<div className="flex gap-2 items-stretch">
							<div className="flex-1">
								<Input
									type="text"
									size="md"
									placeholder={ DEFAULT_WIDTH_PLACEHOLDER }
									value={ value }
									onChange={ ( val ) => updateWidth( val ) }
								/>
							</div>
							<div className="w-24">
								<Select
									size="md"
									value={ unit }
									onChange={ ( val ) => updateUnit( val ) }
								>
									<Select.Button />
									<Select.Options>
										{ UNIT_OPTIONS.map( ( u ) => (
											<Select.Option key={ u.value } value={ u.value }>
												{ u.label }
											</Select.Option>
										) ) }
									</Select.Options>
								</Select>
							</div>
						</div>
						<Label size="xs" variant="help">
							{ __(
								'Customize the video player width on the instant video page.',
								'presto-player'
							) }
						</Label>
					</Container.Item>
				</Container>
			</SectionCard>
		</SettingsPageShell>
	);
};

export default MediaHubPage;
