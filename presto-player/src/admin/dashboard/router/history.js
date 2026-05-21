/**
 * External dependencies
 */
import { createBrowserHistory } from 'history';

/**
 * WordPress dependencies
 */
import { buildQueryString } from '@wordpress/url';

const history = createBrowserHistory();

const originalHistoryPush = history.push;
const originalHistoryReplace = history.replace;

/**
 * Custom push/replace wrappers that accept a plain params object instead of
 * a full location descriptor.
 *
 * Navigation contract: params you don't pass are dropped, except for the
 * WordPress-admin routing params in PRESERVED_PARAM_KEYS. Those must survive
 * every navigation — otherwise admin.php loses the query args it needs to
 * route back to this page on reload (`?page=presto-dashboard&post_type=…`).
 *
 * Any app-level param the caller wants to keep must be passed explicitly.
 */
const PRESERVED_PARAM_KEYS = [ 'page', 'post_type' ];

function mergeParams( incoming ) {
	const currentAll = Object.fromEntries(
		new URLSearchParams( history.location.search )
	);
	const preserved = {};
	for ( const key of PRESERVED_PARAM_KEYS ) {
		if ( currentAll[ key ] !== undefined ) {
			preserved[ key ] = currentAll[ key ];
		}
	}
	const merged = { ...preserved, ...incoming };
	// Remove keys explicitly set to null or undefined (allows param deletion)
	Object.keys( merged ).forEach( ( key ) => {
		if ( merged[ key ] == null ) {
			delete merged[ key ];
		}
	} );
	return merged;
}

function push( params, state ) {
	const search = buildQueryString( mergeParams( params ) );
	return originalHistoryPush.call( history, { search }, state );
}

function replace( params, state ) {
	const search = buildQueryString( mergeParams( params ) );
	return originalHistoryReplace.call( history, { search }, state );
}

const locationMemo = new WeakMap();
function getLocationWithParams() {
	const location = history.location;
	let locationWithParams = locationMemo.get( location );
	if ( ! locationWithParams ) {
		locationWithParams = {
			...location,
			params: Object.fromEntries(
				new URLSearchParams( location.search )
			),
		};
		locationMemo.set( location, locationWithParams );
	}
	return locationWithParams;
}

history.push = push;
history.replace = replace;
history.getLocationWithParams = getLocationWithParams;

export default history;