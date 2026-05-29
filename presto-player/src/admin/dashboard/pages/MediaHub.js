import React, { useState, useRef, useMemo, useEffect } from 'react';
const { __, _n, sprintf } = wp.i18n;
import {
	Container,
	Table,
	DropdownMenu,
	Pagination,
	Tooltip,
	toast,
} from '@bsf/force-ui';
import apiFetch from '@wordpress/api-fetch';
import {
	ChevronsUpDown,
	FolderArchive,
	Files,
	Trash,
	ArchiveRestore,
	Trash2,
	CheckCheck,
	Plus,
	Info,
	AlertTriangle,
	RefreshCw,
} from 'lucide-react';
import useMediaList from '../hooks/useMediaList.ts';
import {
	MediaRow,
	BulkActions,
	PostSettings,
	Filters,
	ConfirmPopup,
} from '../components/MediaHub';
import {
	statusOptions as filterStatusOptions,
	getBadge,
	formatPublishDate,
} from '../components/Emails/Utils';
import PageHeader from '../components/PageHeader';
import MediaHubPageSkeleton from '../components/Skeletons/MediaHubPageSkeleton';
import MediaHubRowSkeleton from '../components/Skeletons/MediaHubRowSkeleton';
import NoFound from '../components/NoFound';
import mediaHubEmptyState from '../../../../img/media-hub-empty-state.svg';

const DEFAULT_PER_PAGE = 10;
const ALLOWED_PER_PAGE = [ 10, 25, 50, 75, 100 ];
const EDITED_MEDIA_KEY = 'presto_edited_media_id';
const SEARCH_DEBOUNCE_MS = 300;
// "all" in the status dropdown means "everything except trash" — matches the
// previous client-side filter behaviour and WordPress core's own admin lists.
const ACTIVE_STATUSES = 'publish,draft,pending,private,future';

// Stable empty-tags reference. `selectedMediaForSettings.tags || []` would
// create a fresh array on every parent render when the item has no tags,
// which invalidates PostSettings' reset effect and clobbers the user's
// in-progress edits each time the parent re-renders (e.g. after save).
const EMPTY_MEDIA_TAGS = [];

// sessionStorage can throw in private browsing, sandboxed iframes, or when
// site data is disabled — fail silently so the dashboard keeps working.
const editedMediaSession = {
	get: () => {
		try {
			return window.sessionStorage.getItem( EDITED_MEDIA_KEY );
		} catch ( err ) {
			return null;
		}
	},
	set: ( value ) => {
		try {
			window.sessionStorage.setItem( EDITED_MEDIA_KEY, value );
		} catch ( err ) {
			// ignore
		}
	},
	remove: () => {
		try {
			window.sessionStorage.removeItem( EDITED_MEDIA_KEY );
		} catch ( err ) {
			// ignore
		}
	},
};

const MediaHub = () => {
	// Filter / sort / pagination state owned by the page. The hook reads these
	// and fires one request per change; we keep the *input* of the search box
	// separate from the *committed* search term so typing doesn't fire a
	// request on every keystroke.
	const [ searchInput, setSearchInput ] = useState( '' );
	const [ searchTerm, setSearchTerm ] = useState( '' );
	const [ selectedStatus, setSelectedStatus ] = useState( 'all' );
	const [ selectedTag, setSelectedTag ] = useState( '' );
	const [ sortField, setSortField ] = useState( 'date' );
	const [ sortOrder, setSortOrder ] = useState( 'desc' );
	const [ currentPage, setCurrentPage ] = useState( 1 );
	const [ postCount, setPostCount ] = useState( DEFAULT_PER_PAGE );

	// Local UI state.
	const [ selected, setSelected ] = useState( [] );
	const [ showSettingsPopup, setShowSettingsPopup ] = useState( false );
	const [ selectedMediaForSettings, setSelectedMediaForSettings ] =
		useState( null );
	const searchInputRef = useRef( null );
	const [ showFilter, setShowFilter ] = useState( false );
	const [ openActionPopup, setOpenActionPopup ] = useState( false );

	// Debounce the search input → committed search term. Triggers one request
	// ~300ms after the user stops typing instead of one per keystroke. The
	// committed change also resets the active page in one batched update so
	// useMediaList sees `{ search: 'foo', page: 1 }` in a SINGLE render —
	// without this, a separate page-reset effect produces TWO fetches per
	// filter change.
	useEffect( () => {
		if ( searchInput === searchTerm ) {
			return undefined;
		}
		const t = setTimeout( () => {
			setSearchTerm( searchInput );
			setCurrentPage( 1 );
			setSelected( [] );
		}, SEARCH_DEBOUNCE_MS );
		return () => clearTimeout( t );
	}, [ searchInput, searchTerm ] );

	// Translate the UI status filter ("all" | "trash" | status slug) into the
	// comma-separated `status` param the server expects.
	const serverStatus =
		selectedStatus === 'all' ? ACTIVE_STATUSES : selectedStatus;

	const {
		items,
		totalItems,
		totalPages,
		counts,
		allTags,
		loading,
		error,
		hasLoadedOnce,
		refetch,
	} = useMediaList( {
		search: searchTerm,
		status: serverStatus,
		tag: selectedTag ? parseInt( selectedTag, 10 ) : 0,
		orderby: sortField === 'title' ? 'title' : 'date',
		order: sortOrder,
		page: currentPage,
		perPage: postCount,
	} );

	// "Library is empty" is independent of the current filter — derived from
	// server-side counts so an active search returning zero results does NOT
	// show the empty-state CTA.
	const isLibraryEmpty = useMemo(
		() =>
			( counts.publish || 0 ) +
				( counts.draft || 0 ) +
				( counts.pending || 0 ) +
				( counts.private || 0 ) +
				( counts.future || 0 ) +
				( counts.trash || 0 ) ===
			0,
		[ counts ]
	);

	const handleCheckboxChange = ( checked, value ) => {
		if ( checked ) {
			setSelected( [ ...selected, value.id ] );
		} else {
			setSelected( selected.filter( ( item ) => item !== value.id ) );
		}
	};

	// Select-all selects the current visible page (matches WP's own list
	// tables; selecting items off-page would be surprising).
	const toggleSelectAll = ( checked ) => {
		if ( checked ) {
			setSelected( items.map( ( item ) => item.id ) );
		} else {
			setSelected( [] );
		}
	};

	// Centralised "filter changed → reset paging + selection" so every
	// filter-mutating handler stays in sync without a separate useEffect (the
	// effect-based approach lets useMediaList fire ONE request with the stale
	// page before the reset commits, doubling backend load per change).
	const resetForFilterChange = () => {
		setCurrentPage( 1 );
		setSelected( [] );
	};

	const handleSort = ( field ) => {
		if ( sortField === field ) {
			setSortOrder( ( prev ) => ( prev === 'asc' ? 'desc' : 'asc' ) );
		} else {
			setSortField( field );
			// Date defaults to newest-first; alphabetical defaults to A-Z.
			setSortOrder( field === 'date' ? 'desc' : 'asc' );
		}
		resetForFilterChange();
	};

	const handleStatusChange = ( value ) => {
		setSelectedStatus( value );
		resetForFilterChange();
	};

	const handleTagChange = ( value ) => {
		setSelectedTag( value );
		resetForFilterChange();
	};

	const handlePostCountChange = ( value ) => {
		setPostCount( value );
		resetForFilterChange();
	};

	const onEditClick = ( e, mediaId ) => {
		if ( e.metaKey || e.ctrlKey ) {
			return;
		}
		e.preventDefault();

		editedMediaSession.set( mediaId );
		const editUrl = `post.php?post=${ mediaId }&action=edit`;
		window.open( editUrl, '_self' );
	};

	const handleOpenSettings = ( event, mediaData ) => {
		event.preventDefault();
		event.stopPropagation();
		setSelectedMediaForSettings( mediaData );
		setShowSettingsPopup( true );
	};

	const handleSettingsSuccess = () => {
		refetch();
	};

	const actionMenus = [
		{
			label: __( 'Duplicate', 'presto-player' ),
			value: 'duplicate',
			icon: <Files width="15" height="15" />,
		},
		{
			label: __( 'Save as Draft', 'presto-player' ),
			value: 'draft',
			icon: <FolderArchive width="15" height="15" />,
		},
		{
			label: __( 'Mark as Publish', 'presto-player' ),
			value: 'publish',
			icon: <CheckCheck width="15" height="15" />,
		},
		{
			label: __( 'Move to Trash', 'presto-player' ),
			value: 'trash',
			icon: <Trash width="15" height="15" />,
		},
		{
			label: __( 'Delete Permanently', 'presto-player' ),
			value: 'delete',
			icon: <Trash2 width="15" height="15" />,
		},
		{
			label: __( 'Restore', 'presto-player' ),
			value: 'restore',
			icon: <ArchiveRestore width="15" height="15" />,
		},
	];

	const defaultPopupState = {
		title: __( 'Are you sure?', 'presto-player' ),
		description: __( 'Are you sure you want to proceed?', 'presto-player' ),
		confirmText: __( 'Confirm', 'presto-player' ),
		cancelText: __( 'Cancel', 'presto-player' ),
		confirmCallback: () => {},
		cancelCallback: () => {},
	};
	const [ actionPopupData, setActionPopupData ] = useState( defaultPopupState );

	// Drop a single id from the bulk selection set. Used by the per-row
	// action handlers so a row the user just acted on can't be silently
	// re-targeted by the next bulk operation (it might have been deleted, or
	// moved to a status no longer in the current filter).
	const dropFromSelection = ( mediaId ) => {
		setSelected( ( prev ) => prev.filter( ( id ) => id !== mediaId ) );
	};

	// Single-row status change wrapped so every action goes through the same
	// request → refetch → toast flow.
	const updateStatus = ( mediaId, newStatus, successText, errorText ) =>
		apiFetch( {
			path: `/wp/v2/presto-videos/${ mediaId }`,
			method: 'POST',
			data: { status: newStatus },
		} )
			.then( () => {
				setOpenActionPopup( false );
				dropFromSelection( mediaId );
				refetch();
				toast.success( successText );
			} )
			.catch( ( err ) => {
				console.error( 'Error updating media status:', err );
				toast.error( errorText );
			} );

	const deleteOne = ( mediaId, force, successText, errorText ) =>
		apiFetch( {
			path: `/wp/v2/presto-videos/${ mediaId }${ force ? '?force=true' : '' }`,
			method: 'DELETE',
		} )
			.then( () => {
				setOpenActionPopup( false );
				dropFromSelection( mediaId );
				refetch();
				toast.success( successText );
			} )
			.catch( ( err ) => {
				console.error( 'Error deleting media:', err );
				toast.error( errorText );
			} );

	const duplicateOne = ( mediaId ) => {
		const formData = new window.FormData();
		formData.append( 'media_id', mediaId );

		apiFetch( {
			path: '/presto-player/v1/duplicate-media',
			method: 'POST',
			body: formData,
		} )
			.then( ( response ) => {
				if ( response.success ) {
					setOpenActionPopup( false );
					dropFromSelection( mediaId );
					refetch();
					toast.success( response?.data?.message );
				}
			} )
			.catch( ( err ) => {
				console.error( 'Error:', err );
			} );
	};

	const handleMenuActions = ( mediaId, mediaAction ) => {
		const actionWisePopupData = {
			duplicate: {
				title: __( 'Duplicate?', 'presto-player' ),
				description: __(
					'Are you sure you want to duplicate this media?',
					'presto-player'
				),
				confirmText: __( 'Duplicate', 'presto-player' ),
				confirmCallback: () => duplicateOne( mediaId ),
				cancelCallback: () => setOpenActionPopup( false ),
			},
			draft: {
				title: __( 'Save as Draft?', 'presto-player' ),
				description: __(
					'Are you sure you want to mark this media as a draft?',
					'presto-player'
				),
				confirmText: __( 'Save as Draft', 'presto-player' ),
				confirmCallback: () =>
					updateStatus(
						mediaId,
						'draft',
						__( 'Successfully drafted.', 'presto-player' ),
						__( 'Failed to draft.', 'presto-player' )
					),
				cancelCallback: () => setOpenActionPopup( false ),
			},
			publish: {
				title: __( 'Publish?', 'presto-player' ),
				description: __(
					'Are you sure you want to publish this media?',
					'presto-player'
				),
				confirmText: __( 'Publish', 'presto-player' ),
				confirmCallback: () =>
					updateStatus(
						mediaId,
						'publish',
						__( 'Successfully published.', 'presto-player' ),
						__( 'Failed to publish.', 'presto-player' )
					),
				cancelCallback: () => setOpenActionPopup( false ),
			},
			trash: {
				title: __( 'Move to Trash?', 'presto-player' ),
				description: __(
					'Are you sure you want to move this media to the trash?',
					'presto-player'
				),
				confirmText: __( 'Move to Trash', 'presto-player' ),
				destructive: true,
				// Native DELETE without ?force=true = wp_trash_post.
				confirmCallback: () =>
					deleteOne(
						mediaId,
						false,
						__( 'Successfully trashed.', 'presto-player' ),
						__( 'Failed to trash.', 'presto-player' )
					),
				cancelCallback: () => setOpenActionPopup( false ),
			},
			delete: {
				title: __( 'Delete?', 'presto-player' ),
				description: __(
					'This will permanently delete this media. It cannot be recovered. To remove it temporarily instead, use Trash.',
					'presto-player'
				),
				confirmText: __( 'Delete', 'presto-player' ),
				destructive: true,
				// Native DELETE with ?force=true = wp_delete_post (permanent).
				confirmCallback: () =>
					deleteOne(
						mediaId,
						true,
						__( 'Media deleted successfully.', 'presto-player' ),
						__( 'Failed to delete media.', 'presto-player' )
					),
				cancelCallback: () => setOpenActionPopup( false ),
			},
			restore: {
				title: __( 'Restore?', 'presto-player' ),
				description: __(
					'Are you sure you want to restore this media?',
					'presto-player'
				),
				confirmText: __( 'Restore', 'presto-player' ),
				// Restore = set status to draft via native PUT.
				confirmCallback: () =>
					updateStatus(
						mediaId,
						'draft',
						__( 'Successfully restored.', 'presto-player' ),
						__( 'Failed to restore.', 'presto-player' )
					),
				cancelCallback: () => setOpenActionPopup( false ),
			},
		};

		setActionPopupData( actionWisePopupData[ mediaAction ] );
		setOpenActionPopup( true );
	};

	const renderActionMenu = ( mediaItem ) => {
		let actions = actionMenus.filter(
			( item ) => item.value !== mediaItem?.status
		);

		if ( mediaItem?.status === 'trash' ) {
			actions = actionMenus.filter(
				( item ) => item.value === 'restore' || item.value === 'delete'
			);
		} else {
			actions = actions.filter(
				( item ) => item.value !== 'restore' && item.value !== 'delete'
			);
		}

		return actions.map( ( action ) => (
			<DropdownMenu.Item
				key={ action.value }
				onClick={ () => handleMenuActions( mediaItem.id, action.value ) }
				className="text-sm"
			>
				<div className="flex items-center gap-2">
					{ action.icon }
					{ action.label }
				</div>
			</DropdownMenu.Item>
		) );
	};

	// Bulk operations all share the same shape: fan out per-id requests,
	// collect successes/failures, refetch once, surface a single toast.
	// `successCopy(n)` / `errorCopy(n)` return the FULL formatted message so
	// each caller can use as many placeholders as it needs.
	const runBulk = ( selectedIds, path, method, successCopy, errorCopy ) => {
		if ( ! selectedIds || selectedIds.length === 0 ) {
			return Promise.resolve();
		}

		const promises = selectedIds.map( ( mediaId ) =>
			apiFetch( {
				path: path( mediaId ),
				method: method.verb,
				data: method.data,
			} )
				.then( () => ( { success: true, mediaId } ) )
				.catch( ( err ) => {
					console.error( `Bulk ${ method.verb } ${ mediaId }:`, err );
					return { success: false, mediaId };
				} )
		);

		return Promise.all( promises ).then( ( results ) => {
			const successCount = results.filter( ( r ) => r.success ).length;
			const failedCount = results.length - successCount;

			setSelected( [] );
			if ( successCount > 0 ) {
				refetch();
			}

			if ( successCount > 0 ) {
				toast.success( successCopy( successCount ) );
			}
			if ( failedCount > 0 ) {
				toast.error( errorCopy( failedCount ) );
			}
		} );
	};

	const handleBulkDelete = ( selectedIds ) =>
		runBulk(
			selectedIds,
			( id ) => `/wp/v2/presto-videos/${ id }?force=true`,
			{ verb: 'DELETE' },
			( n ) =>
				sprintf(
					/* translators: %d: number of media items deleted */
					_n(
						'%d media item deleted successfully.',
						'%d media items deleted successfully.',
						n,
						'presto-player'
					),
					n
				),
			( n ) =>
				sprintf(
					/* translators: %d: number of media items that failed to delete */
					_n(
						'Failed to delete %d media item.',
						'Failed to delete %d media items.',
						n,
						'presto-player'
					),
					n
				)
		);

	const handleBulkTrash = ( selectedIds ) =>
		runBulk(
			selectedIds,
			( id ) => `/wp/v2/presto-videos/${ id }`,
			{ verb: 'DELETE' },
			( n ) =>
				sprintf(
					/* translators: %d: number of media items moved to trash */
					_n(
						'%d media item moved to trash.',
						'%d media items moved to trash.',
						n,
						'presto-player'
					),
					n
				),
			( n ) =>
				sprintf(
					/* translators: %d: number of media items that failed to move to trash */
					_n(
						'Failed to trash %d media item.',
						'Failed to trash %d media items.',
						n,
						'presto-player'
					),
					n
				)
		);

	const handleBulkStatusChange = ( selectedIds, status ) =>
		runBulk(
			selectedIds,
			( id ) => `/wp/v2/presto-videos/${ id }`,
			{ verb: 'POST', data: { status } },
			( n ) =>
				sprintf(
					/* translators: 1: number of items updated, 2: new status (e.g. "publish") */
					_n(
						'%1$d item updated to %2$s.',
						'%1$d items updated to %2$s.',
						n,
						'presto-player'
					),
					n,
					status
				),
			( n ) =>
				sprintf(
					/* translators: %d: number of items that failed to update */
					_n(
						'Failed to update %d item.',
						'Failed to update %d items.',
						n,
						'presto-player'
					),
					n
				)
		);

	const handleBulkCancel = () => {
		setSelected( [] );
	};

	const handleSearchResult = ( value ) => {
		setSearchInput( value );
	};

	const onAddNewClick = ( e ) => {
		e.preventDefault();
		e.stopPropagation();
		const newPostUrl = `post-new.php?post_type=pp_video_block`;
		window.open( newPostUrl, '_self' );
	};

	const tagOptions = useMemo(
		() => [ { id: '', name: __( 'All Tags', 'presto-player' ) }, ...allTags ],
		[ allTags ]
	);

	const handleClearFilters = () => {
		setSelectedStatus( 'all' );
		setSelectedTag( '' );
		setPostCount( DEFAULT_PER_PAGE );
		resetForFilterChange();
	};

	// Guard against an invalid per-page value from a stale stored preference.
	useEffect( () => {
		if ( ! ALLOWED_PER_PAGE.includes( postCount ) ) {
			setPostCount( DEFAULT_PER_PAGE );
		}
	}, [ postCount ] );

	// Clear selection on page navigation. Without this, ids checked on page N
	// stay in the bulk-selection set after the user moves to page N+1 — and
	// the next bulk action targets rows the user can no longer see.
	useEffect( () => {
		setSelected( [] );
	}, [ currentPage ] );

	// Clamp currentPage when the server reports fewer pages than we're on
	// (bulk delete on the last page, filter narrows results, etc.). Without
	// this the user lands on an orphan page with no rows and no pagination
	// footer to navigate back.
	useEffect( () => {
		if ( totalPages > 0 && currentPage > totalPages ) {
			setCurrentPage( totalPages );
		}
	}, [ totalPages, currentPage ] );

	// Surface refetch errors (initial-load errors are handled by a dedicated
	// retry screen below). Toast once per error transition; the hook clears
	// `error` at the start of each new fetch so repeated identical failures
	// re-toast.
	useEffect( () => {
		if ( error && hasLoadedOnce ) {
			toast.error( error );
		}
	}, [ error, hasLoadedOnce ] );

	// Scroll-to-edited-item after returning from the post editor. With server
	// pagination the edited row may not be on the current page; if it's not in
	// the visible items we simply drop the marker silently — the user lands on
	// the default sorted view (newest first) where the just-edited item will
	// usually be at the top anyway.
	useEffect( () => {
		const editedId = editedMediaSession.get();
		if ( ! editedId || ! items.length ) {
			return;
		}

		const found = items.some( ( item ) => String( item.id ) === editedId );
		if ( ! found ) {
			editedMediaSession.remove();
			return;
		}

		const timer = setTimeout( () => {
			const el = document.querySelector( `[data-id="${ editedId }"]` );
			if ( el ) {
				el.scrollIntoView( { behavior: 'smooth', block: 'center' } );
				el.classList.add(
					'bg-brand-background-hover-100',
					'transition-all',
					'duration-300'
				);
				setTimeout( () => {
					el.classList.remove( 'bg-brand-background-hover-100' );
					setTimeout(
						() => el.classList.remove( 'transition-all', 'duration-300' ),
						300
					);
				}, 1300 );
			}
			editedMediaSession.remove();
		}, 200 );

		return () => clearTimeout( timer );
	}, [ items ] );

	const renderPagination = () => {
		if ( totalPages <= 1 ) {
			return null;
		}

		const pages = [];

		const renderPageItem = ( i ) => (
			<Pagination.Item
				key={ i }
				isActive={ i === currentPage }
				onClick={ () => setCurrentPage( i ) }
			>
				{ i }
			</Pagination.Item>
		);

		const showEllipsis = ( key ) => <Pagination.Ellipsis key={ key } />;

		// Always show first page.
		pages.push( renderPageItem( 1 ) );

		if ( currentPage > 3 ) {
			pages.push( showEllipsis( 'left-ellipsis' ) );
		}

		for (
			let i = Math.max( 2, currentPage - 1 );
			i <= Math.min( totalPages - 1, currentPage + 1 );
			i++
		) {
			pages.push( renderPageItem( i ) );
		}

		if ( currentPage < totalPages - 2 ) {
			pages.push( showEllipsis( 'right-ellipsis' ) );
		}

		if ( totalPages > 1 ) {
			pages.push( renderPageItem( totalPages ) );
		}

		return (
			<>
				<Pagination.Previous
					onClick={ () =>
						setCurrentPage( ( prev ) => Math.max( prev - 1, 1 ) )
					}
					disabled={ currentPage === 1 }
				/>
				{ pages }
				<Pagination.Next
					onClick={ () =>
						setCurrentPage( ( prev ) => Math.min( prev + 1, totalPages ) )
					}
					disabled={ currentPage === totalPages }
				/>
			</>
		);
	};

	const containerClassName = 'p-8';

	const startIndex = totalItems === 0 ? 0 : ( currentPage - 1 ) * postCount + 1;
	const endIndex = Math.min( currentPage * postCount, totalItems );

	// Skeleton blocks the initial paint (until the first response settles).
	// Subsequent refetches keep the existing rows visible so the table doesn't
	// flash to a skeleton on every mutation. Driven by hasLoadedOnce from the
	// hook — counts-based "isLibraryEmpty" can't be used here because the
	// hook's initial counts are all zero before the first response.
	if ( ! hasLoadedOnce && loading ) {
		return <MediaHubPageSkeleton />;
	}

	// First-load failure: dedicated retry screen instead of silently rendering
	// the new-install empty-state CTA. Subsequent refetch errors are surfaced
	// via toast (see the effect above) so the table stays usable.
	if ( ! loading && error && ( ! hasLoadedOnce || items.length === 0 ) ) {
		return (
			<Container
				className={ `${ containerClassName } flex-1 items-center justify-start pt-16` }
				direction="column"
			>
				<NoFound
					icon={ <AlertTriangle width={ 56 } height={ 56 } /> }
					title={ __( 'Couldn’t load your media.', 'presto-player' ) }
					description={ error }
					buttonText={ __( 'Try again', 'presto-player' ) }
					buttonIcon={ <RefreshCw aria-label="icon" role="img" /> }
					onButtonClick={ refetch }
				/>
			</Container>
		);
	}

	if ( ! loading && ! error && isLibraryEmpty ) {
		return (
			<Container
				className={ `${ containerClassName } flex-1 items-center justify-start pt-16` }
				direction="column"
			>
				<NoFound
					icon={
						<img src={ mediaHubEmptyState } width={ 70 } height={ 53 } alt="" />
					}
					title={ __( 'Your media will be displayed here.', 'presto-player' ) }
					description={ __(
						'Click the "Add Media" button to create a new Media Hub item',
						'presto-player'
					) }
					buttonText={ __( 'Add Media', 'presto-player' ) }
					buttonIcon={ <Plus aria-label="icon" role="img" /> }
					onButtonClick={ onAddNewClick }
				/>
			</Container>
		);
	}

	return (
		<>
			{ selectedMediaForSettings && (
				<PostSettings
					open={ showSettingsPopup }
					onClose={ () => {
						setShowSettingsPopup( false );
						setSelectedMediaForSettings( null );
					} }
					onSuccess={ handleSettingsSuccess }
					mediaId={ selectedMediaForSettings.id }
					initialTitle={ selectedMediaForSettings.title || '' }
					initialStatus={ selectedMediaForSettings.status || 'publish' }
					initialSlug={ selectedMediaForSettings.post_name || '' }
					initialDate={ selectedMediaForSettings.date || '' }
					initialPassword={ selectedMediaForSettings.post_password || '' }
					initialTags={ selectedMediaForSettings.tags || EMPTY_MEDIA_TAGS }
					availableTags={ allTags }
				/>
			) }

			<Container className={ containerClassName } gap="md" direction="column">
				<PageHeader
					title={ __( 'Media Hub', 'presto-player' ) }
					showFilter={ showFilter }
					setShowFilter={ setShowFilter }
					showFilterWhen={ ! isLibraryEmpty }
					searchPlaceholder={ __( 'Search media…', 'presto-player' ) }
					searchValue={ searchInput }
					onSearchChange={ ( value ) => handleSearchResult( value ) }
					searchInputRef={ searchInputRef }
					primaryButtonText={ __( 'New Media', 'presto-player' ) }
					onPrimaryClick={ onAddNewClick }
				/>

				<Container gap="lg" direction="column">
					<BulkActions
						selected={ selected }
						onTrash={ ( selectedIds ) => {
							setActionPopupData( {
								title: __( 'Move Selected to Trash?', 'presto-player' ),
								description: sprintf(
									/* translators: %d: number of selected items being moved to trash */
									_n(
										'Are you sure you want to move %d item to the trash?',
										'Are you sure you want to move %d items to the trash?',
										selectedIds.length,
										'presto-player'
									),
									selectedIds.length
								),
								confirmText: __( 'Move to Trash', 'presto-player' ),
								destructive: true,
								confirmCallback: () => handleBulkTrash( selectedIds ),
								cancelCallback: () => setOpenActionPopup( false ),
							} );
							setOpenActionPopup( true );
						} }
						onDelete={ ( selectedIds ) => {
							setActionPopupData( {
								title: __( 'Delete Selected Items?', 'presto-player' ),
								description: sprintf(
									/* translators: %d: number of selected items being permanently deleted */
									_n(
										'This will permanently delete %d item. It cannot be recovered. To remove it temporarily instead, use Trash.',
										'This will permanently delete %d items. They cannot be recovered. To remove them temporarily instead, use Trash.',
										selectedIds.length,
										'presto-player'
									),
									selectedIds.length
								),
								confirmText: __( 'Delete', 'presto-player' ),
								destructive: true,
								confirmCallback: () => handleBulkDelete( selectedIds ),
								cancelCallback: () => setOpenActionPopup( false ),
							} );
							setOpenActionPopup( true );
						} }
						onStatusChange={ handleBulkStatusChange }
						onCancel={ handleBulkCancel }
					/>

					<div className="gap-0">
						{ showFilter && (
							<Filters
								postCount={ postCount }
								setPostCount={ handlePostCountChange }
								perPageLabel={ __( 'Posts', 'presto-player' ) }
								selects={ [
									{
										options: filterStatusOptions,
										value: selectedStatus,
										onChange: handleStatusChange,
									},
									{
										options: tagOptions.map( ( t ) => ( {
											value: t.id,
											label: t.name,
										} ) ),
										value: selectedTag,
										onChange: handleTagChange,
									},
								] }
								onClear={ handleClearFilters }
							/>
						) }

						<Table checkboxSelection={ true }>
							<Table.Head
								selected={
									selected.length > 0 && selected.length === items.length
								}
								onChangeSelection={ toggleSelectAll }
								indeterminate={
									selected.length > 0 && selected.length < items.length
								}
								className="bg-background-primary items-center"
							>
								<Table.HeadCell
									onClick={ () => handleSort( 'title' ) }
									style={ { width: '300px' } }
									className="cursor-pointer items-center gap-2 text-text-secondary"
								>
									{ __( 'Media', 'presto-player' ) }
									<ChevronsUpDown
										width="15"
										height="15"
										className={ `text-icon-secondary align-middle ml-2${
											sortField === 'title' && sortOrder === 'asc'
												? ' rotate-180'
												: ''
										}` }
									/>
								</Table.HeadCell>

								<Table.HeadCell
									style={ { width: '100px' } }
									className="text-text-secondary items-center"
								>
									{ __( 'Status', 'presto-player' ) }
								</Table.HeadCell>

								<Table.HeadCell
									style={ { width: '260px' } }
									className="text-text-secondary"
								>
									<span className="inline-flex items-center gap-1.5">
										{ __( 'Tags', 'presto-player' ) }
										<Tooltip
											content={ __(
												'Tags help organize and filter your media library.',
												'presto-player'
											) }
											arrow
											placement="top"
										>
											<Info className="size-3.5 text-icon-secondary cursor-help shrink-0" />
										</Tooltip>
									</span>
								</Table.HeadCell>

								<Table.HeadCell
									style={ { width: '220px' } }
									className="text-text-secondary"
								>
									<span className="inline-flex items-center gap-1.5">
										{ __( 'Shortcode', 'presto-player' ) }
										<Tooltip
											content={ __(
												'Copy the shortcode to embed this media in any post, page, or widget.',
												'presto-player'
											) }
											arrow
											placement="top"
										>
											<Info className="size-3.5 text-icon-secondary cursor-help shrink-0" />
										</Tooltip>
									</span>
								</Table.HeadCell>

								<Table.HeadCell
									onClick={ () => handleSort( 'date' ) }
									style={ { width: '180px' } }
									className="cursor-pointer items-center gap-2 text-text-secondary"
								>
									{ __( 'Published on', 'presto-player' ) }
									<ChevronsUpDown
										width="15"
										height="15"
										className={ `text-icon-secondary align-middle ml-2${
											sortField === 'date' && sortOrder === 'asc'
												? ' rotate-180'
												: ''
										}` }
									/>
								</Table.HeadCell>

								<Table.HeadCell
									style={ { width: '140px' } }
									className="items-center justify-center"
								>
									<span className="sr-only">Actions</span>
								</Table.HeadCell>
							</Table.Head>

							<Table.Body>
								{ loading ? (
									// Refetch in flight (page change, filter, sort, search).
									// Swap to skeleton rows so the user gets immediate
									// feedback instead of stale rows with no indicator.
									Array.from( { length: postCount } ).map( ( _, idx ) => (
										<MediaHubRowSkeleton key={ `row-skeleton-${ idx }` } />
									) )
								) : items.length > 0 ? (
									items.map( ( item ) => (
										<MediaRow
											key={ item.id }
											// MediaRow reads `post_date` and `poster_image` field
											// names from a long-standing API shape — alias here so
											// the new server-driven payload stays focused on the
											// canonical `date` / `poster` keys.
											item={ {
												...item,
												post_date: item.date,
												poster_image: item.poster,
											} }
											selected={ selected.includes( item.id ) }
											onChangeSelection={ handleCheckboxChange }
											onEditClick={ onEditClick }
											renderActionMenu={ renderActionMenu }
											getBadge={ getBadge }
											formatPublishDate={ formatPublishDate }
											handleOpenSettings={ handleOpenSettings }
										/>
									) )
								) : (
									<tr>
										<td
											colSpan="7"
											className="px-6 py-8 text-center text-sm text-text-secondary"
										>
											{ __( 'No media found.', 'presto-player' ) }
										</td>
									</tr>
								) }
							</Table.Body>

							{ ( loading || items.length > 0 ) && (
								<Table.Footer className="bg-background-primary">
									<div className="flex items-center justify-between w-full">
										<span className="text-sm font-normal leading-5 text-text-secondary">
											{ `${ startIndex }–${ endIndex } ${ __(
												'of',
												'presto-player'
											) } ${ totalItems } ${ __( 'items', 'presto-player' ) }` }
										</span>
										<Pagination className="w-fit">
											<Pagination.Content>
												{ renderPagination() }
											</Pagination.Content>
										</Pagination>
									</div>
								</Table.Footer>
							) }
						</Table>
					</div>
				</Container>
			</Container>

			<ConfirmPopup
				openConfirmPopup={ openActionPopup }
				setOpenConfirmPopup={ setOpenActionPopup }
				title={ actionPopupData?.title || '' }
				description={ actionPopupData?.description || '' }
				confirmText={ actionPopupData?.confirmText || '' }
				cancelText={
					actionPopupData?.cancelText || __( 'Cancel', 'presto-player' )
				}
				confirmCallback={ actionPopupData?.confirmCallback }
				cancelCallback={ actionPopupData?.cancelCallback }
				destructive={ actionPopupData?.destructive || false }
			/>
		</>
	);
};

export default MediaHub;
