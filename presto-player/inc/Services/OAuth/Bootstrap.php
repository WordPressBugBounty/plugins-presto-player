<?php
/**
 * OAuth bootstrap.
 *
 * @package PrestoPlayer
 * @subpackage Services\OAuth
 */

namespace PrestoPlayer\Services\OAuth;

use PrestoPlayer\Contracts\Service;
use PrestoPlayer\Services\Abilities\Module as AbilitiesModule;
use PrestoPlayer\Services\OAuth\Authentication\BearerAuthenticator;
use PrestoPlayer\Services\OAuth\Authentication\ChallengeResponder;
use PrestoPlayer\Services\OAuth\Endpoints\AuthorizeEndpoint;
use PrestoPlayer\Services\OAuth\Endpoints\DiscoveryEndpoint;
use PrestoPlayer\Services\OAuth\Endpoints\RegisterEndpoint;
use PrestoPlayer\Services\OAuth\Endpoints\RevokeEndpoint;
use PrestoPlayer\Services\OAuth\Endpoints\TokenEndpoint;
use PrestoPlayer\Services\OAuth\Storage\ClientRepository;
use PrestoPlayer\Services\OAuth\Storage\CodeRepository;
use PrestoPlayer\Services\OAuth\Storage\TokenRepository;

/**
 * Registers the OAuth REST surface (DCR / authorize / token / revoke +
 * discovery + bearer auth) only when AI access is switched on.
 *
 * Keeping this behind a single always-registered service lets config/app.php
 * stay a flat registration list: it lists Bootstrap, and Bootstrap decides at
 * runtime whether the gated endpoints load. Leaving the endpoints registered
 * while the feature is off would expose an open `/oauth/register` endpoint
 * hitting tables that don't exist yet. OAuth\Module stays registered regardless
 * so it can install the schema on the enable transition.
 */
class Bootstrap implements Service {

	/**
	 * Register the gated OAuth services when AI access is enabled.
	 *
	 * @return void
	 */
	public function register() {
		if ( ! $this->isEnabled() ) {
			return;
		}

		foreach ( $this->gatedServices() as $service ) {
			$service->register();
		}
	}

	/**
	 * Whether the AI-access (MCP) toggle is on.
	 *
	 * @return bool
	 */
	protected function isEnabled() {
		$option = get_option( AbilitiesModule::OPTION_KEY, array() );
		return is_array( $option ) && ! empty( $option['enabled'] );
	}

	/**
	 * Build the OAuth services gated behind the toggle, sharing one instance of
	 * each storage repository across the endpoints that need it (the same wiring
	 * the DI container did when these were listed individually).
	 *
	 * @return Service[]
	 */
	protected function gatedServices() {
		$clients = new ClientRepository();
		$codes   = new CodeRepository();
		$tokens  = new TokenRepository();

		return array(
			new RegisterEndpoint( $clients ),
			new AuthorizeEndpoint(),
			new TokenEndpoint( $clients, $codes, $tokens ),
			new RevokeEndpoint( $clients, $tokens ),
			new DiscoveryEndpoint(),
			new BearerAuthenticator(),
			new ChallengeResponder(),
		);
	}
}
