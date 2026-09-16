// External Dependencies
import React, { Component } from 'react';
import RenderPlayer from './RenderPlayer.jsx';
// Internal Dependencies
import './style.css';

import { __ } from '@wordpress/i18n';

class PrestoPlayer extends Component {
	static slug = 'prpl_presto_player';

	constructor( props ) {
		super( props );
		this.state = {
			videos: [],
		};
	}

	/* eslint-disable camelcase -- url_override is the Divi dynamic-content field key from the module's props contract; renaming it breaks the Divi builder integration. */
	render() {
		const url_override = this.props.dynamic.url_override; // https://gist.github.com/lots0logs/9b6bb0b3d494f4d0bdf957955d97cb26

		if ( this.props.video_id ) {
			return (
				<RenderPlayer
					id={ this.props.video_id }
					src={ url_override && url_override.value && url_override.value }
				/>
			);
		}
		return (
			<presto-video-curtain-ui>
				<span>{ __( 'Please select media.', 'presto-player' ) }</span>
			</presto-video-curtain-ui>
		);
	}
	/* eslint-enable camelcase */
}

export default PrestoPlayer;
