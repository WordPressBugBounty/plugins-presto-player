import LearnPage from './learn/LearnPage';

import { __ } from '@wordpress/i18n';

const Learn = () => {
	return (
		<main className="bg-background-secondary">
			<h1 className="sr-only">{ __( 'Learn', 'presto-player' ) }</h1>
			<LearnPage />
		</main>
	);
};

export default Learn;
