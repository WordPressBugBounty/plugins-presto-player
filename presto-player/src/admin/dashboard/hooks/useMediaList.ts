import { useState, useEffect, useRef, useCallback } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';
import { __, sprintf } from '@wordpress/i18n';
import { decodeHTMLEntities } from '../utils/formatters';

/**
 * Server-driven Media Hub list hook.
 *
 * One request per page view: search, status, tag, orderby, order, page and
 * per_page are pushed to the server, which returns just the rows for the
 * current page along with the total counts and tag list. There is no
 * eager full-library fetch and no client-side filter / sort / slice.
 *
 * Mirrors the existing paginated-hook pattern in useTopVideosPaginated.js:
 * `parse: false` + AbortController on every param change so an in-flight
 * request is cancelled the moment the user types another keystroke or
 * switches tabs.
 */

const ENDPOINT = '/presto-player/v1/media-list';

export interface MediaTag {
	id: number;
	name: string;
	slug: string;
}

export interface MediaItem {
	id: number;
	title: string;
	status: string;
	date: string;
	modified: string;
	post_name: string;
	// Only present when caller can edit_post (WP REST context=edit).
	post_password?: string;
	shortcode: string;
	poster: string;
	author: { id: number; name: string };
	tags: MediaTag[];
	link: string;
}

export interface MediaListCounts {
	publish: number;
	draft: number;
	pending: number;
	private: number;
	future: number;
	trash: number;
}

export interface UseMediaListParams {
	search?: string;
	status?: string;
	tag?: number;
	orderby?: 'date' | 'modified' | 'title';
	order?: 'asc' | 'desc';
	page?: number;
	perPage?: number;
}

export interface UseMediaListReturn {
	items: MediaItem[];
	totalItems: number;
	totalPages: number;
	counts: MediaListCounts;
	allTags: MediaTag[];
	loading: boolean;
	error: string | null;
	/**
	 * Flips to true once the first response (success OR failure) has
	 * settled. Consumers use it to distinguish "first-paint skeleton" from
	 * "in-place refetch" without depending on counts.
	 */
	hasLoadedOnce: boolean;
	refetch: () => void;
}

const EMPTY_COUNTS: MediaListCounts = {
	publish: 0,
	draft: 0,
	pending: 0,
	private: 0,
	future: 0,
	trash: 0,
};

const DEFAULT_STATUSES = 'publish,draft,pending,private,future';

interface RawTag {
	id?: unknown;
	name?: unknown;
	slug?: unknown;
}

const normalizeTags = ( raw: unknown ): MediaTag[] => {
	if ( ! Array.isArray( raw ) ) {
		return [];
	}
	const out: MediaTag[] = [];
	for ( const candidate of raw ) {
		const t = candidate as RawTag;
		const id = Number( t?.id );
		if ( ! Number.isFinite( id ) || id <= 0 || ! t?.name ) {
			continue;
		}
		out.push( {
			id,
			name: String( t.name ),
			slug: typeof t.slug === 'string' ? t.slug : '',
		} );
	}
	return out;
};

// Sanitize a row on the boundary. The server already strips WP's
// "Protected: " / "Private: " prefix and decodes entities, but we mirror
// the consumer-side decode here so titles still render correctly if the
// server is ever bypassed by a fixture. Empty titles fall back to
// `Media #<id>` so an untitled draft renders as a recognisable row rather
// than a blank cell.
const normalizeItem = ( raw: unknown ): MediaItem => {
	const r = ( raw ?? {} ) as Record< string, unknown >;
	const authorRaw = ( r.author ?? {} ) as Record< string, unknown >;

	const id = Number( r.id ) || 0;
	const decoded = decodeHTMLEntities( String( r.title ?? '' ) ).trim();
	const title =
		decoded ||
		( id > 0
			? sprintf(
					/* translators: %d: id of an untitled media item */
					__( 'Media #%d', 'presto-player' ),
					id
			  )
			: '' );

	return {
		id,
		title,
		status: String( r.status ?? 'publish' ),
		date: String( r.date ?? '' ),
		modified: String( r.modified ?? '' ),
		post_name: String( r.post_name ?? '' ),
		post_password: String( r.post_password ?? '' ),
		shortcode: String( r.shortcode ?? '' ),
		poster: String( r.poster ?? '' ),
		author: {
			id: Number( authorRaw.id ) || 0,
			name: String( authorRaw.name ?? '' ),
		},
		tags: normalizeTags( r.tags ),
		link: String( r.link ?? '' ),
	};
};

/**
 * Read the JSON body of a Response-like object, swallowing parse errors.
 * Used both on the success path (apiFetch resolves the Response) and inside
 * the catch (apiFetch with `parse: false` THROWS the raw Response on non-2xx
 * — the thrown value is a Response, not an Error, and its body holds the
 * WP REST error envelope `{ code, message, data }`).
 */
const readJsonBody = async ( response: {
	json: () => Promise< any >;
} ): Promise< any > => {
	try {
		return await response.json();
	} catch {
		return {};
	}
};

/**
 * Duck-type check for a Response-like rejection from apiFetch. Avoids
 * `instanceof Response` because jsdom (Jest's test runtime) doesn't define
 * the global `Response` constructor.
 */
const isResponseLike = (
	err: unknown
): err is { status: number; json: () => Promise< any > } => {
	if ( ! err || typeof err !== 'object' ) {
		return false;
	}
	const e = err as { status?: unknown; json?: unknown };
	return typeof e.status === 'number' && typeof e.json === 'function';
};

/**
 * Extract a human-readable message from whatever `apiFetch` rejected with.
 * Three shapes are possible:
 *
 *  1. AbortError — caller cancelled; handled separately by `isAbort()`.
 *  2. Response-like — apiFetch's behaviour when `parse: false`; the body
 *     holds the WP REST error envelope.
 *  3. Plain Error / object — middleware-generated (offline, nonce refresh
 *     failure); already has `.message`.
 */
const messageFromRejection = async ( err: unknown ): Promise< string > => {
	if ( isResponseLike( err ) ) {
		const body = await readJsonBody( err );
		if ( typeof body?.message === 'string' && body.message ) {
			return body.message;
		}
		return `HTTP ${ err.status }`;
	}
	const maybeMessage = ( err as { message?: unknown } )?.message;
	if ( typeof maybeMessage === 'string' && maybeMessage ) {
		return maybeMessage;
	}
	return __( 'Failed to load media.', 'presto-player' );
};

const isAbort = ( err: unknown ): boolean =>
	( err as { name?: string } )?.name === 'AbortError';

const useMediaList = ( {
	search = '',
	status = DEFAULT_STATUSES,
	tag = 0,
	orderby = 'date',
	order = 'desc',
	page = 1,
	perPage = 25,
}: UseMediaListParams = {} ): UseMediaListReturn => {
	const [ items, setItems ] = useState< MediaItem[] >( [] );
	const [ totalItems, setTotalItems ] = useState( 0 );
	const [ totalPages, setTotalPages ] = useState( 0 );
	const [ counts, setCounts ] = useState< MediaListCounts >( EMPTY_COUNTS );
	const [ allTags, setAllTags ] = useState< MediaTag[] >( [] );
	const [ loading, setLoading ] = useState( true );
	const [ error, setError ] = useState< string | null >( null );
	const [ hasLoadedOnce, setHasLoadedOnce ] = useState( false );
	// Bump to force a refetch with identical params (e.g. after a mutation).
	const [ refetchKey, setRefetchKey ] = useState( 0 );
	const abortRef = useRef< AbortController | null >( null );

	const refetch = useCallback( () => {
		setRefetchKey( ( k ) => k + 1 );
	}, [] );

	useEffect( () => {
		if ( abortRef.current ) {
			abortRef.current.abort();
		}
		const controller = new AbortController();
		abortRef.current = controller;

		( async () => {
			try {
				setLoading( true );
				// `parse: false` lets us own pagination headers; the trade-off
				// is that apiFetch THROWS the raw Response on non-2xx instead
				// of resolving it, so the error envelope is recovered in the
				// catch block via `messageFromRejection`.
				const response = ( await apiFetch( {
					path: addQueryArgs( ENDPOINT, {
						search,
						status,
						tag,
						orderby,
						order,
						page,
						per_page: perPage,
					} ),
					parse: false,
					signal: controller.signal,
				} ) ) as Response;

				const json = await readJsonBody( response );

				if ( controller.signal.aborted ) {
					return;
				}

				setItems(
					Array.isArray( json?.items ) ? json.items.map( normalizeItem ) : []
				);
				setTotalItems( Number( json?.total ) || 0 );
				setTotalPages( Number( json?.total_pages ) || 0 );
				setCounts( { ...EMPTY_COUNTS, ...( json?.counts || {} ) } );
				setAllTags( normalizeTags( json?.all_tags ) );
				setError( null );
			} catch ( err ) {
				if ( isAbort( err ) || controller.signal.aborted ) {
					return;
				}
				const message = await messageFromRejection( err );
				setError( message );
				setItems( [] );
				setTotalItems( 0 );
				setTotalPages( 0 );
			} finally {
				if ( ! controller.signal.aborted ) {
					setLoading( false );
					setHasLoadedOnce( true );
				}
			}
		} )();

		return () => controller.abort();
	}, [ search, status, tag, orderby, order, page, perPage, refetchKey ] );

	return {
		items,
		totalItems,
		totalPages,
		counts,
		allTags,
		loading,
		error,
		hasLoadedOnce,
		refetch,
	};
};

export default useMediaList;
