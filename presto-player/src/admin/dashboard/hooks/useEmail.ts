// eslint-disable-next-line import/no-extraneous-dependencies
import { useState, useMemo, useEffect } from 'react';
import apiFetch from '@wordpress/api-fetch';

// ============================================================================
// TYPES – same shape as backend list response
// ============================================================================

export interface EmailItem {
	id: number;
	email: string;
	video_title: string;
	preset_name: string;
	date: string;
	status?: string;
	visibility?: string;
}

export interface UseEmailReturn {
	emails: EmailItem[];
	rawEmails: EmailItem[];
	setRawEmails: React.Dispatch< React.SetStateAction< EmailItem[] > >;
	loading: boolean;
	sortField: string;
	sortOrder: 'asc' | 'desc';
	handleSort: ( field: string ) => void;
	fetchEmails: () => Promise< void >;
}

export const EMAIL_SUBMISSIONS_PATH = '/presto-player/v1/email-submissions';

// Must match RestEmailSubmissionsController::MAX_PER_PAGE.
const EMAIL_PAGE_SIZE = 100;
// Safety ceiling so a misconfigured server can't loop forever. 50 * 100 = 5,000 records
// fetched into the UI at most.
const EMAIL_MAX_PAGES = 50;

// ============================================================================
// SORTING UTILITIES – same pattern as useMedia
// ============================================================================

const createDateComparator = (
	sortOrder: 'asc' | 'desc'
): ( ( a: EmailItem, b: EmailItem ) => number ) => {
	return ( a: EmailItem, b: EmailItem ) => {
		const dateA = new Date( a.date || 0 ).getTime();
		const dateB = new Date( b.date || 0 ).getTime();
		if ( sortOrder === 'asc' ) {
			return dateA - dateB;
		}
		return dateB - dateA;
	};
};

const sortEmailItems = (
	items: EmailItem[],
	sortField: string,
	sortOrder: 'asc' | 'desc'
): EmailItem[] => {
	if ( ! items || items.length === 0 ) {
		return [];
	}
	const comparator = createDateComparator( sortOrder );
	return [ ...items ].sort( comparator );
};

// ============================================================================
// MAIN HOOK
// ============================================================================

const useEmail = (): UseEmailReturn => {
	const [ emails, setEmails ] = useState< EmailItem[] >( [] );
	const [ loading, setLoading ] = useState< boolean >( true );
	const [ sortField, setSortField ] = useState< string >( 'date' );
	const [ sortOrder, setSortOrder ] = useState< 'asc' | 'desc' >( 'desc' );

	/**
	 * Fetch email submissions from backend.
	 *
	 * The server caps per_page at EMAIL_PAGE_SIZE so a single request stays bounded; we walk
	 * pages using X-WP-TotalPages and stop at EMAIL_MAX_PAGES as a safety ceiling.
	 */
	const fetchEmails = async (): Promise< void > => {
		try {
			setLoading( true );
			const collected: EmailItem[] = [];
			let page = 1;
			let totalPages = 1;
			do {
				const response = ( await apiFetch( {
					path: `${ EMAIL_SUBMISSIONS_PATH }?per_page=${ EMAIL_PAGE_SIZE }&page=${ page }`,
					method: 'GET',
					parse: false,
				} ) ) as Response;
				const headerTotalPages = parseInt(
					response.headers.get( 'X-WP-TotalPages' ) || '1',
					10
				);
				totalPages = Number.isFinite( headerTotalPages ) && headerTotalPages > 0
					? headerTotalPages
					: 1;
				const items = ( await response.json() ) as EmailItem[];
				if ( Array.isArray( items ) ) {
					collected.push( ...items );
				}
				page += 1;
			} while ( page <= totalPages && page <= EMAIL_MAX_PAGES );
			setEmails( collected );
		} catch ( error ) {
			// eslint-disable-next-line no-console
			console.error( 'Error fetching emails:', error );
			setEmails( [] );
		} finally {
			setLoading( false );
		}
	};

	useEffect( () => {
		fetchEmails();
	}, [] );

	const handleSort = ( field: string ): void => {
		if ( sortField === field ) {
			setSortOrder( ( prev ) => ( prev === 'asc' ? 'desc' : 'asc' ) );
		} else {
			setSortField( field );
			setSortOrder( field === 'date' ? 'desc' : 'asc' );
		}
	};

	const sortedEmails = useMemo( () => {
		return sortEmailItems( emails, sortField, sortOrder );
	}, [ emails, sortField, sortOrder ] );

	return {
		emails: sortedEmails,
		rawEmails: emails,
		setRawEmails: setEmails,
		loading,
		sortField,
		sortOrder,
		handleSort,
		fetchEmails,
	};
};

export default useEmail;
