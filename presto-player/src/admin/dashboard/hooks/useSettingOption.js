import { useCallback, useMemo } from 'react';
import isEqual from 'lodash/isEqual';
import { useSettingsData } from '../pages/settings/shared/SettingsDataProvider';

const useSettingOption = ( optionKey, defaultValue ) => {
	const {
		settings,
		lastSaved,
		isLoading,
		savingKeys,
		updateLocal,
		resetKey,
		saveSlice,
	} = useSettingsData();

	// WP core's /wp/v2/settings returns `null` for any stored value that fails
	// its registered schema (e.g. an empty string stored for a `boolean` option).
	// Treat null the same as undefined so the UI falls back to the default and
	// saves don't echo that null back — which WP rejects with
	// `rest_invalid_stored_value`.
	const rawData = settings?.[ optionKey ];
	const data =
		rawData === undefined || rawData === null ? defaultValue : rawData;

	const savedValue = lastSaved?.[ optionKey ];
	const effectiveSaved =
		savedValue === undefined || savedValue === null
			? defaultValue
			: savedValue;

	const setData = useCallback(
		( next ) => updateLocal( optionKey, next ),
		[ optionKey, updateLocal ]
	);

	const save = useCallback( () => saveSlice( [ optionKey ] ), [ saveSlice, optionKey ] );
	const reset = useCallback( () => resetKey( optionKey ), [ resetKey, optionKey ] );

	// Derived (not a flag): typing + reverting is cleanly not-dirty, and pasting
	// identical content doesn't falsely mark the page dirty. Deep equality is
	// required because most option values are objects (e.g. branding, bunny_stream).
	const isDirty = useMemo(
		() => ! isEqual( data, effectiveSaved ),
		[ data, effectiveSaved ]
	);

	const isSaving = savingKeys.has( optionKey );

	return useMemo(
		() => ( { data, setData, save, reset, isDirty, isSaving, isLoading } ),
		[ data, setData, save, reset, isDirty, isSaving, isLoading ]
	);
};

export default useSettingOption;
