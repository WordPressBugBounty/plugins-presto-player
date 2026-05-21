import React from 'react';
import { __ } from '@wordpress/i18n';
import { Select } from '@bsf/force-ui';
import ChooseDate from './ChooseDate';
import {
	SELECT_TIME_OPTIONS,
	PERIOD_OPTIONS,
	getOptionLabel,
} from './Popup/EmailFormPopupUtils';

const PostScheduleField = ( {
	date,
	time,
	period,
	setDate,
	setTime,
	setPeriod,
} ) => {
	const timeSelectValue = time
		? SELECT_TIME_OPTIONS.find( ( o ) => o.value === time ) || SELECT_TIME_OPTIONS[ 0 ]
		: SELECT_TIME_OPTIONS[ 0 ];

	return (
		<div className="flex flex-col gap-2 flex-1 w-full">
			<span className="text-sm font-medium text-text-secondary whitespace-nowrap">
				{ __( 'Publish Date & Time', 'presto-player' ) }
			</span>
			<div className="flex flex-wrap items-center gap-3">
				<div className="flex-1 min-w-[12rem]">
					<ChooseDate
						chosenDate={ date }
						onPickDate={ ( s ) => {
							if ( ! s ) return setDate( null );
							const [ y, m, d ] = s.split( '-' ).map( Number );
							if ( y && m && d ) setDate( new Date( y, m - 1, d ) );
						} }
						placeholder={ __( 'Select date', 'presto-player' ) }
						size="md"
					/>
				</div>
				<span className="text-sm font-medium text-text-secondary whitespace-nowrap">
					{ __( 'at', 'presto-player' ) }
				</span>
				<div className="w-32">
					<Select
						by="value"
						value={ timeSelectValue }
						onChange={ ( o ) => o && setTime( o.value ) }
						size="md"
					>
						<Select.Button
							placeholder={ __( 'Select time', 'presto-player' ) }
							render={ ( v ) => v?.label || '' }
						/>
						<Select.Options>
							{ SELECT_TIME_OPTIONS.map( ( o ) => (
								<Select.Option
									key={ o.value || 'none' }
									value={ { value: o.value, label: o.label } }
								>
									{ o.label }
								</Select.Option>
							) ) }
						</Select.Options>
					</Select>
				</div>
				<div className="w-24">
					<Select
						by="value"
						value={ period ?? '-1' }
						onChange={ ( v ) => setPeriod( String( v ) ) }
						size="md"
					>
						<Select.Button
							placeholder={ __( 'Select', 'presto-player' ) }
							render={ ( v ) => getOptionLabel( PERIOD_OPTIONS, v ) }
						/>
						<Select.Options>
							{ PERIOD_OPTIONS.map( ( o ) => (
								<Select.Option key={ o.value } value={ o.value }>
									{ o.label }
								</Select.Option>
							) ) }
						</Select.Options>
					</Select>
				</div>
			</div>
		</div>
	);
};

export default PostScheduleField;
