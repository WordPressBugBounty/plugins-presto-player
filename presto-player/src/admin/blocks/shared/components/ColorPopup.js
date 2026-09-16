const { ColorPicker, ColorIndicator, Popover, Button } = wp.components;
const { useState, useEffect } = wp.element;
import { __ } from '@wordpress/i18n';
import './ColorPopup.scss';

export default ( { color, setColor, onFocus } ) => {
	const [ open, setOpen ] = useState( false );
	const [ original, setOriginal ] = useState( color );

	useEffect( () => {
		if ( open && color ) {
			setOriginal( color );
		}
	}, [ open ] );

	return (
		<span>
			<ColorIndicator
				className="presto-color-popup__indicator"
				colorValue={ color }
				onClick={ () => {
					setOpen( ! open );
					if ( onFocus ) {
						onFocus();
					}
				} }
			/>
			{ !! open && (
				<Popover
					position="bottom left"
					focusOnMount
					onFocusOutside={ () => {
						setOpen( false );
					} }
					className="presto-color-popup__picker"
				>
					<ColorPicker
						color={ color || '' }
						onChangeComplete={ ( value ) => value?.hex && setColor( value ) }
						disableAlpha
					/>
					<div className="presto-color-popup__actions">
						<Button
							className="presto-color-popup__button"
							isTertiary
							onClick={ () => {
								setColor( { hex: null } );
								setOpen( false );
							} }
						>
							{ __( 'Reset', 'presto-player' ) }
						</Button>
						<div className="presto-color-popup__footer">
							<Button
								className="presto-color-popup__button"
								isTertiary
								onClick={ () => {
									setColor( { hex: original } );
									setOpen( false );
								} }
							>
								{ __( 'Cancel', 'presto-player' ) }
							</Button>
							<Button isPrimary onClick={ () => setOpen( false ) }>
								{ __( 'Apply', 'presto-player' ) }
							</Button>
						</div>
					</div>
				</Popover>
			) }
		</span>
	);
};
