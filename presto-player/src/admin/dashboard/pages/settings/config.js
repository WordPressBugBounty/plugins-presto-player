/**
 * Single source of truth for the Settings area. Every consumer — sidebar,
 * router, redirect rules, option-key callers — derives from the exports here.
 *
 * Adding a new leaf = one entry in SETTINGS_PAGES + (if new option) one entry
 * in OPTION_KEYS. The sidebar, routing, and Save wiring follow automatically.
 */
import { __ } from '@wordpress/i18n';
import {
	Palette,
	FolderOpen,
	BarChart3,
	SlidersHorizontal,
	Code2,
	Trash2,
	HeartHandshake,
	LineChart,
	Youtube,
	Mail,
	Cloud,
	Webhook,
	Gauge,
	KeyRound,
} from 'lucide-react';

import BrandingPage from './general/BrandingPage';
import MediaHubPage from './general/MediaHubPage';
import ViewingAnalyticsPage from './general/ViewingAnalyticsPage';
import PresetsPage from './general/PresetsPage';
import CustomCssPage from './general/CustomCssPage';
import UninstallPage from './general/UninstallPage';
import ContributePage from './general/ContributePage';

import GoogleAnalyticsPage from './integrations/GoogleAnalyticsPage';
import YouTubePage from './integrations/YouTubePage';
import EmailCapturePage from './integrations/EmailCapturePage';
import BunnyNetPage from './integrations/BunnyNetPage';
import WebhooksPage from './integrations/WebhooksPage';

import PerformancePage from './PerformancePage';
import LicensePage from './general/LicensePage';

export const SETTINGS_PAGES = [
	{
		slug: 'branding',
		label: __( 'Branding', 'presto-player' ),
		icon: Palette,
		group: 'general',
		component: BrandingPage,
		pro: false,
	},
	{
		slug: 'media-hub',
		label: __( 'Media Hub', 'presto-player' ),
		icon: FolderOpen,
		group: 'general',
		component: MediaHubPage,
		pro: false,
	},
	{
		slug: 'viewing-analytics',
		label: __( 'Video Analytics', 'presto-player' ),
		icon: BarChart3,
		group: 'general',
		component: ViewingAnalyticsPage,
		pro: true,
	},
	{
		slug: 'presets',
		label: __( 'Presets', 'presto-player' ),
		icon: SlidersHorizontal,
		group: 'general',
		component: PresetsPage,
		pro: true,
	},
	{
		slug: 'custom-css',
		label: __( 'Custom CSS', 'presto-player' ),
		icon: Code2,
		group: 'general',
		component: CustomCssPage,
		pro: true,
	},
	{
		slug: 'uninstall',
		label: __( 'Uninstall Options', 'presto-player' ),
		icon: Trash2,
		group: 'general',
		component: UninstallPage,
		pro: false,
	},
	{
		slug: 'contribute',
		label: __( 'Contribute', 'presto-player' ),
		icon: HeartHandshake,
		group: 'general',
		component: ContributePage,
		pro: false,
	},
	{
		slug: 'license',
		label: __( 'License', 'presto-player' ),
		icon: KeyRound,
		group: 'general',
		component: LicensePage,
		pro: true,
		requiresProPlugin: true,
	},

	{
		slug: 'google-analytics',
		label: __( 'Google Analytics', 'presto-player' ),
		icon: LineChart,
		group: 'integrations',
		component: GoogleAnalyticsPage,
		pro: true,
	},
	{
		slug: 'youtube',
		label: __( 'YouTube', 'presto-player' ),
		icon: Youtube,
		group: 'integrations',
		component: YouTubePage,
		pro: false,
	},
	{
		slug: 'email-capture',
		label: __( 'Email Capture', 'presto-player' ),
		icon: Mail,
		group: 'integrations',
		component: EmailCapturePage,
		pro: true,
		skeletonCards: 2,
	},
	{
		slug: 'bunny-net',
		label: __( 'Bunny.net', 'presto-player' ),
		icon: Cloud,
		group: 'integrations',
		component: BunnyNetPage,
		pro: true,
	},
	{
		slug: 'webhooks',
		label: __( 'Webhooks', 'presto-player' ),
		icon: Webhook,
		group: 'integrations',
		component: WebhooksPage,
		pro: true,
		requiresProPlugin: true,
	},

	{
		slug: 'performance',
		label: __( 'Performance', 'presto-player' ),
		icon: Gauge,
		group: 'performance',
		component: PerformancePage,
		pro: false,
	},
];

export const GROUPS = [
	{ key: 'general', label: __( 'General', 'presto-player' ) },
	{ key: 'integrations', label: __( 'Integrations', 'presto-player' ) },
	{ key: 'performance', label: __( 'Performance', 'presto-player' ) },
];

export const DEFAULT_SLUG = 'branding';

export const OPTION_KEYS = {
	branding: 'presto_player_branding',
	mediaHubWidth: 'presto_player_instant_video_width',
	mediaHubSync: 'presto_player_media_hub_sync_default',
	analytics: 'presto_player_analytics',
	presets: 'presto_player_presets',
	audioPresets: 'presto_player_audio_presets',
	uninstall: 'presto_player_uninstall',
	usageOptin: 'presto-player_usage_optin',
	googleAnalytics: 'presto_player_google_analytics',
	youtube: 'presto_player_youtube',
	mailchimp: 'presto_player_mailchimp',
	mailerlite: 'presto_player_mailerlite',
	activecampaign: 'presto_player_activecampaign',
	fluentcrm: 'presto_player_fluentcrm',
	bunnyStream: 'presto_player_bunny_stream',
	bunnyStreamPublic: 'presto_player_bunny_stream_public',
	bunnyStreamPrivate: 'presto_player_bunny_stream_private',
	bunnyPullZones: 'presto_player_bunny_pull_zones',
	performance: 'presto_player_performance',
};

export const BUNNY_STREAM_KEYS = [
	OPTION_KEYS.bunnyStream,
	OPTION_KEYS.bunnyStreamPublic,
	OPTION_KEYS.bunnyStreamPrivate,
	OPTION_KEYS.bunnyPullZones,
];

export const WEBHOOK_ENTITY = [ 'presto-player', 'webhook' ];

export const findPage = ( slug ) =>
	SETTINGS_PAGES.find( ( page ) => page.slug === slug ) || null;
