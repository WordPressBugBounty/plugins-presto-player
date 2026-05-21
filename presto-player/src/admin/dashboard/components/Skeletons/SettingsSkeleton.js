import { Skeleton, Sidebar, Menu } from '@bsf/force-ui';
import SettingsSectionSkeleton from './SettingsSectionSkeleton';

// Mirrors the real sidebar shape (Settings.js): grouped Menu.Lists with
// headings + a standalone Menu.List preceded by a Menu.Separator. Item counts
// match the real nav (General: 7, Integrations: 5, Performance: 1) so the
// skeleton settles into the real layout without a height jump.
const SIDEBAR_GROUPS = [
	{
		headingWidth: 'w-14',
		itemWidths: [
			'w-[110px]',
			'w-[100px]',
			'w-[130px]',
			'w-[90px]',
			'w-[110px]',
			'w-[100px]',
			'w-[120px]',
		],
	},
	{
		headingWidth: 'w-20',
		itemWidths: [
			'w-[130px]',
			'w-[90px]',
			'w-[120px]',
			'w-[100px]',
			'w-[110px]',
		],
	},
	{
		headingWidth: 'w-24',
		itemWidths: [ 'w-[110px]' ],
	},
];

const STANDALONE_ITEM_WIDTH = 'w-[80px]';

// Menu.Item adds `[&>*:not(svg)]:m-1` to every non-SVG child. Override the
// icon skeleton's margin to match the real Lucide icon's `[&>svg]:m-1.5`
// outer box so the skeleton rows don't render 4px shorter than real rows.
const MenuItemSkeleton = ( { width } ) => (
	<Menu.Item disabled>
		<Skeleton className="!m-1.5 size-5 shrink-0 rounded" />
		<div className="flex-1">
			<Skeleton className={ `${ width } h-4 rounded-md` } />
		</div>
	</Menu.Item>
);

const SettingsSkeleton = ( { cards = 1 } ) => (
	<div className="flex min-h-[calc(100vh-var(--presto-admin-bar-h)-var(--presto-navbar-h))]">
		<Sidebar
			borderOn={ false }
			collapsible={ false }
			collapsed={ false }
			className="!w-[240px] !min-w-[240px] shrink-0 !p-3 !h-auto sticky top-[calc(var(--presto-admin-bar-h)+var(--presto-navbar-h))] max-h-[calc(100vh-var(--presto-admin-bar-h)-var(--presto-navbar-h))] overflow-y-auto"
		>
			<Sidebar.Body className="grow">
				<Menu size="md" className="p-0 w-full gap-2">
					{ SIDEBAR_GROUPS.map( ( group, groupIndex ) => (
						<Menu.List
							key={ groupIndex }
							open
							heading={
								<Skeleton
									className={ `${ group.headingWidth } h-3 rounded-md` }
								/>
							}
						>
							{ group.itemWidths.map( ( width, itemIndex ) => (
								<MenuItemSkeleton key={ itemIndex } width={ width } />
							) ) }
						</Menu.List>
					) ) }

					<Menu.Separator />

					<Menu.List open>
						<MenuItemSkeleton width={ STANDALONE_ITEM_WIDTH } />
					</Menu.List>
				</Menu>
			</Sidebar.Body>
		</Sidebar>

		<div className="flex-1 min-w-0 bg-background-secondary p-6">
			<div className="max-w-3xl w-full mx-auto flex flex-col gap-6">
				<div className="w-full flex items-center justify-between">
					<Skeleton className="h-6 w-32 rounded-md" />
					<Skeleton className="h-8 w-16 rounded-md" />
				</div>
				<SettingsSectionSkeleton cards={ cards } />
			</div>
		</div>
	</div>
);

export default SettingsSkeleton;
