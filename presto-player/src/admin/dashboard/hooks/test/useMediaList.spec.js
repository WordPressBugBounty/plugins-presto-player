import { renderHook, act } from '@testing-library/react-hooks';
import apiFetch from '@wordpress/api-fetch';
import useMediaList from '../useMediaList';

jest.mock( '@wordpress/api-fetch' );

// Minimal canned response matching /presto-player/v1/media-list envelope.
// `ok` mirrors `Response.ok` so the hook's HTTP-error path can be exercised.
const mockResponse = ( {
	items = [],
	total = items.length,
	totalPages = total ? Math.max( 1, Math.ceil( total / 25 ) ) : 0,
	counts = {
		publish: total,
		draft: 0,
		pending: 0,
		private: 0,
		future: 0,
		trash: 0,
	},
	allTags = [],
	ok = true,
	status = 200,
} = {} ) => ( {
	ok,
	status,
	headers: {
		get: ( h ) => {
			if ( h === 'X-WP-Total' ) {
				return String( total );
			}
			if ( h === 'X-WP-TotalPages' ) {
				return String( totalPages );
			}
			return null;
		},
	},
	json: async () => ( {
		items,
		total,
		total_pages: totalPages,
		page: 1,
		per_page: 25,
		counts,
		all_tags: allTags,
	} ),
} );

// apiFetch with `parse: false` rejects with the raw Response (not a
// thrown Error) on non-2xx. Mimic the shape the hook duck-types against:
// `{ status: number, json: () => Promise<envelope> }`. Avoiding the real
// `Response` constructor here keeps the spec compatible with jsdom, which
// doesn't ship one.
const mockHttpError = ( { status = 401, code = 'rest_forbidden', message = 'Sorry, you are not allowed.' } = {} ) => ( {
	status,
	headers: { get: () => null },
	json: async () => ( { code, message, data: { status } } ),
} );

const buildItem = ( id, title, overrides = {} ) => ( {
	id,
	title,
	status: 'publish',
	date: '2026-05-01T10:00:00',
	modified: '2026-05-01T10:00:00',
	post_name: `video-${ id }`,
	post_password: '',
	shortcode: `[presto_player id=${ id }]`,
	poster: '',
	author: { id: 1, name: 'Admin' },
	tags: [],
	link: '',
	...overrides,
} );

beforeEach( () => {
	apiFetch.mockReset();
} );

describe( 'useMediaList', () => {
	it( 'fetches once on mount with the default params', async () => {
		apiFetch.mockResolvedValue(
			mockResponse( { items: [ buildItem( 1, 'Hello' ) ] } )
		);

		const { result, waitForNextUpdate } = renderHook( () => useMediaList() );
		await waitForNextUpdate();

		expect( apiFetch ).toHaveBeenCalledTimes( 1 );
		const call = apiFetch.mock.calls[ 0 ][ 0 ];
		expect( call.parse ).toBe( false );
		expect( call.path ).toContain( '/presto-player/v1/media-list' );
		expect( call.path ).toContain( 'page=1' );
		expect( call.path ).toContain( 'per_page=25' );
		expect( call.path ).toContain( 'orderby=date' );
		expect( call.path ).toContain( 'order=desc' );
		expect( result.current.items ).toHaveLength( 1 );
		expect( result.current.items[ 0 ].title ).toBe( 'Hello' );
		expect( result.current.totalItems ).toBe( 1 );
	} );

	it( 'rebuilds the request when params change', async () => {
		apiFetch.mockResolvedValue( mockResponse( { items: [] } ) );

		const { rerender, waitForNextUpdate } = renderHook(
			( props ) => useMediaList( props ),
			{ initialProps: { search: '', page: 1 } }
		);
		await waitForNextUpdate();

		rerender( { search: 'lorem', page: 1 } );
		await waitForNextUpdate();

		const last = apiFetch.mock.calls.at( -1 )[ 0 ];
		expect( last.path ).toContain( 'search=lorem' );
	} );

	it( 'aborts an in-flight request when params change', async () => {
		const abortSpy = jest.fn();
		apiFetch.mockImplementation(
			() =>
				new Promise( () => {
					/* never resolves */
				} )
		);
		// Capture the signal from each call.
		const seenSignals = [];
		apiFetch.mockImplementation( ( { signal } ) => {
			seenSignals.push( signal );
			signal.addEventListener( 'abort', abortSpy );
			return new Promise( () => {} );
		} );

		const { rerender } = renderHook( ( props ) => useMediaList( props ), {
			initialProps: { search: '' },
		} );

		await act( async () => {
			rerender( { search: 'lorem' } );
		} );

		// The first signal should have been aborted when the second fetch started.
		expect( abortSpy ).toHaveBeenCalled();
		expect( seenSignals[ 0 ].aborted ).toBe( true );
	} );

	it( 'surfaces error and clears items on a non-abort failure', async () => {
		apiFetch.mockRejectedValue( new Error( 'boom' ) );

		const { result, waitForNextUpdate } = renderHook( () => useMediaList() );
		await waitForNextUpdate();

		expect( result.current.error ).toBe( 'boom' );
		expect( result.current.items ).toEqual( [] );
		expect( result.current.loading ).toBe( false );
	} );

	it( 'refetch() reissues the same request', async () => {
		apiFetch.mockResolvedValue(
			mockResponse( { items: [ buildItem( 1, 'a' ) ] } )
		);

		const { result, waitForNextUpdate } = renderHook( () => useMediaList() );
		await waitForNextUpdate();

		expect( apiFetch ).toHaveBeenCalledTimes( 1 );

		act( () => {
			result.current.refetch();
		} );
		await waitForNextUpdate();

		expect( apiFetch ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'decodes HTML entities in titles at the boundary', async () => {
		apiFetch.mockResolvedValue(
			mockResponse( { items: [ buildItem( 1, 'John&#039;s &amp; Co' ) ] } )
		);

		const { result, waitForNextUpdate } = renderHook( () => useMediaList() );
		await waitForNextUpdate();

		expect( result.current.items[ 0 ].title ).toBe( "John's & Co" );
	} );

	it( 'exposes counts and allTags from the envelope', async () => {
		apiFetch.mockResolvedValue(
			mockResponse( {
				items: [],
				counts: {
					publish: 12,
					draft: 3,
					pending: 0,
					private: 1,
					future: 0,
					trash: 5,
				},
				allTags: [ { id: 7, name: 'Marketing', slug: 'marketing' } ],
			} )
		);

		const { result, waitForNextUpdate } = renderHook( () => useMediaList() );
		await waitForNextUpdate();

		expect( result.current.counts.publish ).toBe( 12 );
		expect( result.current.counts.trash ).toBe( 5 );
		expect( result.current.allTags ).toEqual( [
			{ id: 7, name: 'Marketing', slug: 'marketing' },
		] );
	} );

	// F-2: apiFetch({ parse: false }) rejects with the raw Response on 4xx/5xx.
	// The hook must extract the error envelope's `message` from the rejected
	// Response and surface it via `error` instead of silently rendering an
	// empty list.
	it( 'surfaces HTTP error body message as error state', async () => {
		apiFetch.mockRejectedValueOnce(
			mockHttpError( {
				status: 401,
				code: 'rest_cookie_invalid_nonce',
				message: 'Cookie nonce is invalid',
			} )
		);

		const { result, waitForNextUpdate } = renderHook( () => useMediaList() );
		await waitForNextUpdate();

		expect( result.current.error ).toBe( 'Cookie nonce is invalid' );
		expect( result.current.items ).toEqual( [] );
		expect( result.current.loading ).toBe( false );
	} );

	// F-2 fallback: when the rejected Response body has no `message`, fall
	// back to "HTTP <status>" so the user still gets an actionable hint.
	it( 'falls back to "HTTP <status>" when error body lacks a message', async () => {
		apiFetch.mockRejectedValueOnce( {
			status: 500,
			headers: { get: () => null },
			json: async () => ( {} ),
		} );

		const { result, waitForNextUpdate } = renderHook( () => useMediaList() );
		await waitForNextUpdate();

		expect( result.current.error ).toBe( 'HTTP 500' );
	} );

	// F-6: `hasLoadedOnce` is false before the first response settles and
	// true thereafter (success OR error). Consumers gate their initial-load
	// skeleton on this flag.
	it( 'tracks hasLoadedOnce across success and error settles', async () => {
		apiFetch.mockResolvedValue(
			mockResponse( { items: [ buildItem( 1, 'a' ) ] } )
		);

		const { result, waitForNextUpdate } = renderHook( () => useMediaList() );

		// Hook initialises with hasLoadedOnce=false during the first fetch.
		expect( result.current.hasLoadedOnce ).toBe( false );
		await waitForNextUpdate();
		expect( result.current.hasLoadedOnce ).toBe( true );

		// Stays true even after a subsequent error.
		apiFetch.mockRejectedValueOnce( new Error( 'boom' ) );
		act( () => {
			result.current.refetch();
		} );
		await waitForNextUpdate();
		expect( result.current.hasLoadedOnce ).toBe( true );
		expect( result.current.error ).toBe( 'boom' );
	} );

	// F-12: an untitled draft renders as `Media #<id>` instead of a blank
	// string so the row remains identifiable in the dashboard.
	it( 'falls back to "Media #<id>" when title is empty', async () => {
		apiFetch.mockResolvedValue(
			mockResponse( { items: [ buildItem( 42, '' ) ] } )
		);

		const { result, waitForNextUpdate } = renderHook( () => useMediaList() );
		await waitForNextUpdate();

		expect( result.current.items[ 0 ].title ).toBe( 'Media #42' );
	} );

	// F-12: whitespace-only titles also fall back so we don't render
	// invisible link text.
	it( 'treats whitespace-only titles as empty', async () => {
		apiFetch.mockResolvedValue(
			mockResponse( { items: [ buildItem( 7, '   ' ) ] } )
		);

		const { result, waitForNextUpdate } = renderHook( () => useMediaList() );
		await waitForNextUpdate();

		expect( result.current.items[ 0 ].title ).toBe( 'Media #7' );
	} );
} );
