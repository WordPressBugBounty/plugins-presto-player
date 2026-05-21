import { __ } from '@wordpress/i18n';
import { useEffect } from 'react';
import { Alert, Button, Container, Title } from '@bsf/force-ui';
import SettingsSectionSkeleton from '../../../components/Skeletons/SettingsSectionSkeleton';
import { useSettingsData } from './SettingsDataProvider';

const SettingsPageShell = ( {
	title,
	isDirty = false,
	isSaving = false,
	isLoading = false,
	canSave,
	onSave,
	saveLabel,
	children,
} ) => {
	const { loadError, retryLoad } = useSettingsData();

	// Browser-level guard: warns when closing tab / navigating away while dirty.
	// Complements the in-app UnsavedChangesDialog (which only covers clicks
	// inside the dashboard SPA).
	useEffect( () => {
		if ( ! isDirty ) {
			return undefined;
		}
		const handler = ( event ) => {
			event.preventDefault();
			event.returnValue = '';
		};
		window.addEventListener( 'beforeunload', handler );
		return () => window.removeEventListener( 'beforeunload', handler );
	}, [ isDirty ] );

	const label =
		saveLabel ||
		( isSaving
			? __( 'Saving…', 'presto-player' )
			: __( 'Save', 'presto-player' ) );

	// canSave is an explicit override for pages with validation that should
	// block *saving* without lying about isDirty (which still drives the
	// unsaved-changes modal and beforeunload prompt). See BunnyNetPage's
	// transcription-language invariant for a concrete use.
	const saveEnabled = canSave !== undefined ? canSave : isDirty && ! isSaving;

	// Pages that have nothing to persist (e.g. License) simply omit `onSave`
	// — the shell skips the button entirely instead of showing a perpetually
	// disabled control.
	const showSave = typeof onSave === 'function';

	return (
		<div className="max-w-3xl w-full mx-auto flex flex-col gap-6">
			<Container className="w-full flex items-center justify-between">
				<Container.Item grow={ 1 }>
					<Title title={ title } size="md" />
				</Container.Item>
				{ showSave && (
					<Container.Item>
						<Button
							size="sm"
							disabled={ ! saveEnabled || isLoading || !! loadError }
							onClick={ onSave }
						>
							{ label }
						</Button>
					</Container.Item>
				) }
			</Container>

			{ loadError && (
				<Alert
					design="stack"
					variant="error"
					title={ __( "Couldn't load settings", 'presto-player' ) }
					content={ __(
						'We hit an error fetching your settings. Save is disabled until the load succeeds — please retry.',
						'presto-player'
					) }
					action={ {
						label: __( 'Retry', 'presto-player' ),
						onClick: retryLoad,
						type: 'button',
					} }
				/>
			) }

			{ isLoading ? <SettingsSectionSkeleton /> : children }
		</div>
	);
};

export default SettingsPageShell;
