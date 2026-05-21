import { useEffect, useRef, useState, useCallback } from 'react';
import { Sidebar, Menu } from '@bsf/force-ui';
import { useLocation, useHistory } from '../router/router';
import SettingsDataProvider, {
	useSettingsData,
} from './settings/shared/SettingsDataProvider';
import UnsavedChangesDialog from './settings/shared/UnsavedChangesDialog';
import { registerNavGuard } from './settings/shared/navigationGuard';
import SettingsSkeleton from '../components/Skeletons/SettingsSkeleton';
import {
	SETTINGS_PAGES,
	GROUPS,
	DEFAULT_SLUG,
	findPage,
} from './settings/config';

// Registers core-data entities (preset, audio-preset, webhook) for
// `@wordpress/core-data` selectors used by Settings pages.
import './settings/entities';

const isProPluginActive = window.prestoPlayer?.isProPluginActive ?? false;

const isPageAvailable = ( page ) => {
	if ( ! page ) {
		return false;
	}
	if ( page.requiresProPlugin && ! isProPluginActive ) {
		return false;
	}
	return true;
};

const SettingsInner = () => {
	const location = useLocation();
	const history = useHistory();
	const { isLoading } = useSettingsData();
	const slug = location.params?.section;

	const activePage = findPage( slug );
	const activePageAvailable = isPageAvailable( activePage );

	useEffect( () => {
		// replace() not push() — bad/deep-linked slugs shouldn't clutter
		// back-button history with redirects the user can step through.
		if ( ! slug || ! activePage ) {
			history.replace( { tab: 'Settings', section: DEFAULT_SLUG } );
			return;
		}
		if ( ! activePageAvailable ) {
			history.replace( { tab: 'Settings', section: DEFAULT_SLUG } );
		}
	}, [ slug, activePage, activePageAvailable, history ] );

	// Ref (not context) bridges the active page's dirty state to navigation
	// handlers. A context would force the sidebar to re-render on every
	// keystroke; navigation only needs to *read* isDirty at click time.
	const activePageRef = useRef( { isDirty: false, save: null, discard: null } );
	const [ pendingTarget, setPendingTarget ] = useState( null );
	const [ modalOpen, setModalOpen ] = useState( false );

	const registerActivePage = useCallback( ( next ) => {
		activePageRef.current = next || {
			isDirty: false,
			save: null,
			discard: null,
		};
	}, [] );

	const tryNavigate = useCallback(
		( target ) => {
			const { isDirty } = activePageRef.current;
			if ( ! isDirty ) {
				history.push( target );
				return false;
			}
			setPendingTarget( target );
			setModalOpen( true );
			return true;
		},
		[ history ]
	);

	useEffect( () => {
		return registerNavGuard( ( target ) => tryNavigate( target ) );
	}, [ tryNavigate ] );

	// Replace sidebar + main area with a full-page skeleton while the initial
	// /wp/v2/settings fetch is in flight. Matches SureDash's layout-level
	// pattern — leaf pages never mount in the loading state, so no per-page
	// skeleton logic or flash-of-empty-sidebar. The target page's
	// `skeletonCards` (falls back to 1) drives how many cards we stub so the
	// skeleton matches the specific page the router is resolving to.
	if ( isLoading ) {
		return <SettingsSkeleton cards={ activePage?.skeletonCards ?? 1 } />;
	}

	const closeModal = () => {
		setModalOpen( false );
		setPendingTarget( null );
	};

	const handleModalSave = async () => {
		const target = pendingTarget;
		try {
			await activePageRef.current.save?.();
			closeModal();
			if ( target ) {
				history.push( target );
			}
		} catch ( err ) {
			// Save failed — toast already surfaced inside the page; keep modal open.
		}
	};

	const handleModalDiscard = () => {
		const target = pendingTarget;
		activePageRef.current.discard?.();
		closeModal();
		if ( target ) {
			history.push( target );
		}
	};

	const visiblePages = SETTINGS_PAGES.filter( isPageAvailable );
	const groupedPages = GROUPS.map( ( group ) => ( {
		...group,
		items: visiblePages.filter( ( p ) => p.group === group.key ),
	} ) ).filter( ( g ) => g.items.length > 0 );
	const standalonePages = visiblePages.filter( ( p ) => p.group === null );

	const renderLeaf = ( page ) => {
		const Icon = page.icon;
		return (
			<Menu.Item
				key={ page.slug }
				active={ slug === page.slug }
				onClick={ () => tryNavigate( { tab: 'Settings', section: page.slug } ) }
			>
				<Icon />
				<div className="flex-1">{ page.label }</div>
			</Menu.Item>
		);
	};

	const ActiveComponent = activePageAvailable ? activePage.component : null;

	return (
		<div className="flex min-h-[calc(100vh-var(--presto-admin-bar-h)-var(--presto-navbar-h))]">
			<Sidebar
				borderOn={ false }
				collapsible={ false }
				collapsed={ false }
				className="!w-[240px] !min-w-[240px] shrink-0 !p-3 !h-auto sticky top-[calc(var(--presto-admin-bar-h)+var(--presto-navbar-h))] max-h-[calc(100vh-var(--presto-admin-bar-h)-var(--presto-navbar-h))] overflow-y-auto"
			>
				<Sidebar.Body className="grow">
					<Menu size="md" className="p-0 w-full gap-2">
						{ groupedPages.map( ( group ) => (
							<Menu.List key={ group.key } heading={ group.label } arrow open>
								{ group.items.map( renderLeaf ) }
							</Menu.List>
						) ) }

						{ groupedPages.length > 0 && standalonePages.length > 0 && (
							<Menu.Separator />
						) }

						{ standalonePages.length > 0 && (
							<Menu.List open>{ standalonePages.map( renderLeaf ) }</Menu.List>
						) }
					</Menu>
				</Sidebar.Body>
			</Sidebar>

			<div className="flex-1 min-w-0 bg-background-secondary p-6">
				{ ActiveComponent && (
					<ActiveComponent
						key={ activePage.slug }
						registerActivePage={ registerActivePage }
					/>
				) }
			</div>

			<UnsavedChangesDialog
				open={ modalOpen }
				onSave={ handleModalSave }
				onDiscard={ handleModalDiscard }
				onCancel={ closeModal }
			/>
		</div>
	);
};

const Settings = () => (
	<SettingsDataProvider>
		<SettingsInner />
	</SettingsDataProvider>
);

export default Settings;
