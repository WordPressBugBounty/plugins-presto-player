<?php
/**
 * OAuth consent screen template.
 *
 * Rendered in isolation (no theme, no wp_head). All output is escaped at
 * the point of emission. Variables provided by ConsentController::renderConsent:
 *
 * @var string                                $site_name   Blog name from get_bloginfo().
 * @var string                                $client_name Human-readable client label.
 * @var array<int, array{slug:string, description:string}> $scopes      Requested scopes with descriptions.
 * @var string                                $user_email  Logged-in user's email.
 * @var string                                $nonce_field Pre-rendered hidden nonce input HTML.
 * @var string                                $form_action Same-URL POST target.
 * @var string                                $redirect_uri Where the authorization code will be sent.
 *
 * @package PrestoPlayer
 * @subpackage Services\OAuth\Consent
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?><!doctype html>
<html lang="<?php echo esc_attr( get_bloginfo( 'language' ) ); ?>">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width,initial-scale=1">
	<meta name="robots" content="noindex,nofollow">
	<title><?php echo esc_html( sprintf( /* translators: %s: client application name. */ __( 'Authorize %s', 'presto-player' ), $client_name ) ); ?></title>
	<style>
		:root {
			color-scheme: light dark;
			--bg: #f6f7f7;
			--card-bg: #ffffff;
			--text: #1d2327;
			--muted: #50575e;
			--border: #dcdcde;
			--accent: #2271b1;
			--accent-hover: #135e96;
			--accent-text: #ffffff;
			--danger-border: #c3c4c7;
			--scope-bg: #f0f0f1;
		}
		@media (prefers-color-scheme: dark) {
			:root {
				--bg: #1d2327;
				--card-bg: #2c3338;
				--text: #f0f0f1;
				--muted: #c3c4c7;
				--border: #3c434a;
				--accent: #2271b1;
				--accent-hover: #72aee6;
				--accent-text: #ffffff;
				--danger-border: #50575e;
				--scope-bg: #1d2327;
			}
		}
		* { box-sizing: border-box; }
		html, body {
			margin: 0;
			padding: 0;
			background: var(--bg);
			color: var(--text);
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
			font-size: 15px;
			line-height: 1.5;
		}
		.wrap {
			min-height: 100vh;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 32px 16px;
		}
		.card {
			width: 100%;
			max-width: 480px;
			background: var(--card-bg);
			border: 1px solid var(--border);
			border-radius: 12px;
			padding: 32px;
			box-shadow: 0 4px 24px rgba(0,0,0,0.06);
		}
		h1 {
			font-size: 20px;
			line-height: 1.3;
			margin: 0 0 8px;
			font-weight: 600;
		}
		.subtitle {
			color: var(--muted);
			margin: 0 0 24px;
			font-size: 14px;
		}
		.client-name { font-weight: 600; }
		.unverified {
			margin: 0 0 24px;
			padding: 10px 12px;
			border: 1px solid var(--danger-border);
			border-radius: 8px;
			font-size: 13px;
			color: var(--muted);
		}
		.section-label {
			text-transform: uppercase;
			font-size: 11px;
			letter-spacing: 0.05em;
			color: var(--muted);
			margin: 24px 0 8px;
			font-weight: 600;
		}
		ul.scopes {
			list-style: none;
			margin: 0;
			padding: 0;
			border: 1px solid var(--border);
			border-radius: 8px;
			overflow: hidden;
		}
		ul.scopes li {
			padding: 12px 14px;
			background: var(--scope-bg);
			border-bottom: 1px solid var(--border);
		}
		ul.scopes li:last-child { border-bottom: 0; }
		.scope-slug {
			font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
			font-size: 12px;
			color: var(--muted);
			display: block;
			margin-bottom: 2px;
		}
		.account {
			margin: 16px 0 24px;
			padding: 12px 14px;
			border: 1px solid var(--border);
			border-radius: 8px;
			font-size: 13px;
			color: var(--muted);
		}
		.account strong { color: var(--text); }
		.destination {
			margin: 0 0 8px;
		}
		.destination strong {
			font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
			font-size: 12px;
			word-break: break-all;
		}
		.actions {
			display: flex;
			gap: 12px;
			margin-top: 24px;
		}
		button {
			flex: 1;
			border: 1px solid var(--border);
			background: transparent;
			color: var(--text);
			padding: 12px 16px;
			border-radius: 8px;
			font-size: 14px;
			font-weight: 600;
			cursor: pointer;
			font-family: inherit;
		}
		button:hover { border-color: var(--muted); }
		button.primary {
			background: var(--accent);
			border-color: var(--accent);
			color: var(--accent-text);
		}
		button.primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
		.footer {
			text-align: center;
			margin-top: 16px;
			font-size: 12px;
			color: var(--muted);
		}
	</style>
</head>
<body>
	<div class="wrap">
		<div class="card">
			<h1>
				<?php
				echo esc_html(
					sprintf(
						/* translators: %s: client application name. */
						__( 'Authorize %s', 'presto-player' ),
						$client_name
					)
				);
				?>
			</h1>
			<p class="subtitle">
				<?php
				echo wp_kses(
					sprintf(
						/* translators: 1: client application name, 2: site name. */
						__( '<span class="client-name">%1$s</span> is requesting access to your account on %2$s.', 'presto-player' ),
						esc_html( $client_name ),
						esc_html( $site_name )
					),
					array( 'span' => array( 'class' => array() ) )
				);
				?>
			</p>

			<p class="unverified">
				<?php esc_html_e( 'This is a third-party application that has not been verified. Only continue if you trust it.', 'presto-player' ); ?>
			</p>

			<div class="section-label"><?php esc_html_e( 'This will allow the app to:', 'presto-player' ); ?></div>
			<ul class="scopes">
				<?php foreach ( $scopes as $scope ) : ?>
					<li>
						<span class="scope-slug"><?php echo esc_html( $scope['slug'] ); ?></span>
						<?php echo esc_html( $scope['description'] ); ?>
					</li>
				<?php endforeach; ?>
			</ul>

			<?php if ( '' !== $redirect_uri ) : ?>
				<div class="section-label"><?php esc_html_e( 'Access will be sent to:', 'presto-player' ); ?></div>
				<div class="account destination">
					<strong><?php echo esc_html( $redirect_uri ); ?></strong>
				</div>
			<?php endif; ?>

			<div class="account">
				<?php esc_html_e( 'Signed in as', 'presto-player' ); ?>
				<strong><?php echo esc_html( $user_email ); ?></strong>
			</div>

			<form method="post" action="<?php echo esc_url( $form_action ); ?>" autocomplete="off">
				<?php
				// Pre-built nonce field is already escaped HTML.
				echo $nonce_field; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				?>
				<div class="actions">
					<button type="submit" name="deny" value="1">
						<?php esc_html_e( 'Deny', 'presto-player' ); ?>
					</button>
					<button type="submit" name="allow" value="1" class="primary">
						<?php esc_html_e( 'Allow', 'presto-player' ); ?>
					</button>
				</div>
			</form>

			<p class="footer">
				<?php esc_html_e( 'An administrator can revoke this access by turning off AI access in the Presto Player settings. That revokes every app at once.', 'presto-player' ); ?>
			</p>
		</div>
	</div>
</body>
</html>
