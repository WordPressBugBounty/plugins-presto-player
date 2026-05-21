const PADDING_PX = 16;
let boundaryElement = null;

export const getViewportBoundary = () => {
	if ( typeof document === 'undefined' ) {
		return 'clippingAncestors';
	}
	if ( ! boundaryElement || ! document.body.contains( boundaryElement ) ) {
		const el = document.createElement( 'div' );
		el.setAttribute( 'aria-hidden', 'true' );
		el.dataset.dropdownViewportBoundary = 'true';
		Object.assign( el.style, {
			position: 'fixed',
			top: `${ PADDING_PX }px`,
			right: `${ PADDING_PX }px`,
			bottom: `${ PADDING_PX }px`,
			left: `${ PADDING_PX }px`,
			pointerEvents: 'none',
			zIndex: '-1',
		} );
		document.body.appendChild( el );
		boundaryElement = el;
	}
	return boundaryElement;
};
