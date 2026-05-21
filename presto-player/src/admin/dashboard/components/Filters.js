/**
 * Reusable filter bar: per-page select + any number of custom selects + Clear.
 * Options: { value, label }[]. Each select: { options, value, onChange }.
 * Use in MediaHub, Emails, or any future list view.
 */
import React from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Select } from '@bsf/force-ui';
import { X } from 'lucide-react';

const PER_PAGE_VALUES = [ 10, 25, 50, 75, 100 ];

function FilterSelect( { value, onChange, options, valueKey = 'value', labelKey = 'label' } ) {
	const display = options.find( ( o ) => o[ valueKey ] === value )?.[ labelKey ] ?? '';
	return (
		<Select value={ display } onChange={ onChange } size="sm">
			<Select.Button label="" />
			<Select.Options>
				{ options.map( ( o ) => (
					<Select.Option key={ String( o[ valueKey ] ?? 'all' ) } value={ o[ valueKey ] }>
						{ o[ labelKey ] }
					</Select.Option>
				) ) }
			</Select.Options>
		</Select>
	);
}

export default function Filters( {
	postCount,
	setPostCount,
	perPageLabel,
	selects = [],
	onClear,
} ) {
	const perPageOptions = PER_PAGE_VALUES.map( ( n ) => ( {
		value: n,
		label: sprintf(
			/* translators: %d: number, %s: item type (e.g. Posts, Emails) */
			__( '%d %s per page', 'presto-player' ),
			n,
			perPageLabel
		),
	} ) );

	return (
		<div className="flex items-center gap-3 bg-background-primary p-4 rounded-lg">
			<span className="flex text-text-primary items-center w-fit">
				{ __( 'Filters: ', 'presto-player' ) }
			</span>
			<div className="w-full">
				<FilterSelect value={ postCount } onChange={ setPostCount } options={ perPageOptions } />
			</div>
			{ selects.map( ( sel, i ) => (
				<div key={ i } className="w-full">
					<FilterSelect
						value={ sel.value }
						onChange={ sel.onChange }
						options={ sel.options }
					/>
				</div>
			) ) }
			<button
				type="button"
				className="flex gap-1 items-center cursor-pointer w-fit border-0 bg-transparent p-0 text-inherit"
				onClick={ onClear }
				aria-label={ __( 'Clear filters', 'presto-player' ) }
			>
				<X width="15" height="15" aria-hidden="true" />
				{ __( 'Clear', 'presto-player' ) }
			</button>
		</div>
	);
}
