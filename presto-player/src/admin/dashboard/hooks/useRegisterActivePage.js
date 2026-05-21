import { useEffect, useRef } from 'react';

// Hands the active page's "is-dirty / how-to-save / how-to-discard" contract up
// to Settings.js's navigation guard (see pages/Settings.js).
//
// Why a ref + getter instead of re-registering on every value change:
//  - Navigation handlers in Settings.js only need to read isDirty/save/discard
//    at *click time* (sidebar click, tab click, back button) — not on every
//    keystroke. Reading from a ref keeps the sidebar from re-rendering while
//    the user types.
//  - We wrap save/discard as arrow functions that dispatch to latestRef so the
//    parent always invokes the *current* closure. If we registered the raw
//    closures, Settings.js would capture whichever render's save() ran first
//    and call it with stale `data` on next click.
//  - The `get isDirty()` accessor means the parent reads a live value without
//    us re-registering — critical because re-registering would retrigger the
//    effect cleanup and briefly null out the handlers.
const useRegisterActivePage = (
	registerActivePage,
	{ isDirty, save, discard }
) => {
	const latestRef = useRef( { isDirty, save, discard } );
	latestRef.current = { isDirty, save, discard };

	useEffect( () => {
		registerActivePage?.( {
			get isDirty() {
				return latestRef.current.isDirty;
			},
			save: () => latestRef.current.save?.(),
			discard: () => latestRef.current.discard?.(),
		} );
		// On page unmount, clear the registration so Settings.js doesn't try
		// to invoke stale handlers belonging to a page that no longer exists.
		return () => registerActivePage?.( null );
	}, [ registerActivePage ] );
};

export default useRegisterActivePage;
