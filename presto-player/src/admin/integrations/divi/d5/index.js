import { registerModule } from '@divi/module-library';
import metadata from '../../../../../inc/Integrations/Divi/D5/module-json/player/module.json';
import conversionOutline from '../../../../../inc/Integrations/Divi/D5/module-json/player/conversion-outline.json';
import PlayerEdit from './modules/PlayerEdit.jsx';
import MediaHubField from './fields/MediaHubField.jsx';

// register the custom Media-Hub picker field so module.json can reference it by name
const registerField = () =>
	window.divi?.fieldLibrary?.registerFieldComponent?.( {
		name: MediaHubField.fieldName,
		component: MediaHubField,
	} );

registerField();

window.vendor?.wp?.hooks?.addAction?.(
	'divi.moduleLibrary.registerModuleLibraryStore.after',
	'presto-player',
	() => {
		// re-register in case field-library.js loaded after us
		registerField();

		registerModule( metadata, {
			conversionOutline,
			renderers: {
				edit: PlayerEdit,
			},
		} );
	}
);
