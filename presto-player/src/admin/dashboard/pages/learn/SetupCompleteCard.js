import React from 'react';
import { __ } from '@wordpress/i18n';

const SetupCompleteCard = () => {
	return (
		<div className="flex items-start gap-4 rounded-lg border border-solid border-brand-primary-100 bg-brand-primary-50 p-5">
			<span
				role="img"
				aria-label={ __( 'Celebration', 'presto-player' ) }
				className="text-2xl leading-none shrink-0"
			>
				🎉
			</span>

			<div className="flex-1">
				<h3 className="m-0 text-base font-semibold text-text-primary">
					{ __( "You've completed setup!", 'presto-player' ) }
				</h3>
				<p className="m-0 mt-1 text-sm text-text-secondary leading-relaxed">
					{ __(
						'Your video player is ready. Explore Pro features below to unlock analytics, email capture, and advanced integrations.',
						'presto-player'
					) }
				</p>
			</div>
		</div>
	);
};

export default SetupCompleteCard;
