/**
 * Add/Edit email submission popup: email, status, visibility (public/private only), published date/time.
 * Visibility drives effectiveStatus (private => post status 'private'); password protection was removed.
 */
// eslint-disable-next-line import/no-extraneous-dependencies
import React, { useState, useEffect } from 'react';
import { __ } from '@wordpress/i18n';
import { Dialog, Button, Container, Input, Loader, Select, Tooltip } from '@bsf/force-ui';
import { Info, Settings } from 'lucide-react';
import PostScheduleField from '../PostScheduleField';
import {
	DEFAULT_STATE,
	getInitialState,
	getOptionLabel,
	toPublishedDateTime,
	STATUS_OPTIONS,
	VISIBILITY_OPTIONS,
} from './EmailFormPopupUtils';

function OptionSelect( { options, value, onChange, label, tooltip } ) {
	return (
		<div>
			{ label && (
				<div className="flex items-center gap-1 mb-1">
					<span className="text-sm font-medium text-field-label">{ label }</span>
					{ tooltip && (
						<Tooltip content={ tooltip } placement="right">
							<Info className="size-3.5 text-icon-secondary cursor-help shrink-0" />
						</Tooltip>
					) }
				</div>
			) }
			<Select by="value" size="md" value={ { value, label: getOptionLabel( options, value ) } } onChange={ ( o ) => o && onChange( o.value ) }>
				<Select.Button render={ ( v ) => v?.label } />
				<Select.Options>
					{ options.map( ( o ) => <Select.Option key={ o.value } value={ { value: o.value, label: o.label } }>{ o.label }</Select.Option> ) }
				</Select.Options>
			</Select>
		</div>
	);
}

const EmailFormPopup = ( { open, onClose, initialData, onSuccess } ) => {
	const [ email, setEmail ] = useState( '' );
	const [ status, setStatus ] = useState( 'publish' );
	const [ visibility, setVisibility ] = useState( 'public' );
	const [ publishedDate, setPublishedDate ] = useState( null );
	const [ publishedTimeValue, setPublishedTimeValue ] = useState( '' );
	const [ publishedPeriod, setPublishedPeriod ] = useState( '-1' );
	const [ saving, setSaving ] = useState( false );
	const [ errorMessage, setErrorMessage ] = useState( '' );
	// Tracks whether the user touched the date/time/period picker. Without this,
	// every save round-trips the time through the 10-min picker granularity and
	// drifts the stored post_date by up to 10 minutes — losing precision on edits
	// that didn't intend to change the timestamp at all.
	const [ dateTouched, setDateTouched ] = useState( false );

	const isEditMode = !! initialData?.id;

	useEffect( () => {
		if ( open ) {
			const s = getInitialState( initialData );
			setEmail( s.email );
			setStatus( s.status );
			setVisibility( s.visibility );
			setPublishedDate( s.publishedDate );
			setPublishedTimeValue( s.publishedTimeValue );
			setPublishedPeriod( s.publishedPeriod );
			setErrorMessage( '' );
			setSaving( false );
			setDateTouched( false );
		}
	}, [ open, initialData ] );

	const resetAndClose = () => {
		if ( saving ) return;
		setEmail( DEFAULT_STATE.email );
		setStatus( DEFAULT_STATE.status );
		setVisibility( DEFAULT_STATE.visibility );
		setPublishedDate( null );
		setPublishedTimeValue( '' );
		setPublishedPeriod( '-1' );
		setErrorMessage( '' );
		setDateTouched( false );
		onClose();
	};

	// Client-side hint only; server validates with is_email() and is authoritative.
	const isValidEmail = ( v ) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( ( v || '' ).trim() );

	const handleSave = async () => {
		const trimmed = ( email || '' ).trim();
		setErrorMessage( '' );
		if ( ! trimmed ) {
			setErrorMessage( __( 'Please enter an email address.', 'presto-player' ) );
			return;
		}
		if ( ! isValidEmail( trimmed ) ) {
			setErrorMessage( __( 'Please enter a valid email address.', 'presto-player' ) );
			return;
		}
		setSaving( true );
		try {
			const effectiveStatus = visibility === 'private' ? 'private' : status;
			const payload = {
				...( isEditMode && { id: initialData.id, email: trimmed, video_title: initialData.video_title, preset_name: initialData.preset_name } ),
				...( ! isEditMode && { email: trimmed } ),
				status: effectiveStatus,
				visibility,
				...( ( dateTouched || ! isEditMode ) && {
					date: toPublishedDateTime( publishedDate, publishedTimeValue, publishedPeriod ),
				} ),
			};
			const result = onSuccess?.( payload );
			if ( result?.then ) await result;
		} catch ( err ) {
			setErrorMessage( err?.message || __( 'Something went wrong.', 'presto-player' ) );
		} finally {
			setSaving( false );
		}
	};

	return (
		<Dialog design="simple" exitOnEsc scrollLock open={ open } setOpen={ ( v ) => ! v && resetAndClose() }>
			<Dialog.Backdrop />
			<Dialog.Panel className="max-w-2xl w-full overflow-visible">
				<Dialog.Header>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Settings size={ 20 } />
							<Dialog.Title>
								{ __( 'Post Settings', 'presto-player' ) }
							</Dialog.Title>
						</div>
						<Dialog.CloseButton onClick={ resetAndClose } />
					</div>
				</Dialog.Header>

				<Dialog.Body>
					<Container containerType="flex" direction="column">
						<Container.Item>
							<Input
								type="email"
								size="md"
								label={ __( 'Email', 'presto-player' ) }
								value={ email }
								onChange={ ( value ) => setEmail( value ) }
								placeholder={ __( 'Enter email address…', 'presto-player' ) }
								className="w-full"
							/>
							{ errorMessage && (
								<p className="text-sm text-text-error mt-1" role="alert">{ errorMessage }</p>
							) }
						</Container.Item>

						<Container.Item>
							<OptionSelect
							options={ STATUS_OPTIONS }
							value={ status }
							onChange={ setStatus }
							label={ __( 'Status', 'presto-player' ) }
							tooltip={ __( 'Controls the publication state — Published (live), Pending Review (awaiting approval), or Draft (not live yet).', 'presto-player' ) }
						/>
						</Container.Item>

						<Container.Item>
							<OptionSelect
								options={ VISIBILITY_OPTIONS }
								value={ visibility }
								onChange={ setVisibility }
								label={ __( 'Visibility', 'presto-player' ) }
								tooltip={ __( 'Controls who can access this submission — Public (everyone) or Private (admins only). Setting Private overrides the Status.', 'presto-player' ) }
							/>
						</Container.Item>

						<PostScheduleField
							date={ publishedDate }
							time={ publishedTimeValue }
							period={ publishedPeriod }
							setDate={ ( v ) => { setDateTouched( true ); setPublishedDate( v ); } }
							setTime={ ( v ) => { setDateTouched( true ); setPublishedTimeValue( v ); } }
							setPeriod={ ( v ) => { setDateTouched( true ); setPublishedPeriod( v ); } }
						/>
					</Container>
				</Dialog.Body>

				<Dialog.Footer className="pt-0 justify-between">
					<Button size="md" variant="outline" onClick={ resetAndClose } disabled={ saving }>{ __( 'Cancel', 'presto-player' ) }</Button>
					<Button size="md" disabled={ saving } onClick={ handleSave } iconPosition="right" icon={ saving && <Loader icon={ null } size="sm" variant="primary" /> }>
						{ __( 'Save Settings', 'presto-player' ) }
					</Button>
				</Dialog.Footer>
			</Dialog.Panel>
		</Dialog>
	);
};

export default EmailFormPopup;
