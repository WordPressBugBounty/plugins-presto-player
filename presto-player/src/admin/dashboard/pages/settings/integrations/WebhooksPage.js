import { __ } from '@wordpress/i18n';
import { useEffect, useRef, useState } from 'react';
import { useSelect, useDispatch } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import isEqual from 'lodash/isEqual';
import {
	Button,
	Container,
	Dialog,
	Input,
	Label,
	Select,
	Loader,
	Text,
	toast,
	Tooltip,
} from '@bsf/force-ui';
import { Pencil, Trash2, Plus, X, Info } from 'lucide-react';
import SettingsPageShell from '../shared/SettingsPageShell';
import SectionCard from '../shared/SectionCard';
import ProGate from '../shared/ProGate';
import ConfirmDialog from '../shared/ConfirmDialog';
import useRegisterActivePage from '../../../hooks/useRegisterActivePage';
import { WEBHOOK_ENTITY } from '../config';

const isPremium = window.prestoPlayer?.isPremium ?? false;

const METHOD_OPTIONS = [
	{ label: 'GET', value: 'GET' },
	{ label: 'POST', value: 'POST' },
	{ label: 'PUT', value: 'PUT' },
];

const DEFAULT_FORM = {
	email_name: 'email',
	method: 'POST',
	name: '',
	url: '',
	headers: [],
};

const HeadersEditor = ( { headers, setHeaders } ) => {
	const update = ( index, patch ) =>
		setHeaders(
			( headers || [] ).map( ( h, i ) =>
				i === index ? { ...h, ...patch } : h
			)
		);
	const remove = ( index ) =>
		setHeaders( ( headers || [] ).filter( ( _, i ) => i !== index ) );
	const add = () =>
		setHeaders( [ ...( headers || [] ), { name: '', value: '' } ] );

	return (
		<Container direction="column" className="gap-2">
			<Label size="sm">{ __( 'Headers', 'presto-player' ) }</Label>
			{ ( headers || [] ).map( ( { name, value }, i ) => (
				<Container key={ i } align="center" className="gap-2">
					<Container.Item grow={ 1 }>
						<Input
							size="md"
							placeholder={ __( 'Header Name', 'presto-player' ) }
							value={ name || '' }
							onChange={ ( val ) => update( i, { name: val } ) }
						/>
					</Container.Item>
					<Container.Item grow={ 1 }>
						<Input
							size="md"
							placeholder={ __( 'Value', 'presto-player' ) }
							value={ value || '' }
							onChange={ ( val ) => update( i, { value: val } ) }
						/>
					</Container.Item>
					<Container.Item>
						<Button
							variant="ghost"
							size="xs"
							icon={ <X className="w-4 h-4" /> }
							onClick={ () => remove( i ) }
						/>
					</Container.Item>
				</Container>
			) ) }
			<Button
				variant="outline"
				size="xs"
				className="self-start"
				onClick={ add }
			>
				{ __( 'Add Header', 'presto-player' ) }
			</Button>
		</Container>
	);
};

const WebhookDialog = ( { open, webhook, onClose } ) => {
	const { saveEntityRecord } = useDispatch( coreStore );
	const { invalidateResolution } = useDispatch( coreStore );
	const [ form, setForm ] = useState( webhook || DEFAULT_FORM );
	const [ busy, setBusy ] = useState( false );

	// Snapshot of the form at dialog-open time. Used by closeWithGuard below
	// to diff against the current draft so we only prompt when something
	// actually changed. Re-snapshotting on (open, webhook) keeps the
	// "edit-existing" case honest when the user reopens the same dialog.
	const baselineRef = useRef( webhook || DEFAULT_FORM );

	useEffect( () => {
		if ( open ) {
			const initial = webhook || DEFAULT_FORM;
			setForm( initial );
			baselineRef.current = initial;
		}
	}, [ open, webhook ] );

	const update = ( patch ) => setForm( ( p ) => ( { ...p, ...patch } ) );
	const setHeaders = ( headers ) =>
		setForm( ( p ) => ( {
			...p,
			headers: typeof headers === 'function' ? headers( p.headers ) : headers,
		} ) );

	const closeWithGuard = () => {
		const isDirty = ! isEqual( form, baselineRef.current );
		if (
			isDirty &&
			// eslint-disable-next-line no-alert
			! window.confirm(
				__( 'Discard unsaved changes to this webhook?', 'presto-player' )
			)
		) {
			return;
		}
		onClose();
	};

	const submit = async () => {
		if ( ! form.name?.trim() || ! form.url?.trim() ) {
			toast.error( __( 'Name and URL are required.', 'presto-player' ) );
			return;
		}
		setBusy( true );
		try {
			await saveEntityRecord( ...WEBHOOK_ENTITY, form, { throwOnError: true } );
			// core-data caches the individual record, but the list query
			// (getEntityRecords) has its own resolver state that doesn't
			// auto-invalidate for custom entities. Force a re-resolve so the
			// parent list picks up the newly-created or edited record.
			await invalidateResolution( 'getEntityRecords', WEBHOOK_ENTITY );
			toast.success(
				form?.id
					? __( 'Webhook updated.', 'presto-player' )
					: __( 'Webhook created.', 'presto-player' )
			);
			onClose();
		} catch ( e ) {
			toast.error(
				e?.message || __( 'Something went wrong.', 'presto-player' )
			);
		} finally {
			setBusy( false );
		}
	};

	return (
		<Dialog
			design="simple"
			exitOnEsc
			scrollLock
			open={ open }
			setOpen={ ( next ) => {
				if ( ! next ) {
					closeWithGuard();
				}
			} }
		>
			<Dialog.Backdrop />
			<Dialog.Panel>
				<Dialog.Header>
					<Dialog.Title>
						{ form?.id
							? __( 'Edit Webhook', 'presto-player' )
							: __( 'Add Webhook', 'presto-player' ) }
					</Dialog.Title>
				</Dialog.Header>

				<Container direction="column" className="px-6 pb-2 gap-4">
					<Container.Item className="flex flex-col gap-2">
						<Label size="sm">{ __( 'Name', 'presto-player' ) }</Label>
						<Input
							size="md"
							value={ form.name || '' }
							placeholder={ __( 'Webhook feed name', 'presto-player' ) }
							onChange={ ( val ) => update( { name: val } ) }
						/>
					</Container.Item>

					<Container.Item className="flex flex-col gap-2">
						<div className="flex items-center gap-1.5">
							<Label size="sm">{ __( 'Request URL', 'presto-player' ) }</Label>
							<Tooltip content="The external endpoint that receives webhook data when a form event fires." arrow placement="right">
								<Info className="size-3.5 text-icon-secondary cursor-help shrink-0" />
							</Tooltip>
						</div>
						<Input
							size="md"
							type="url"
							value={ form.url || '' }
							placeholder={ __( 'Webhook URL', 'presto-player' ) }
							onChange={ ( val ) => update( { url: val } ) }
						/>
					</Container.Item>

					<Container.Item className="flex flex-col gap-2">
						<div className="flex items-center gap-1.5">
							<Label size="sm">{ __( 'Request Method', 'presto-player' ) }</Label>
							<Tooltip content="POST sends data in the request body (recommended). GET appends data to the URL." arrow placement="right">
								<Info className="size-3.5 text-icon-secondary cursor-help shrink-0" />
							</Tooltip>
						</div>
						<Select
							size="md"
							value={ form.method || 'POST' }
							onChange={ ( val ) => update( { method: val } ) }
						>
							<Select.Button />
							<Select.Options>
								{ METHOD_OPTIONS.map( ( m ) => (
									<Select.Option key={ m.value } value={ m.value }>
										{ m.label }
									</Select.Option>
								) ) }
							</Select.Options>
						</Select>
					</Container.Item>

					<Container.Item className="flex flex-col gap-2">
						<div className="flex items-center gap-1.5">
							<Label size="sm">{ __( 'Email Name', 'presto-player' ) }</Label>
							<Tooltip content='The key name used for the email field in the webhook payload. Default is "email".' arrow placement="right">
								<Info className="size-3.5 text-icon-secondary cursor-help shrink-0" />
							</Tooltip>
						</div>
						<Input
							size="md"
							value={ form.email_name || '' }
							placeholder={ __(
								'The name (key) of the email sent.',
								'presto-player'
							) }
							onChange={ ( val ) => update( { email_name: val } ) }
						/>
					</Container.Item>

					<Container.Item>
						<HeadersEditor headers={ form.headers } setHeaders={ setHeaders } />
					</Container.Item>
				</Container>

				<Dialog.Footer>
					<Button variant="ghost" onClick={ closeWithGuard } disabled={ busy }>
						{ __( 'Cancel', 'presto-player' ) }
					</Button>
					<Button
						variant="primary"
						onClick={ submit }
						disabled={ busy }
						loading={ busy }
					>
						{ form?.id
							? __( 'Update', 'presto-player' )
							: __( 'Create', 'presto-player' ) }
					</Button>
				</Dialog.Footer>
			</Dialog.Panel>
		</Dialog>
	);
};

const WebhookRow = ( { webhook, onEdit, onDelete, busy } ) => (
	<Container
		align="center"
		className="justify-between border border-border-subtle rounded-lg p-4"
	>
		<Container.Item grow={ 1 } className="flex flex-col min-w-0">
			<Text weight="semibold" size="sm" className="truncate">
				{ webhook.name || __( 'Untitled webhook', 'presto-player' ) }
			</Text>
			<Text size="xs" className="text-text-secondary truncate">
				{ webhook.url }
			</Text>
		</Container.Item>
		<Container.Item className="flex items-center gap-1">
			{ busy && <Loader size="sm" variant="primary" /> }
			<Button
				variant="ghost"
				size="xs"
				icon={ <Pencil className="w-4 h-4" /> }
				onClick={ onEdit }
				disabled={ busy }
			/>
			<Button
				variant="ghost"
				size="xs"
				icon={ <Trash2 className="w-4 h-4" /> }
				onClick={ onDelete }
				disabled={ busy }
			/>
		</Container.Item>
	</Container>
);

const WebhooksPage = ( { registerActivePage } ) => {
	const [ editing, setEditing ] = useState( null );
	const [ creating, setCreating ] = useState( false );
	const [ confirmDeleteId, setConfirmDeleteId ] = useState( null );

	const { deleteEntityRecord, invalidateResolution } = useDispatch( coreStore );

	// One parent-level subscription that yields a {id → busy} map, rather than
	// one useSelect per row. Cheaper and lets WebhookRow stay purely
	// presentational (takes `busy` as a prop instead of subscribing itself).
	const { webhooks, loading, busyMap } = useSelect( ( select ) => {
		const store = select( coreStore );
		const list = store.getEntityRecords( ...WEBHOOK_ENTITY ) || [];
		const busy = {};
		list.forEach( ( w ) => {
			busy[ w.id ] =
				store.isSavingEntityRecord( ...WEBHOOK_ENTITY, w.id ) ||
				store.isDeletingEntityRecord( ...WEBHOOK_ENTITY, w.id );
		} );
		return {
			webhooks: list,
			loading: store.isResolving( 'getEntityRecords', WEBHOOK_ENTITY ),
			busyMap: busy,
		};
	}, [] );

	useRegisterActivePage( registerActivePage, {
		isDirty: false,
		save: null,
		discard: null,
	} );

	const handleDelete = async () => {
		const id = confirmDeleteId;
		if ( ! id ) {
			return;
		}
		try {
			await deleteEntityRecord( ...WEBHOOK_ENTITY, id, undefined, {
				throwOnError: true,
			} );
			await invalidateResolution( 'getEntityRecords', WEBHOOK_ENTITY );
			toast.success( __( 'Webhook deleted.', 'presto-player' ) );
			setConfirmDeleteId( null );
		} catch ( e ) {
			toast.error(
				e?.message || __( 'Could not delete webhook.', 'presto-player' )
			);
		}
	};

	return (
		<SettingsPageShell
			title={ __( 'Webhooks', 'presto-player' ) }
			canSave={ false }
		>
			<SectionCard>
				<ProGate
					enabled={ isPremium }
					title={ __( 'Webhooks', 'presto-player' ) }
					description={ __(
						'Connect captured emails to any external service via webhooks.',
						'presto-player'
					) }
				>
					<Container direction="column" className="gap-4">
						{ ! loading && webhooks.length === 0 && (
							<Text size="sm" className="text-text-secondary">
								{ __(
									'No webhooks yet. Create one to get started.',
									'presto-player'
								) }
							</Text>
						) }

						{ webhooks.map( ( webhook ) => (
							<WebhookRow
								key={ webhook.id }
								webhook={ webhook }
								busy={ !! busyMap[ webhook.id ] }
								onEdit={ () => setEditing( webhook ) }
								onDelete={ () => setConfirmDeleteId( webhook.id ) }
							/>
						) ) }

						<Button
							variant="outline"
							size="sm"
							className="self-start"
							icon={ <Plus className="w-4 h-4" /> }
							onClick={ () => setCreating( true ) }
						>
							{ __( 'Create Webhook', 'presto-player' ) }
						</Button>
					</Container>
				</ProGate>
			</SectionCard>

			<WebhookDialog
				open={ creating }
				webhook={ null }
				onClose={ () => setCreating( false ) }
			/>
			<WebhookDialog
				open={ !! editing }
				webhook={ editing }
				onClose={ () => setEditing( null ) }
			/>
			<ConfirmDialog
				open={ !! confirmDeleteId }
				title={ __( 'Delete webhook?', 'presto-player' ) }
				description={ __(
					'This will permanently remove the webhook. This action cannot be undone.',
					'presto-player'
				) }
				confirmLabel={ __( 'Delete', 'presto-player' ) }
				onConfirm={ handleDelete }
				onCancel={ () => setConfirmDeleteId( null ) }
			/>
		</SettingsPageShell>
	);
};

export default WebhooksPage;
