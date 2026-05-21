/**
 * Emails dashboard page – list, filter, add/edit email submissions.
 * Matches Presto Player / MediaHub patterns: useEmail hook, shared components, toast, ConfirmPopup.
 *
 * Structure: This page composes components from ../components/Emails (see components/Emails/README.md).
 * Data: useEmail (hooks/useEmail.ts). Popups: EmailFormPopup, ConfirmPopup. Shared: MediaHub/BulkActions.
 */
// eslint-disable-next-line import/no-extraneous-dependencies
import React, { useState, useRef, useMemo, useEffect } from 'react';
const { __, sprintf } = wp.i18n;
import apiFetch from '@wordpress/api-fetch';
import '../../../styles/tailwind.css';
import { Container, DropdownMenu, toast } from '@bsf/force-ui';
import useEmail, { EMAIL_SUBMISSIONS_PATH } from '../hooks/useEmail.ts';
import BulkActions from '../components/MediaHub/BulkActions';
import ConfirmPopup from '../components/Popup/ConfirmPopup';
import EmailFormPopup from '../components/Popup/EmailFormPopup';
import Filters from '../components/Filters';
import PageHeader from '../components/PageHeader';
import {
	Table,
	statusOptions,
} from '../components/Emails';
import MediaHubPageSkeleton from '../components/Skeletons/MediaHubPageSkeleton';
import NoFound from '../components/NoFound';
import emailsEmptyState from '../../../../img/emails-empty-state.svg';
import {
	Plus,
	FolderArchive,
	CheckCheck,
	Trash,
	Trash2,
	ArchiveRestore,
} from 'lucide-react';
import ProGateOverlay from '../components/ProGateOverlay';

const POSTS_PER_PAGE = 10;

const EmailsContent = () => {
	const {
		emails,
		rawEmails,
		setRawEmails,
		loading,
		sortField,
		sortOrder,
		handleSort,
		fetchEmails,
	} = useEmail();
	const [ showFilter, setShowFilter ] = useState( false );
	const [ searchTerm, setSearchTerm ] = useState( '' );
	const searchInputRef = useRef( null );
	const [ selected, setSelected ] = useState( [] );
	const [ currentPage, setCurrentPage ] = useState( 1 );
	const [ postCount, setPostCount ] = useState( POSTS_PER_PAGE );
	const [ openActionPopup, setOpenActionPopup ] = useState( false );
	const [ actionPopupData, setActionPopupData ] = useState( null );
	const [ showEmailPopup, setShowEmailPopup ] = useState( false );
	const [ selectedEmailForEdit, setSelectedEmailForEdit ] = useState( null );
	const [ filterMonth, setFilterMonth ] = useState( '' );
	const [ selectedStatus, setSelectedStatus ] = useState( 'all' );

	const prevFiltersRef = useRef( {
		searchTerm: '',
		postCount: POSTS_PER_PAGE,
		filterMonth: '',
		selectedStatus: 'all',
	} );

	const monthFilterOptions = useMemo( () => {
		const options = [
			{ value: '', label: __( 'All dates', 'presto-player' ) },
		];
		const monthNames = [
			__( 'January', 'presto-player' ),
			__( 'February', 'presto-player' ),
			__( 'March', 'presto-player' ),
			__( 'April', 'presto-player' ),
			__( 'May', 'presto-player' ),
			__( 'June', 'presto-player' ),
			__( 'July', 'presto-player' ),
			__( 'August', 'presto-player' ),
			__( 'September', 'presto-player' ),
			__( 'October', 'presto-player' ),
			__( 'November', 'presto-player' ),
			__( 'December', 'presto-player' ),
		];
		const seen = new Set();
		( rawEmails || [] ).forEach( ( item ) => {
			if ( ! item.date ) {
				return;
			}
			const d = new Date( item.date );
			// Skip invalid dates so month filter only shows valid options; no throw.
			if ( isNaN( d.getTime() ) ) {
				return;
			}
			const key = `${ d.getFullYear() }-${ String( d.getMonth() + 1 ).padStart(
				2,
				'0'
			) }`;
			if ( seen.has( key ) ) {
				return;
			}
			seen.add( key );
			const label = `${ monthNames[ d.getMonth() ] } ${ d.getFullYear() }`;
			options.push( { value: key, label } );
		} );
		options.sort( ( a, b ) => {
			if ( a.value === '' ) {
				return -1;
			}
			if ( b.value === '' ) {
				return 1;
			}
			return b.value.localeCompare( a.value );
		} );
		return options;
	}, [ rawEmails ] );

	useEffect( () => {
		if ( ! [ 10, 25, 50, 75, 100 ].includes( postCount ) ) {
			setPostCount( POSTS_PER_PAGE );
		}
	}, [ postCount ] );

	useEffect( () => {
		const filtersChanged =
			prevFiltersRef.current.searchTerm !== searchTerm ||
			prevFiltersRef.current.postCount !== postCount ||
			prevFiltersRef.current.filterMonth !== filterMonth ||
			prevFiltersRef.current.selectedStatus !== selectedStatus;
		if ( filtersChanged ) {
			setCurrentPage( 1 );
			prevFiltersRef.current = {
				searchTerm,
				postCount,
				filterMonth,
				selectedStatus,
			};
		}
	}, [ searchTerm, postCount, filterMonth, selectedStatus ] );

	const handleClearFilters = () => {
		setFilterMonth( '' );
		setSelectedStatus( 'all' );
		setCurrentPage( 1 );
		setPostCount( POSTS_PER_PAGE );
	};

	const handleBulkDelete = async ( selectedIds ) => {
		if ( ! selectedIds || selectedIds.length === 0 ) {
			return;
		}
		try {
			await apiFetch( {
				path: '/presto-player/v1/email-submissions/delete',
				method: 'POST',
				data: { ids: selectedIds, permanent: true },
			} );
			await fetchEmails();
			setSelected( [] );
			toast.success(
				sprintf(
					/* translators: %d is the number of deleted items */
					__(
						'%d email submission(s) deleted successfully.',
						'presto-player'
					),
					selectedIds.length
				)
			);
		} catch ( error ) {
			toast.error(
				error?.message || __( 'Failed to delete.', 'presto-player' )
			);
		}
	};

	const handleBulkCancel = () => {
		setSelected( [] );
	};

	const handleMenuActions = ( id, action ) => {
		const item = ( rawEmails || [] ).find( ( e ) => e.id === id );

		switch ( action ) {
			case 'edit':
				setSelectedEmailForEdit( item );
				setShowEmailPopup( true );
				return;

			case 'trash':
				setActionPopupData( {
					title: __( 'Move to Trash?', 'presto-player' ),
					description: __(
						'Are you sure you want to move this email submission to the trash?',
						'presto-player'
					),
					confirmText: __( 'Move to Trash', 'presto-player' ),
					destructive: true,
					confirmCallback: async () => {
						try {
							await apiFetch( {
								path: '/presto-player/v1/email-submissions/delete',
								method: 'POST',
								data: { ids: [ id ] },
							} );
							await fetchEmails();
							toast.success(
								__( 'Successfully trashed.', 'presto-player' )
							);
						} catch ( error ) {
							toast.error(
								error?.message ||
									__( 'Failed to trash.', 'presto-player' )
							);
						}
						setOpenActionPopup( false );
					},
					cancelCallback: () => setOpenActionPopup( false ),
				} );
				setOpenActionPopup( true );
				return;

			case 'delete':
				setActionPopupData( {
					title: __( 'Delete?', 'presto-player' ),
					description: __(
						'Are you sure you want to delete this email submission? This action cannot be undone.',
						'presto-player'
					),
					confirmText: __( 'Delete', 'presto-player' ),
					destructive: true,
					confirmCallback: async () => {
						try {
							await apiFetch( {
								path: '/presto-player/v1/email-submissions/delete',
								method: 'POST',
								data: { ids: [ id ], permanent: true },
							} );
							await fetchEmails();
							toast.success(
								__(
									'Email submission deleted successfully.',
									'presto-player'
								)
							);
						} catch ( error ) {
							toast.error(
								error?.message ||
									__( 'Failed to delete.', 'presto-player' )
							);
						}
						setOpenActionPopup( false );
					},
					cancelCallback: () => setOpenActionPopup( false ),
				} );
				setOpenActionPopup( true );
				return;

			case 'restore':
				setActionPopupData( {
					title: __( 'Restore?', 'presto-player' ),
					description: __(
						'Are you sure you want to restore this email submission?',
						'presto-player'
					),
					confirmText: __( 'Restore', 'presto-player' ),
					confirmCallback: async () => {
						try {
							await apiFetch( {
								path: `/presto-player/v1/email-submissions/${ id }`,
								method: 'PUT',
								data: { status: 'publish' },
							} );
							await fetchEmails();
							toast.success(
								__( 'Successfully restored.', 'presto-player' )
							);
						} catch ( error ) {
							toast.error(
								error?.message ||
									__( 'Failed to restore.', 'presto-player' )
							);
						}
						setOpenActionPopup( false );
					},
					cancelCallback: () => setOpenActionPopup( false ),
				} );
				setOpenActionPopup( true );
				return;

			case 'publish':
			case 'draft': {
				const isPublish = action === 'publish';
				setActionPopupData( {
					title: isPublish
						? __( 'Mark as Publish?', 'presto-player' )
						: __( 'Save as Draft?', 'presto-player' ),
					description: isPublish
						? __(
								'Are you sure you want to mark this email submission as published?',
								'presto-player'
						  )
						: __(
								'Are you sure you want to save this email submission as draft?',
								'presto-player'
						  ),
					confirmText: isPublish
						? __( 'Mark as Publish', 'presto-player' )
						: __( 'Save as Draft', 'presto-player' ),
					confirmCallback: async () => {
						try {
							await apiFetch( {
								path: `/presto-player/v1/email-submissions/${ id }`,
								method: 'PUT',
								data: { status: isPublish ? 'publish' : 'draft' },
							} );
							await fetchEmails();
							toast.success(
								isPublish
									? __( 'Successfully published.', 'presto-player' )
									: __( 'Successfully drafted.', 'presto-player' )
							);
						} catch ( error ) {
							toast.error(
								error?.message ||
									( isPublish
										? __( 'Failed to publish.', 'presto-player' )
										: __( 'Failed to draft.', 'presto-player' ) )
							);
						}
						setOpenActionPopup( false );
					},
					cancelCallback: () => setOpenActionPopup( false ),
				} );
				setOpenActionPopup( true );
			}
		}
	};

	const actionMenus = [
		{ value: 'draft', label: __( 'Save as Draft', 'presto-player' ), icon: <FolderArchive width="15" height="15" /> },
		{ value: 'publish', label: __( 'Mark as Publish', 'presto-player' ), icon: <CheckCheck width="15" height="15" /> },
		{ value: 'trash', label: __( 'Move to Trash', 'presto-player' ), icon: <Trash width="15" height="15" /> },
		{ value: 'restore', label: __( 'Restore', 'presto-player' ), icon: <ArchiveRestore width="15" height="15" /> },
		{ value: 'delete', label: __( 'Delete Permanently', 'presto-player' ), icon: <Trash2 width="15" height="15" /> },
	];

	const renderActionMenu = ( item ) => {
		const status = item?.status || 'publish';
		const isTrashed = status === 'trash';
		// Trashed items get only Restore + Delete; everything else gets the
		// status-change actions plus Move to Trash, with the current status filtered out.
		const visible = isTrashed
			? actionMenus.filter( ( a ) => a.value === 'restore' || a.value === 'delete' )
			: actionMenus.filter(
					( a ) =>
						a.value !== 'restore' &&
						a.value !== 'delete' &&
						a.value !== status
			  );
		return visible.map( ( action ) => (
			<DropdownMenu.Item
				key={ action.value }
				onClick={ () => handleMenuActions( item.id, action.value ) }
				className="text-sm"
			>
				<div className="flex items-center gap-2">
					{ action.icon }
					{ action.label }
				</div>
			</DropdownMenu.Item>
		) );
	};

	const onNewEmailClick = ( e ) => {
		e.preventDefault();
		e.stopPropagation();
		setSelectedEmailForEdit( null );
		setShowEmailPopup( true );
	};

	const handleEmailFormSuccess = async ( data ) => {
		if ( ! data || typeof data !== 'object' ) {
			return;
		}
		const emailStr =
			data.email && typeof data.email === 'string' ? data.email.trim() : '';
		if ( ! emailStr ) {
			return;
		}
		const isEdit = Boolean( data.id );
		try {
			const saved = await apiFetch( {
				path: isEdit
					? `${ EMAIL_SUBMISSIONS_PATH }/${ data.id }`
					: EMAIL_SUBMISSIONS_PATH,
				method: isEdit ? 'PUT' : 'POST',
				data: {
					email: emailStr,
					status: data.status || 'publish',
					visibility: data.visibility || 'public',
					date: data.date,
					video_title: data.video_title || '',
					preset_name: data.preset_name || '',
				},
			} );
			// Local update mirrors MediaHub's handleSettingsSuccess. Refetching
			// would flip `loading` to true and unmount the open dialog mid-save.
			setRawEmails( ( prev ) =>
				isEdit
					? prev.map( ( item ) =>
						item.id === data.id ? { ...item, ...saved } : item
					)
					: [ saved, ...prev ]
			);
			if ( ! isEdit ) {
				// Promote the dialog from Add to Edit so a second save updates
				// the same submission instead of creating a duplicate.
				setSelectedEmailForEdit( saved );
			}
			toast.success(
				isEdit
					? __( 'Email updated.', 'presto-player' )
					: __( 'Email added.', 'presto-player' )
			);
		} catch ( error ) {
			toast.error(
				error?.message || __( 'Failed to save.', 'presto-player' )
			);
			throw error;
		}
	};

	const handleCheckboxChange = ( checked, value ) => {
		if ( checked ) {
			setSelected( [ ...selected, value.id ] );
		} else {
			setSelected( selected.filter( ( id ) => id !== value.id ) );
		}
	};

	const filteredAndSortedEmails = useMemo( () => {
		return ( emails || [] ).filter( ( item ) => {
			const matchesSearch = searchTerm
				? ( item.email || '' )
						.toLowerCase()
						.includes( searchTerm.toLowerCase() )
				: true;

			let matchesMonth = true;
			if ( filterMonth && item.date ) {
				const itemDate = new Date( item.date );
				if ( isNaN( itemDate.getTime() ) ) {
					matchesMonth = false;
				} else {
					const yyyy = itemDate.getFullYear();
					const mm = String( itemDate.getMonth() + 1 ).padStart( 2, '0' );
					matchesMonth = `${ yyyy }-${ mm }` === filterMonth;
				}
			}

			const itemStatus = item.status || 'publish';
			const matchesStatus =
				selectedStatus === 'all' || itemStatus === selectedStatus;

			return matchesSearch && matchesMonth && matchesStatus;
		} );
	}, [ emails, searchTerm, filterMonth, selectedStatus ] );

	const paginatedData = useMemo( () => {
		const startIndex = ( currentPage - 1 ) * postCount;
		return filteredAndSortedEmails.slice( startIndex, startIndex + postCount );
	}, [ filteredAndSortedEmails, currentPage, postCount ] );

	const toggleSelectAll = ( checked ) => {
		if ( checked ) {
			setSelected( filteredAndSortedEmails.map( ( item ) => item.id ) );
		} else {
			setSelected( [] );
		}
	};

	const containerClassName = 'p-8';

	let content;
	if ( loading ) {
		content = <MediaHubPageSkeleton />;
	} else if ( ! rawEmails?.length ) {
		content = (
			<Container
				className={ `${ containerClassName } flex-1 items-center justify-start pt-16` }
				direction="column"
			>
				<NoFound
					icon={
						<img
							src={ emailsEmptyState }
							width={ 70 }
							height={ 53 }
							alt=""
						/>
					}
					title={ __( 'Your email submissions will be displayed here.', 'presto-player' ) }
					description={ __(
						'Click "Add New Submission" to add a new email submission.',
						'presto-player'
					) }
					buttonText={ __( 'Add New Submission', 'presto-player' ) }
					buttonIcon={ <Plus aria-label="icon" role="img" /> }
					onButtonClick={ onNewEmailClick }
				/>
			</Container>
		);
	} else {
		content = (
			<Container className={ containerClassName } gap="md" direction="column">
				<PageHeader
					title={ __( 'Emails', 'presto-player' ) }
					showFilter={ showFilter }
					setShowFilter={ setShowFilter }
					showFilterWhen={ rawEmails?.length > 0 }
					searchPlaceholder={ __( 'Search emails…', 'presto-player' ) }
					searchValue={ searchTerm }
					onSearchChange={ setSearchTerm }
					searchInputRef={ searchInputRef }
					primaryButtonText={ __( 'Add New Submission', 'presto-player' ) }
					onPrimaryClick={ onNewEmailClick }
				/>

				<Container gap="md" direction="column">
					<BulkActions
						selected={ selected }
						onDelete={ ( selectedIds ) => {
							setActionPopupData( {
								title: __(
									'Delete Selected Items?',
									'presto-player'
								),
								description: sprintf(
									/* translators: %d is the number of items to delete */
									__(
										'Are you sure you want to delete %d item(s)? This action cannot be undone.',
										'presto-player'
									),
									selectedIds.length
								),
								confirmText: __( 'Delete', 'presto-player' ),
								destructive: true,
								confirmCallback: () => {
									handleBulkDelete( selectedIds );
									setOpenActionPopup( false );
								},
								cancelCallback: () =>
									setOpenActionPopup( false ),
							} );
							setOpenActionPopup( true );
						} }
						onCancel={ handleBulkCancel }
					/>
					{ rawEmails?.length > 0 && showFilter && (
						<Filters
							postCount={ postCount }
							setPostCount={ setPostCount }
							perPageLabel={ __( 'Emails', 'presto-player' ) }
							selects={ [
								{ options: statusOptions, value: selectedStatus, onChange: setSelectedStatus },
								{ options: monthFilterOptions, value: filterMonth, onChange: setFilterMonth },
							] }
							onClear={ handleClearFilters }
						/>
					) }
					<Table
						paginatedData={ paginatedData }
						selected={ selected }
						filteredAndSortedEmailsLength={ filteredAndSortedEmails.length }
						postCount={ postCount }
						currentPage={ currentPage }
						setCurrentPage={ setCurrentPage }
						sortField={ sortField }
						sortOrder={ sortOrder }
						onSort={ handleSort }
						onToggleSelectAll={ toggleSelectAll }
						onCheckboxChange={ handleCheckboxChange }
						onMenuAction={ handleMenuActions }
						renderActionMenu={ renderActionMenu }
					/>
				</Container>
			</Container>
		);
	}

	// Popups render in every branch so the dialog stays mounted across
	// loading/empty/populated transitions — without this, switching branches
	// unmounts EmailFormPopup mid-save (visible as a close-and-reopen flicker).
	return (
		<>
			{ content }
			<EmailFormPopup
				open={ showEmailPopup }
				onClose={ () => {
					setShowEmailPopup( false );
					setSelectedEmailForEdit( null );
				} }
				initialData={ selectedEmailForEdit }
				onSuccess={ handleEmailFormSuccess }
			/>
			<ConfirmPopup
				openConfirmPopup={ openActionPopup }
				setOpenConfirmPopup={ setOpenActionPopup }
				title={ actionPopupData?.title || '' }
				description={ actionPopupData?.description || '' }
				confirmText={ actionPopupData?.confirmText || '' }
				cancelText={
					actionPopupData?.cancelText ||
					__( 'Cancel', 'presto-player' )
				}
				confirmCallback={ actionPopupData?.confirmCallback }
				cancelCallback={ actionPopupData?.cancelCallback }
				destructive={ actionPopupData?.destructive || false }
			/>
		</>
	);
};

const Emails = () => {
	if ( ! window.prestoPlayer?.isPremium ) {
		return (
			<ProGateOverlay>
				<MediaHubPageSkeleton />
			</ProGateOverlay>
		);
	}

	return <EmailsContent />;
};

export default Emails;
