/**
 * Shared constants and pure helpers for EmailFormPopup.
 */
import { __ } from '@wordpress/i18n';
import { format as formatDateFns } from 'date-fns';

const pad2 = ( n ) => String( n ).padStart( 2, '0' );

export const SELECT_TIME_OPTIONS = ( () => {
	const opts = [ { value: '', label: __( 'None', 'presto-player' ) } ];
	for ( let m = 0; m < 720; m += 10 ) {
		const h = Math.floor( m / 60 );
		opts.push( { value: pad2( h ) + ':' + pad2( m % 60 ), label: pad2( h ) + ':' + pad2( m % 60 ) } );
	}
	return opts;
} )();

export const PERIOD_OPTIONS = [
	{ value: '-1', label: __( 'None', 'presto-player' ) },
	{ value: '0', label: __( 'AM', 'presto-player' ) },
	{ value: '12', label: __( 'PM', 'presto-player' ) },
];

export const STATUS_OPTIONS = [
	{ value: 'publish', label: __( 'Published', 'presto-player' ) },
	{ value: 'future', label: __( 'Scheduled', 'presto-player' ) },
	{ value: 'pending', label: __( 'Pending Review', 'presto-player' ) },
	{ value: 'draft', label: __( 'Draft', 'presto-player' ) },
];

export const VISIBILITY_OPTIONS = [
	{ value: 'public', label: __( 'Public', 'presto-player' ) },
	{ value: 'private', label: __( 'Private', 'presto-player' ) },
];

export const DEFAULT_STATE = {
	email: '',
	status: 'publish',
	visibility: 'public',
	publishedDate: null,
	publishedTimeValue: '',
	publishedPeriod: '-1',
};

export const getOptionLabel = ( opts, val ) =>
	opts.find( ( o ) => o.value === val )?.label || opts[ 0 ]?.label;

function getLocalDateOnly( dateOrIso ) {
	if ( ! dateOrIso ) return null;
	const d = typeof dateOrIso === 'string' ? new Date( dateOrIso ) : dateOrIso;
	return isNaN( d.getTime() ) ? null : new Date( d.getFullYear(), d.getMonth(), d.getDate() );
}

function toHHMM( timeValue, period ) {
	if ( [ -1, '-1', '', null, undefined ].includes( period ) || ! timeValue ) return '00:00';
	let h12, min;
	if ( typeof timeValue === 'string' && timeValue.includes( ':' ) ) {
		[ h12, min ] = timeValue.split( ':' ).map( ( x ) => parseInt( x, 10 ) || 0 );
	} else {
		const t = parseFloat( timeValue );
		h12 = Math.floor( t );
		min = Math.round( ( t % 1 ) * 60 );
	}
	const p = Number( period );
	const h24 = p === 0 ? ( h12 === 0 ? 0 : h12 ) : h12 === 0 ? 12 : 12 + h12;
	return pad2( h24 ) + ':' + pad2( min );
}

function fromHHMM( hhmm ) {
	if ( ! hhmm ) return { timeValue: '', period: '-1' };
	const [ hStr, mStr ] = hhmm.split( ':' );
	const h = parseInt( hStr, 10 );
	if ( isNaN( h ) ) return { timeValue: '', period: '-1' };
	const m = parseInt( mStr, 10 ) || 0;
	const period = h < 12 ? '0' : '12';
	const h12 = h === 0 || h === 12 ? 0 : h > 12 ? h - 12 : h;
	const snap = Math.round( ( h12 * 60 + m ) / 10 ) * 10;
	return { timeValue: pad2( Math.floor( snap / 60 ) % 12 ) + ':' + pad2( snap % 60 ), period };
}

function fromDate( date ) {
	if ( ! date || isNaN( date.getTime() ) ) return { timeValue: '', period: '-1' };
	return fromHHMM( pad2( date.getHours() ) + ':' + pad2( date.getMinutes() ) );
}

function buildDate( date, timeValue, period ) {
	const local = getLocalDateOnly( date );
	if ( ! local ) return null;
	const [ h, m ] = toHHMM( timeValue, period ).split( ':' ).map( Number );
	return new Date( local.getFullYear(), local.getMonth(), local.getDate(), h, m, 0, 0 );
}

export function toPublishedDateTime( date, timeValue, period ) {
	const d = buildDate( date, timeValue, period );
	return d ? d.toISOString() : new Date().toISOString();
}

export function formatPublishedDisplay( date, timeValue, period ) {
	const d = buildDate( date, timeValue, period );
	return d ? formatDateFns( d, 'MMM d, yyyy' ) + ' ' + __( 'at', 'presto-player' ) + ' ' + formatDateFns( d, 'h:mm a' ) : '';
}

export function getInitialState( initialData ) {
	if ( ! initialData ) {
		return { ...DEFAULT_STATE, publishedDate: getLocalDateOnly( new Date() ) };
	}
	const dateObj = initialData.date ? new Date( initialData.date ) : new Date();
	const { timeValue, period } = fromDate( dateObj );
	let visibilityValue = initialData.visibility || 'public';
	if ( initialData.status === 'private' ) visibilityValue = 'private';
	return {
		email: initialData.email || '',
		status: initialData.status === 'private' ? 'publish' : ( initialData.status || 'publish' ),
		visibility: visibilityValue,
		publishedDate: getLocalDateOnly( dateObj ),
		publishedTimeValue: timeValue,
		publishedPeriod: period,
	};
}
