import { useState, useEffect } from 'react';
import { __ } from '@wordpress/i18n';
import { SketchPicker } from 'react-color';
import { Text, Button } from '@bsf/force-ui';
import { RefreshCcw } from 'lucide-react';

function ColorPicker( props ) {
	const { name, value, defaultColor, presetColors, hideReset = false } = props;
	const [ displayColorPicker, setDisplayColorPicker ] = useState( false );
	const [ color, setColor ] = useState( value );

	useEffect( () => {
		setColor( value );
	}, [ value ] );

	const handleClick = () => {
		setDisplayColorPicker( ( prev ) => ! prev );
	};

	const handleClose = () => {
		setDisplayColorPicker( false );
	};

	const handleColorChange = ( newColor ) => {
		const hexValue =
			newColor && newColor.hex ? newColor.hex : newColor;
		if ( ! hexValue ) {
			return;
		}
		setColor( hexValue );
		props.onChange( name, hexValue );
	};

	const handleResetColor = () => {
		handleColorChange( defaultColor );
	};

	const displayColor = color || defaultColor || '#ffffff';

	return (
		<div className="flex items-center gap-2">
			<div className="relative">
				<button
					type="button"
					onClick={ handleClick }
					className="w-8 h-8 cursor-pointer rounded border border-solid border-border-subtle p-0"
					style={ { background: displayColor } }
					title={ __( 'Select Color', 'presto-player' ) }
					aria-label={ __( 'Select Color', 'presto-player' ) }
				/>
				{ displayColorPicker && (
					<>
						<div
							className="fixed inset-0 z-40"
							onClick={ handleClose }
						/>
						<div className="absolute left-0 top-full mt-2 z-50">
							<SketchPicker
								color={ displayColor }
								onChange={ handleColorChange }
								presetColors={ presetColors }
								disableAlpha
							/>
						</div>
					</>
				) }
			</div>
			<Text size="sm" className="text-text-primary">
				{ color || defaultColor || __( 'Select Color', 'presto-player' ) }
			</Text>
			{ ! hideReset && (
				<Button
					variant="ghost"
					size="xs"
					icon={ <RefreshCcw className="w-3 h-3" /> }
					onClick={ handleResetColor }
				/>
			) }
		</div>
	);
}

export default ColorPicker;
