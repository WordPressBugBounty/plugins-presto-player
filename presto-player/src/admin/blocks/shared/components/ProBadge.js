import { __ } from '@wordpress/i18n';

export default function () {
	return (
		<div className="presto-player__pro-badge">
			{ __( 'Pro', 'presto-player' ) }
		</div>
	);
}
