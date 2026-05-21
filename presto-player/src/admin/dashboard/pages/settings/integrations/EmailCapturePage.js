import { __ } from '@wordpress/i18n';
import { useEffect, useRef, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import {
	Accordion,
	Badge,
	Button,
	Container,
	Input,
	Text,
	Title,
	Alert,
	toast,
} from '@bsf/force-ui';
import { Download } from 'lucide-react';
import SettingsPageShell from '../shared/SettingsPageShell';
import SectionCard from '../shared/SectionCard';
import ProGate from '../shared/ProGate';
import LabelWithTooltip from '../shared/LabelWithTooltip';
import useSettingOption from '../../../hooks/useSettingOption';
import useRegisterActivePage from '../../../hooks/useRegisterActivePage';
import { OPTION_KEYS } from '../config';

const isPremium = window.prestoPlayer?.isPremium ?? false;

const isValidHttpUrl = ( value ) => {
	const trimmed = ( value || '' ).trim();
	if ( ! trimmed ) {
		return false;
	}
	try {
		const parsed = new URL( trimmed );
		return parsed.protocol === 'http:' || parsed.protocol === 'https:';
	} catch {
		return false;
	}
};

const IntegrationHeader = ( { title } ) => (
	<span className="!text-base !font-semibold m-0 p-0" style={ { color: 'rgb(60, 67, 74)' } }>{ title }</span>
);

const IntegrationCard = ( {
	title,
	description,
	connected,
	onConnect,
	onDisconnect,
	isBusy,
	isConnectDisabled,
	error,
	connectButtonText,
	disconnectButtonText,
	children,
} ) => {
	const slug = title.toLowerCase().replace( /[^a-z0-9]+/g, '-' );

	if ( connected ) {
		return (
			<Container
				direction="column"
				className="bg-background-primary border border-solid border-border-subtle rounded-xl shadow-sm p-5 gap-3"
			>
				<Container
					direction="row"
					align="center"
					className="justify-between gap-3"
				>
					<Container
						direction="row"
						align="center"
						className="gap-3"
					>
						<IntegrationHeader title={ title } />
						<Badge
							label={ __( 'Connected', 'presto-player' ) }
							variant="green"
							size="xs"
							type="pill"
							closable={ false }
						/>
					</Container>
					<Button
						size="sm"
						variant="outline"
						onClick={ onDisconnect }
						disabled={ isBusy }
						loading={ isBusy }
					>
						{ disconnectButtonText ||
							__( 'Disconnect', 'presto-player' ) }
					</Button>
				</Container>
				{ error && <Alert variant="error" content={ error } /> }
			</Container>
		);
	}

	return (
		<Accordion autoClose iconType="arrow" type="boxed">
			<Accordion.Item
				value={ slug }
				className="bg-background-primary border border-solid border-border-subtle rounded-xl shadow-sm overflow-hidden"
			>
				<Accordion.Trigger
					iconType="arrow"
					className="p-5 hover:bg-transparent"
				>
					<IntegrationHeader title={ title } />
				</Accordion.Trigger>
				<Accordion.Content className="px-5 pb-5">
					<Container direction="column" className="gap-4">
						{ error && (
							<Alert variant="error" content={ error } />
						) }
						{ children }
						{ description && (
							<Text size="sm" className="text-text-secondary">
								{ description }
							</Text>
						) }
						<Container.Item>
							<Button
								size="sm"
								onClick={ onConnect }
								disabled={ isBusy || isConnectDisabled }
								loading={ isBusy }
							>
								{ connectButtonText ||
									__( 'Connect', 'presto-player' ) }
							</Button>
						</Container.Item>
					</Container>
				</Accordion.Content>
			</Accordion.Item>
		</Accordion>
	);
};

// Server-driven paginated export: the backend returns the *next* step number
// with each chunk; we re-POST until it replies with 'done'. We deliberately
// don't drive this from a for-loop — each chunk is a separate request so the
// UI can show progress and the user can navigate away mid-export.
const CsvExportSection = () => {
	const [ step, setStep ] = useState( 0 );
	const [ progress, setProgress ] = useState( 0 );
	const [ error, setError ] = useState( '' );
	const [ url, setUrl ] = useState( '' );

	// Guards against "setState after unmount" warnings if the user navigates
	// away between chunks. Export may span many seconds for large lists.
	const mountedRef = useRef( true );

	useEffect(
		() => () => {
			mountedRef.current = false;
		},
		[]
	);

	useEffect( () => {
		if ( ! step || step === 'done' ) {
			return;
		}
		( async () => {
			try {
				const {
					percentage,
					step: currentStep,
					url: fetchedURL,
				} = await apiFetch( {
					path: '/presto-player/v1/email/export',
					method: 'POST',
					data: { step },
				} );
				if ( ! mountedRef.current ) {
					return;
				}
				setStep( currentStep );
				setProgress( percentage );
				setUrl( fetchedURL );
			} catch ( e ) {
				if ( ! mountedRef.current ) {
					return;
				}
				setProgress( 0 );
				setError( e?.message || __( 'Something went wrong', 'presto-player' ) );
			}
		} )();
	}, [ step ] );

	// `window.open()` is only reliable inside a user gesture — popup blockers
	// suppress it when called after an async `await`. Two-step flow: first
	// click kicks off the export; second click on the returned link downloads.

	const startExport = () => {
		setError( '' );
		setUrl( '' );
		setStep( 1 );
		setProgress( 1 );
	};

	const isExporting = !! progress && progress < 100 && ! url;
	const isReady = !! url;

	return (
		<SectionCard
			title={ __( 'CSV Export', 'presto-player' ) }
			titleSize="xs"
			description={ __(
				'Using a service not listed here? Export captured contacts to a CSV file and upload them manually.',
				'presto-player'
			) }
		>
			<Container direction="column" className="gap-4">
				{ error && <Alert variant="error" content={ error } /> }
				<Container align="center" className="gap-3">
					{ isReady ? (
						<Button
							tag="a"
							href={ url }
							target="_blank"
							rel="noreferrer"
							size="sm"
							variant="primary"
							icon={ <Download className="w-4 h-4" /> }
							onClick={ () => {
								setUrl( '' );
								setProgress( 0 );
								setStep( 0 );
							} }
						>
							{ __( 'Download CSV File', 'presto-player' ) }
						</Button>
					) : (
						<Button
							size="sm"
							variant="primary"
							icon={ <Download className="w-4 h-4" /> }
							disabled={ isExporting }
							loading={ isExporting }
							onClick={ startExport }
						>
							{ isExporting
								? __( 'Preparing…', 'presto-player' )
								: __( 'Export to CSV', 'presto-player' ) }
						</Button>
					) }
					{ isExporting && (
						<Text size="xs" className="text-text-secondary">
							{ progress }%
						</Text>
					) }
				</Container>
			</Container>
		</SectionCard>
	);
};

const EmailCapturePage = ( { registerActivePage } ) => {
	const mailchimp = useSettingOption( OPTION_KEYS.mailchimp, {
		api_key: '',
		connected: false,
	} );
	const mailerlite = useSettingOption( OPTION_KEYS.mailerlite, {
		api_key: '',
		connected: false,
	} );
	const activecampaign = useSettingOption( OPTION_KEYS.activecampaign, {
		api_key: '',
		url: '',
		connected: false,
	} );
	const fluentcrm = useSettingOption( OPTION_KEYS.fluentcrm, {
		connected: false,
	} );

	const [ busy, setBusy ] = useState( {} );
	const [ errors, setErrors ] = useState( {} );

	// Page has no dirty state: connect/disconnect commit server-side immediately.
	// Registering isDirty:false lets the user navigate freely, while each card
	// owns its own per-integration busy/error state below.
	useRegisterActivePage( registerActivePage, {
		isDirty: false,
		save: null,
		discard: null,
	} );

	// Connect/disconnect calls go to plugin-specific REST endpoints (not
	// /wp/v2/settings). We still pipe the response through the provider via
	// option.setData so any later read of the mailchimp/etc. settings sees
	// the fresh `connected` state without a refetch.
	const request = async ( key, path, data, option, successMsg ) => {
		setErrors( ( p ) => ( { ...p, [ key ]: '' } ) );
		setBusy( ( p ) => ( { ...p, [ key ]: true } ) );
		try {
			const response = await apiFetch( { path, method: 'POST', data } );
			option.setData( ( prev ) => ( { ...( prev || {} ), ...response } ) );
			toast.success( successMsg || __( 'Success', 'presto-player' ) );
		} catch ( e ) {
			const msg = e?.message || __( 'Request failed.', 'presto-player' );
			setErrors( ( p ) => ( { ...p, [ key ]: msg } ) );
			toast.error( msg );
		} finally {
			setBusy( ( p ) => ( { ...p, [ key ]: false } ) );
		}
	};

	return (
		<SettingsPageShell
			title={ __( 'Email Capture', 'presto-player' ) }
			isLoading={ mailchimp.isLoading }
			canSave={ false }
		>
			<ProGate
				enabled={ isPremium }
				title={ __( 'Email Capture', 'presto-player' ) }
				description={ __(
					'Capture viewer emails straight into your email marketing platform.',
					'presto-player'
				) }
			>
				<Container direction="column" className="gap-4">
						<IntegrationCard
							title="Mailchimp"
							description={ __(
								'Find your API key in your Mailchimp account under Profile → Extras → API keys.',
								'presto-player'
							) }
							connected={ !! mailchimp.data?.connected }
							isBusy={ !! busy.mailchimp }
							isConnectDisabled={
								! mailchimp.data?.api_key?.trim()
							}
							error={ errors.mailchimp }
							onConnect={ () =>
								request(
									'mailchimp',
									'/presto-player/v1/mailchimp/connect',
									{ api_key: mailchimp.data?.api_key },
									mailchimp,
									__( 'Connected', 'presto-player' )
								)
							}
							onDisconnect={ () =>
								request(
									'mailchimp',
									'/presto-player/v1/mailchimp/disconnect',
									{},
									mailchimp,
									__( 'Disconnected', 'presto-player' )
								)
							}
						>
							<Container.Item className="flex flex-col gap-2">
								<LabelWithTooltip
									label={ __(
										'Your Mailchimp API Key',
										'presto-player'
									) }
									tooltip={ __(
										'Generate this in Mailchimp under Profile → Extras → API keys.',
										'presto-player'
									) }
								/>
								<Input
									size="md"
									type="password"
									value={ mailchimp.data?.api_key || '' }
									onChange={ ( val ) =>
										mailchimp.setData( ( p ) => ( {
											...( p || {} ),
											api_key: val,
										} ) )
									}
								/>
							</Container.Item>
						</IntegrationCard>

						<IntegrationCard
							title="MailerLite"
							description={ __(
								'Get your API key from MailerLite under Integrations → Developer API.',
								'presto-player'
							) }
							connected={ !! mailerlite.data?.connected }
							isBusy={ !! busy.mailerlite }
							isConnectDisabled={
								! mailerlite.data?.api_key?.trim()
							}
							error={ errors.mailerlite }
							onConnect={ () =>
								request(
									'mailerlite',
									'/presto-player/v1/mailerlite/connect',
									{ api_key: mailerlite.data?.api_key },
									mailerlite,
									__( 'Connected', 'presto-player' )
								)
							}
							onDisconnect={ () =>
								request(
									'mailerlite',
									'/presto-player/v1/mailerlite/disconnect',
									{},
									mailerlite,
									__( 'Disconnected', 'presto-player' )
								)
							}
						>
							<Container.Item className="flex flex-col gap-2">
								<LabelWithTooltip
									label={ __(
										'Your MailerLite API Key',
										'presto-player'
									) }
									tooltip={ __(
										'Generate this from MailerLite under Integrations → Developer API.',
										'presto-player'
									) }
								/>
								<Input
									size="md"
									type="password"
									value={ mailerlite.data?.api_key || '' }
									onChange={ ( val ) =>
										mailerlite.setData( ( p ) => ( {
											...( p || {} ),
											api_key: val,
										} ) )
									}
								/>
							</Container.Item>
						</IntegrationCard>

						<IntegrationCard
							title="ActiveCampaign"
							description={ __(
								'Find your account URL and API key in ActiveCampaign under Settings → Developer.',
								'presto-player'
							) }
							connected={ !! activecampaign.data?.connected }
							isBusy={ !! busy.activecampaign }
							isConnectDisabled={
								! activecampaign.data?.api_key?.trim() ||
								! isValidHttpUrl( activecampaign.data?.url )
							}
							error={ errors.activecampaign }
							onConnect={ () =>
								request(
									'activecampaign',
									'/presto-player/v1/activecampaign/connect',
									{
										api_key: activecampaign.data?.api_key,
										url: activecampaign.data?.url,
									},
									activecampaign,
									__( 'Connected', 'presto-player' )
								)
							}
							onDisconnect={ () =>
								request(
									'activecampaign',
									'/presto-player/v1/activecampaign/disconnect',
									{},
									activecampaign,
									__( 'Disconnected', 'presto-player' )
								)
							}
						>
							<Container direction="column" className="gap-4">
								<Container.Item className="flex flex-col gap-2">
									<LabelWithTooltip
										label={ __(
											'Account URL',
											'presto-player'
										) }
										tooltip={ __(
											'Your ActiveCampaign API URL, e.g. https://youraccountname.api-us1.com',
											'presto-player'
										) }
									/>
									<Input
										size="md"
										type="url"
										value={ activecampaign.data?.url || '' }
										placeholder="https://youraccountname.api-us1.com"
										onChange={ ( val ) =>
											activecampaign.setData( ( p ) => ( {
												...( p || {} ),
												url: val,
											} ) )
										}
									/>
								</Container.Item>
								<Container.Item className="flex flex-col gap-2">
									<LabelWithTooltip
										label={ __(
											'Your ActiveCampaign API Key',
											'presto-player'
										) }
										tooltip={ __(
											'Found in ActiveCampaign under Settings → Developer.',
											'presto-player'
										) }
									/>
									<Input
										size="md"
										type="password"
										value={ activecampaign.data?.api_key || '' }
										onChange={ ( val ) =>
											activecampaign.setData( ( p ) => ( {
												...( p || {} ),
												api_key: val,
											} ) )
										}
									/>
								</Container.Item>
							</Container>
						</IntegrationCard>

						<IntegrationCard
							title="FluentCRM"
							description={ __(
								'Install and activate the free FluentCRM plugin to capture emails directly into your self-hosted CRM.',
								'presto-player'
							) }
							connected={ !! fluentcrm.data?.connected }
							isBusy={ !! busy.fluentcrm }
							error={ errors.fluentcrm }
							connectButtonText={ __(
								'Install FluentCRM Plugin',
								'presto-player'
							) }
							disconnectButtonText={ __(
								'Deactivate FluentCRM Plugin',
								'presto-player'
							) }
							onConnect={ () =>
								request(
									'fluentcrm',
									'/presto-player/v1/fluentcrm/connect',
									{},
									fluentcrm,
									__( 'Installed and connected', 'presto-player' )
								)
							}
							onDisconnect={ () =>
								request(
									'fluentcrm',
									'/presto-player/v1/fluentcrm/disconnect',
									{},
									fluentcrm,
									__( 'Deactivated', 'presto-player' )
								)
							}
						/>
				</Container>
			</ProGate>

			{ isPremium && <CsvExportSection /> }
		</SettingsPageShell>
	);
};

export default EmailCapturePage;
