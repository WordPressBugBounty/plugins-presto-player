import { __ } from '@wordpress/i18n';
import { useCallback } from 'react';
import { toast } from '@bsf/force-ui';
import useSettingOption from './useSettingOption';
import useRegisterActivePage from './useRegisterActivePage';

/**
 * Collapses the "single-option page" ceremony into one call: option read,
 * patch-style update, save-with-toast, and registration with the nav guard.
 *
 * Used by pages that have exactly one option and the canonical save/discard
 * flow (YouTube, Google Analytics, Performance, etc.). Pages with multi-option
 * combined saves (Bunny, Presets) or non-option REST flows (License,
 * EmailCapture, Webhooks) talk to useSettingOption / useSettingsData directly.
 */
const useSimpleSettingsPage = ( optionKey, defaults, registerActivePage ) => {
	const { data, setData, save, reset, isDirty, isSaving, isLoading } =
		useSettingOption( optionKey, defaults );

	const update = useCallback(
		( patch ) =>
			setData( ( prev ) => ( { ...( prev || defaults ), ...patch } ) ),
		[ setData, defaults ]
	);

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

	return { data, update, handleSave, isDirty, isSaving, isLoading };
};

export default useSimpleSettingsPage;
