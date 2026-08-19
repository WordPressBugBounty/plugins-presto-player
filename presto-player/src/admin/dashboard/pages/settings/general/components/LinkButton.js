const BASE_CLASS =
	'text-link-primary underline bg-transparent border-0 p-0 cursor-pointer disabled:opacity-50 inline-flex items-center gap-1 align-middle';

/**
 * Renders link-styled inline actions. With an `href` it renders a real anchor
 * (so a real click target works without a programmatic popup); otherwise it
 * renders a `<button>` for in-page actions.
 *
 * @param {Object}   props
 * @param {string}   [props.href]      When set, renders an anchor to this URL.
 * @param {Function} [props.onClick]   Click handler for the button variant.
 * @param {boolean}  [props.disabled]  Disables the button variant.
 * @param {string}   [props.className] Extra classes appended to the base style.
 * @param {Node}     props.children    Button/anchor contents.
 */
const LinkButton = ( {
	href,
	onClick,
	disabled = false,
	className = '',
	children,
	...rest
} ) => {
	const classes = className ? `${ BASE_CLASS } ${ className }` : BASE_CLASS;

	if ( href ) {
		return (
			<a
				href={ href }
				target="_blank"
				rel="noopener noreferrer"
				className={ classes }
				{ ...rest }
			>
				{ children }
			</a>
		);
	}

	return (
		<button
			type="button"
			className={ classes }
			onClick={ onClick }
			disabled={ disabled }
			{ ...rest }
		>
			{ children }
		</button>
	);
};

export default LinkButton;
