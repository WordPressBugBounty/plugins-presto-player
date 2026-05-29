/**
 * Shared utils and constants for Emails page.
 * Used by Table; matches MediaHub pattern (formatPublishDate, getBadge, truncation).
 */
// eslint-disable-next-line import/no-extraneous-dependencies
import React from 'react';
const { __ } = wp.i18n;
import { Badge, Tooltip } from '@bsf/force-ui';

export const TRUNCATE_LENGTH = 40;

export const statusOptions = [
	{ label: __( 'All Status', 'presto-player' ), value: 'all' },
	{ label: __( 'Trashed', 'presto-player' ), value: 'trash' },
	{ label: __( 'Published', 'presto-player' ), value: 'publish' },
	{ label: __( 'Draft', 'presto-player' ), value: 'draft' },
	{ label: __( 'Pending Review', 'presto-player' ), value: 'pending' },
	{ label: __( 'Private', 'presto-player' ), value: 'private' },
	{ label: __( 'Scheduled', 'presto-player' ), value: 'future' },
];

/**
 * Truncate text with tooltip for full value (table cells). Returns "—" for empty.
 *
 * @param {string} text   - Value to show.
 * @param {number} maxLen - Max length before truncate (default TRUNCATE_LENGTH).
 * @return {React.ReactNode} Truncated text with ellipsis tooltip, or full string, or em dash if empty.
 */
export function renderTruncated( text, maxLen = TRUNCATE_LENGTH ) {
	const str = text || '';
	if ( ! str || str === '—' ) {
		return '—';
	}
	if ( str.length <= maxLen ) {
		return str;
	}
	const tooltipContent = (
		<span
			className="block max-w-[360px] break-all text-left"
			style={ { whiteSpace: 'normal', wordBreak: 'break-all' } }
		>
			{ str }
		</span>
	);
	return (
		<>
			{ str.slice( 0, maxLen - 1 ) }
			<Tooltip content={ tooltipContent } arrow placement="top">
				<span className="inline-block">…</span>
			</Tooltip>
		</>
	);
}

const statusBadgeConfig = {
	publish: { label: __( 'Published', 'presto-player' ), variant: 'green' },
	draft: { label: __( 'Draft', 'presto-player' ), variant: 'yellow' },
	trash: { label: __( 'Trashed', 'presto-player' ), variant: 'red' },
	pending: { label: __( 'Pending Review', 'presto-player' ), variant: 'blue' },
	private: { label: __( 'Private', 'presto-player' ), variant: 'inverse' },
	future: { label: __( 'Scheduled', 'presto-player' ), variant: 'blue' },
};

/**
 * Status badge for table (publish, draft, pending, etc.). Matches MediaHub getBadge.
 *
 * @param {string} status - Post status.
 * @return {React.ReactElement} Badge element for the status.
 */
export function getBadge( status ) {
	const { label, variant } = statusBadgeConfig[ status ] || {
		label: __( 'Unknown', 'presto-player' ),
		variant: 'gray',
	};
	return <Badge className="w-fit" variant={ variant } label={ label } />;
}

/**
 * Format date string for table display (YYYY/MM/DD at h:mm am/pm). "Just Now" for invalid.
 *
 * @param {string} dateString - ISO or date string.
 * @return {string} Formatted date (YYYY/MM/DD at h:mm am/pm) or "Just Now" if invalid.
 */
export function formatPublishDate( dateString ) {
	if ( ! dateString ) {
		return __( 'Just Now', 'presto-player' );
	}
	const date = new Date( dateString );
	if ( isNaN( date.getTime() ) ) {
		return __( 'Just Now', 'presto-player' );
	}
	const yyyy = date.getFullYear();
	const mm = String( date.getMonth() + 1 ).padStart( 2, '0' );
	const dd = String( date.getDate() ).padStart( 2, '0' );
	const hours = date.getHours();
	const minutes = String( date.getMinutes() ).padStart( 2, '0' );
	const ampm = hours >= 12 ? 'pm' : 'am';
	const hour12 = hours % 12 || 12;
	return `${ yyyy }/${ mm }/${ dd } at ${ hour12 }:${ minutes } ${ ampm }`;
}

/**
 * Compute the next selection when the header bulk-select checkbox is
 * toggled on a paginated table. Checking unions the current page's ids
 * with the existing selection (so picks on other pages survive a page
 * change); unchecking removes only the current page's ids.
 *
 * @param {Array<string|number>}         prev      - Currently selected ids.
 * @param {Array<{ id: string|number }>} pageItems - Rows visible on the current page.
 * @param {boolean}                      checked   - true to add, false to remove.
 * @return {Array<string|number>} The next selected-ids array.
 */
export function togglePageSelection( prev, pageItems, checked ) {
	const prevIds = prev || [];
	const pageIds = ( pageItems || [] ).map( ( item ) => item.id );
	if ( checked ) {
		return Array.from( new Set( [ ...prevIds, ...pageIds ] ) );
	}
	return prevIds.filter( ( id ) => ! pageIds.includes( id ) );
}

/**
 * Whether every row on the current page is in the selection. Empty page
 * returns false so the header checkbox doesn't render checked when there
 * is nothing on screen.
 *
 * @param {Array<{ id: string|number }>} pageItems
 * @param {Array<string|number>}         selected
 * @return {boolean}
 */
export function isPageFullySelected( pageItems, selected ) {
	if ( ! pageItems?.length ) {
		return false;
	}
	const selectedIds = selected || [];
	return pageItems.every( ( item ) => selectedIds.includes( item.id ) );
}

/**
 * Whether some — but not all — rows on the current page are in the
 * selection. Drives the header checkbox's indeterminate state.
 *
 * @param {Array<{ id: string|number }>} pageItems
 * @param {Array<string|number>}         selected
 * @return {boolean}
 */
export function isPagePartiallySelected( pageItems, selected ) {
	if ( ! pageItems?.length ) {
		return false;
	}
	const selectedIds = selected || [];
	const any = pageItems.some( ( item ) => selectedIds.includes( item.id ) );
	const all = pageItems.every( ( item ) => selectedIds.includes( item.id ) );
	return any && ! all;
}
