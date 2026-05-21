/**
 * Data table: sortable columns, pagination, row actions. Matches MediaHub table pattern.
 */
const { __ } = wp.i18n;
import {
	Table as ForceTable,
	Pagination,
	Button,
	Tooltip,
	DropdownMenu,
	Text,
} from '@bsf/force-ui';
import {
	ChevronsUpDown,
	Settings,
	Trash,
	Trash2,
	ArchiveRestore,
	Ellipsis,
	Info,
} from 'lucide-react';
import { getBadge, formatPublishDate } from './Utils';
import { getViewportBoundary } from '../../utils/viewportBoundary';

const Table = ( {
	paginatedData,
	selected,
	filteredAndSortedEmailsLength,
	postCount,
	currentPage,
	setCurrentPage,
	sortField,
	sortOrder,
	onSort,
	onToggleSelectAll,
	onCheckboxChange,
	onMenuAction,
	renderActionMenu,
} ) => {
	const totalPages =
		postCount <= 0 ? 0 : Math.ceil( filteredAndSortedEmailsLength / postCount );
	const startIndex =
		filteredAndSortedEmailsLength === 0
			? 0
			: ( currentPage - 1 ) * postCount + 1;
	const endIndex = Math.min(
		currentPage * postCount,
		filteredAndSortedEmailsLength
	);

	const renderRowActions = ( item ) => {
		const isTrashed = ( item.status || 'publish' ) === 'trash';
		const inlineActions = isTrashed
			? [
					{
						value: 'restore',
						label: __( 'Restore', 'presto-player' ),
						icon: <ArchiveRestore />,
					},
					{
						value: 'delete',
						label: __( 'Delete Permanently', 'presto-player' ),
						icon: <Trash2 />,
					},
			  ]
			: [
					{
						value: 'edit',
						label: __( 'Post Settings', 'presto-player' ),
						icon: <Settings />,
					},
					{
						value: 'trash',
						label: __( 'Move to Trash', 'presto-player' ),
						icon: <Trash />,
					},
			  ];

		return (
			<>
				{ inlineActions.map( ( action ) => (
					<Tooltip
						key={ action.value }
						content={ action.label }
						arrow
						placement="top"
					>
						<Button
							variant="ghost"
							icon={ action.icon }
							size="xs"
							className="text-icon-secondary hover:text-icon-primary"
							aria-label={ action.label }
							onClick={ ( e ) => {
								e.preventDefault();
								e.stopPropagation();
								onMenuAction( item.id, action.value );
							} }
						/>
					</Tooltip>
				) ) }
				<DropdownMenu boundary={ getViewportBoundary() }>
					<DropdownMenu.Trigger>
						<Button
							variant="ghost"
							icon={ <Ellipsis /> }
							size="xs"
							className="text-icon-secondary hover:text-icon-primary z-0"
							aria-label={ __( 'More Options', 'presto-player' ) }
						/>
					</DropdownMenu.Trigger>
					<DropdownMenu.ContentWrapper className="z-10">
						<DropdownMenu.Content className="w-48">
							<DropdownMenu.List>
								{ renderActionMenu ? renderActionMenu( item ) : null }
							</DropdownMenu.List>
						</DropdownMenu.Content>
					</DropdownMenu.ContentWrapper>
				</DropdownMenu>
			</>
		);
	};

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

	return (
		<div className="gap-0">
			<ForceTable checkboxSelection={ true }>
				<ForceTable.Head
					selected={
						selected.length > 0 && selected.length === filteredAndSortedEmailsLength
					}
					onChangeSelection={ onToggleSelectAll }
					indeterminate={
						selected.length > 0 && selected.length < filteredAndSortedEmailsLength
					}
					className="bg-background-primary items-center"
				>
					<ForceTable.HeadCell className="text-text-secondary items-center">
						{ __( 'Email', 'presto-player' ) }
					</ForceTable.HeadCell>
					<ForceTable.HeadCell className="text-text-secondary items-center">
						{ __( 'Status', 'presto-player' ) }
					</ForceTable.HeadCell>
					<ForceTable.HeadCell className="text-text-secondary">
						<span className="inline-flex items-center gap-1.5">
							{ __( 'Video', 'presto-player' ) }
							<Tooltip
								content={ __(
									'The video the viewer was watching when they submitted their email.',
									'presto-player'
								) }
								arrow
								placement="top"
							>
								<Info className="size-3.5 text-icon-secondary cursor-help shrink-0" />
							</Tooltip>
						</span>
					</ForceTable.HeadCell>
					<ForceTable.HeadCell className="text-text-secondary">
						<span className="inline-flex items-center gap-1.5">
							{ __( 'Preset', 'presto-player' ) }
							<Tooltip
								content={ __(
									'The player preset configured to collect this email submission.',
									'presto-player'
								) }
								arrow
								placement="top"
							>
								<Info className="size-3.5 text-icon-secondary cursor-help shrink-0" />
							</Tooltip>
						</span>
					</ForceTable.HeadCell>
					<ForceTable.HeadCell
						onClick={ () => onSort( 'date' ) }
						className="cursor-pointer items-center gap-2 text-text-secondary"
					>
						{ __( 'Date', 'presto-player' ) }
						<ChevronsUpDown
							width="15"
							height="15"
							className="text-icon-secondary align-middle ml-2"
							style={
								sortField === 'date' && sortOrder === 'asc'
									? { transform: 'rotate(180deg)' }
									: {}
							}
						/>
					</ForceTable.HeadCell>
					<ForceTable.HeadCell className="items-center justify-center">
						<span className="sr-only">
							{ __( 'Actions', 'presto-player' ) }
						</span>
					</ForceTable.HeadCell>
				</ForceTable.Head>

				<ForceTable.Body>
					{ paginatedData && paginatedData.length > 0 ? (
						paginatedData.map( ( item ) => (
							<ForceTable.Row
								key={ item.id }
								value={ item }
								selected={ selected.includes( item.id ) }
								onChangeSelection={ onCheckboxChange }
							>
								<ForceTable.Cell className="min-w-[180px] max-w-[280px] text-left">
									<Text
										as="span"
										size="sm"
										className="text-text-primary block truncate"
									>
										{ item.email }
									</Text>
								</ForceTable.Cell>
								<ForceTable.Cell className="min-w-[100px] text-left">
									{ getBadge( item.status || 'publish' ) }
								</ForceTable.Cell>
								<ForceTable.Cell className="min-w-[140px] max-w-[220px] text-left">
									<Text
										as="span"
										size="sm"
										className={ `${ item.video_title ? 'text-text-primary' : 'text-text-secondary' } block truncate` }
									>
										{ item.video_title || __( 'No video', 'presto-player' ) }
									</Text>
								</ForceTable.Cell>
								<ForceTable.Cell className="min-w-[120px] max-w-[200px] text-left">
									<Text
										as="span"
										size="sm"
										className={ `${ item.preset_name ? 'text-text-primary' : 'text-text-secondary' } block truncate` }
									>
										{ item.preset_name || __( 'No preset', 'presto-player' ) }
									</Text>
								</ForceTable.Cell>
								<ForceTable.Cell className="w-[200px] text-left whitespace-nowrap">
									{ formatPublishDate( item.date ) }
								</ForceTable.Cell>
								<ForceTable.Cell className="w-[130px] text-right">
									<div className="flex items-center justify-center gap-2">
										{ renderRowActions( item ) }
									</div>
								</ForceTable.Cell>
							</ForceTable.Row>
						) )
					) : (
						<tr>
							<td
								colSpan="7"
								className="px-6 py-8 text-center text-text-secondary"
							>
								{ __( 'No emails found.', 'presto-player' ) }
							</td>
						</tr>
					) }
				</ForceTable.Body>

				{ paginatedData?.length > 0 && (
					<ForceTable.Footer className="bg-background-primary">
						<div className="flex items-center justify-between w-full">
							<span className="text-sm font-normal leading-5 text-text-secondary">
								{ `${ startIndex }–${ endIndex } ${ __(
									'of',
									'presto-player'
								) } ${ filteredAndSortedEmailsLength } ${ __(
									'items',
									'presto-player'
								) }` }
							</span>
							<Pagination className="w-fit">
								<Pagination.Content>{ renderPagination() }</Pagination.Content>
							</Pagination>
						</div>
					</ForceTable.Footer>
				) }
			</ForceTable>
		</div>
	);
};

export default Table;
