import { Text } from '@bsf/force-ui';

const TITLE_SIZE_CLASSES = {
	xs: '!text-sm',
	sm: '!text-base',
	md: '!text-lg',
};

const SectionCard = ( {
	title,
	description,
	children,
	titleAddon,
	titleSize = 'sm',
} ) => {
	const titleClassName = `${
		TITLE_SIZE_CLASSES[ titleSize ] || TITLE_SIZE_CLASSES.sm
	} !font-semibold m-0 p-0 text-text-primary`;
	return (
		<div className="bg-white p-6 box-border shadow-sm rounded-xl">
			{ ( title || description ) && (
				<div className="mb-4">
					{ title &&
						( titleAddon ? (
							<div className="flex items-center gap-1.5">
								<h3 className={ titleClassName }>{ title }</h3>
								{ titleAddon }
							</div>
						) : (
							<h3 className={ titleClassName }>{ title }</h3>
						) ) }
					{ description && (
						<Text size="sm" className="text-text-secondary mt-1">
							{ description }
						</Text>
					) }
				</div>
			) }
			{ children }
		</div>
	);
};

export default SectionCard;
