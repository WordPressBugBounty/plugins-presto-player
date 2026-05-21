# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Presto Player is a WordPress video player plugin (v4.1.0) that provides video capabilities for WordPress websites with support for multiple sources (YouTube, Vimeo, self-hosted HTML5, HLS streams, Bunny.net). It features a modern architecture combining PHP backend with React frontend, built specifically for WordPress Block Editor (Gutenberg) with extensive LMS and page builder integrations.

**Requirements:** PHP 7.3+, WordPress 5.6+

## Context7 — Always Look Up Docs Before Writing Code

Before implementing any feature, always use Context7 (MCP) to look up the relevant library/framework documentation. This applies to **every tech stack** — not just WordPress. Use `resolve-library-id` to find the library, then `query-docs` to get current API details.

**When to use:** Any time you're about to write code that uses a library, framework, or API — WordPress hooks, React components, CSS/Tailwind utilities, PHP functions, Stencil.js, or any dependency in the project.

**Pre-resolved WordPress sources** (skip resolve step for these):
- **WordPress API Reference** (`/websites/developer_wordpress_reference`) — functions, general API
- **WordPress Classes** (`/websites/developer_wordpress_reference_classes`) — `WP_Query`, `WP_REST_*`, etc.
- **WordPress Hooks** (`/websites/developer_wordpress_reference_hooks`) — actions & filters

**For all other libraries** (React, Tailwind, Stencil, Force UI, HLS.js, Plyr, etc.), resolve the library ID first, then query the relevant docs before implementation.

## Use Existing APIs First — Don't Reinvent What the Platform Provides

Before implementing any feature, check whether WordPress, Gutenberg, or the library/framework you're working with already provides it. Custom code should only exist when the platform genuinely cannot do what's needed.

**This applies to every layer of the stack:**

**PHP / Backend:**
1. **WP REST API** — `WP_REST_Posts_Controller` already handles CRUD for any post type with `show_in_rest`. Before writing a custom REST endpoint for updating post fields (title, slug, status, date, password, taxonomies, meta), check if `/wp/v2/{rest_base}/{id}` already supports it.
2. **Core functions** — `wp_update_post()`, `wp_insert_post()`, `wp_set_post_terms()`, `update_post_meta()` etc. already handle sanitization, capability checks, and hooks. Don't rewrite what they do.

**JavaScript / Gutenberg / Block Editor:**
1. **`@wordpress/data` stores** — `core`, `core/editor`, `core/block-editor`, `core/notices` already expose selectors and actions for posts, blocks, settings, and UI state. Check existing stores before creating custom state management.
2. **`@wordpress/api-fetch`** — Already handles nonces, error parsing, and middleware. Don't build custom fetch wrappers.
3. **Block Editor APIs** — `registerBlockType`, `InspectorControls`, `useBlockProps`, `RichText`, `InnerBlocks` etc. already solve most block UI needs. Check the Block Editor Handbook before building custom solutions.
4. **`@wordpress/components`** — For block editor UI (not dashboard), WordPress provides ready-made components. Don't rebuild what exists.

**The test:** Before writing custom code, ask: "Does the platform already do this?" If your code is just wrapping or proxying a built-in API with minor additions, use the built-in API directly.

## LSP — Prefer for Code Navigation

When navigating code — finding definitions, references, implementations, or call chains — prefer the LSP tool over Grep/Glob for `.php`, `.ts`, `.js`, `.tsx`, and `.jsx` files. LSP provides accurate, type-aware results.

**Use LSP for:** `goToDefinition`, `findReferences`, `hover` (type info), `documentSymbol` (list symbols in a file), `workspaceSymbol` (search symbols across workspace), `goToImplementation`, `incomingCalls`, `outgoingCalls`.

**Fall back to Grep/Glob for:** text/string searches, pattern matching, file discovery, or when LSP returns no results.

## Development Commands

### Initial Setup
```bash
# Install dependencies
yarn && composer install

# Bootstrap workspace packages (first-time setup)
yarn bootstrap

# Start development mode (includes composer install + watch)
yarn dev
```

### Build Commands
```bash
# Development build and watch
yarn start                  # Watch mode with wp-scripts
yarn start:workspace        # Watch all workspace packages

# Production build
yarn build                  # Build main plugin
yarn build:workspace        # Build all workspace packages

# Release build (full production)
yarn plugin:release         # Complete release: deps, i18n, build, zip
```

### Testing

**PHP Tests** (requires wp-env running):
```bash
yarn test:php                    # Run all PHPUnit tests
yarn test:php:failing            # Run only tests marked @group failing
composer test                    # Direct PHPUnit run (alternative)
```

**JavaScript Tests**:
```bash
yarn test:unit                   # Jest unit tests
```

**E2E Tests** (requires wp-env running):
```bash
yarn test:e2e                    # WordPress E2E scripts
yarn test:e2e:playwright         # Playwright tests
yarn test:e2e:playwright:ui      # Playwright UI mode
yarn test:e2e:playwright:debug   # Playwright debug mode
yarn test:e2e:playwright:trace   # Playwright with tracing
```

### WordPress Environment
```bash
# Start/stop local WordPress environment (wp-env)
wp-env start                     # Start WordPress at :3333 (tests at :4333)
wp-env stop                      # Stop environment
```

### Linting & Formatting
```bash
yarn lint:js                     # ESLint
yarn lint:css                    # Stylelint
yarn format                      # Prettier format

composer lint                    # PHPCS (PHP_CodeSniffer)
composer format                  # PHPCBF (PHP auto-fix)
```

### Translation
```bash
yarn makepot                     # Generate .pot file from src/, inc/, templates/
```

## Architecture Overview

### PHP Backend Architecture

**Entry Point:** `presto-player.php` → `Factory` → `Controller` → Component registration

**Dependency Injection Container:**
- Uses **DICE** DI container for loose coupling
- Configured via `inc/Factory.php` and `inc/config/app.php`
- Components implement `Service` interface with `register()` method
- Singleton services (Settings, BunnyCDN, Scripts) marked as `'shared' => true`

**Key Architectural Layers:**
```
presto-player.php (entry)
  ↓
Factory::getRules() - DI configuration
  ↓
Controller::run() - Registers all components
  ↓
Components (each calls register() method):
  - Blocks (10 block types)
  - Services (23+ services including Scripts, Settings, Menu, Shortcodes)
  - Integrations (11 integrations: LearnDash, Elementor, Divi, etc.)
  - Database (migrations, models)
  - API (REST controllers)
```

**Component Discovery:**
- All components listed in `inc/config/app.php` under `components` array
- Pro components added via `presto_player_pro_components` filter
- Factory creates instances with dependencies via DICE container
- Controller loops through components and calls `register()`

**Namespace:** `PrestoPlayer\` (PSR-4 autoloaded to `inc/`)

**Database:**
- Custom tables managed in `inc/Database/`
- Tables: videos, presets, audio_presets, email_collection, visits, webhooks
- Models in `inc/Models/` provide ORM-like interface
- Migrations handled via `inc/Services/Migrations.php`

### Frontend (JavaScript/React)

**Build System:**
- Yarn 3.3.0 workspaces (monorepo)
- WordPress Scripts (Webpack, Babel)
- Emotion CSS-in-JS for styling
- React 17.0.2

**Directory Structure:**
```
src/
├── admin/          # WordPress admin React interfaces
├── player/         # Player components
├── router/         # Page routing
├── hooks/          # React hooks
├── shared/         # Shared utilities
├── elementor/      # Elementor integration UI
└── libraries/      # Custom libraries

dist/               # Compiled assets (auto-generated)
```

**Key Patterns:**
- Block-first design (Gutenberg blocks in `inc/Blocks/`)
- REST API for admin interfaces (`inc/Services/API/`)
- Dynamic loading for performance (scripts loaded conditionally)

### Block Development

**Block Registration:**
1. Create block class in `inc/Blocks/` extending base block class
2. Add to `inc/config/app.php` components array
3. Implement `register()` method to register with WordPress
4. Block attributes defined in block class
5. React component in `src/` for editor interface

**Block Types:**
- Video blocks: SelfHostedBlock, YouTubeBlock, VimeoBlock
- Reusable: ReusableVideoBlock, MediaHubBlock
- Audio: AudioBlock
- Popup: PopupBlock, PopupTriggerBlock, PopupMediaBlock

### Integrations

**LMS Integrations** (`inc/Integrations/`):
- LearnDash (video progression)
- TutorLMS
- LifterLMS

**Page Builders:**
- Elementor (custom widgets)
- Beaver Builder (custom modules)
- Divi (custom modules)
- Kadence

Each integration is a component that registers when its parent plugin is active.

## Code Patterns & Conventions

### PHP Patterns
- **PSR-4 Autoloading**: All classes under `PrestoPlayer\` namespace
- **Service Pattern**: Components implement `Service` interface
- **Singleton Pattern**: Core instance via `Core::set_instance()`
- **Factory Pattern**: DI container configuration in Factory class
- **Hook System**: WordPress hooks (`add_action`, `add_filter`)

### JavaScript Patterns
- **React Components**: Functional components with hooks
- **CSS-in-JS**: Emotion for styling
- **WordPress Data**: `@wordpress/data` for state management
- **i18n**: WordPress i18n functions for translations

### Namespacing
- PHP classes are namespaced: `PrestoPlayer\Services\Settings`
- Imposter plugin isolates vendor dependencies under `PrestoPlayer\` namespace

## Security Checklist

Every REST endpoint, AJAX handler, form processor, or shortcode callback **must** pass these checks. Do not skip any — WordPress plugin reviewers and security auditors flag these as critical.

### Authentication & Authorization
- **Capability check:** `current_user_can( 'edit_posts' )` (or appropriate capability) before any state-changing operation
- **Nonce verification:** `wp_verify_nonce()` for admin forms; REST API routes use `permission_callback` (never set to `__return_true` for write operations)
- **REST permission_callback:** Every `register_rest_route()` must have a `permission_callback` — use `current_user_can()` checks, not blanket `__return_true`

### Input Sanitization (before storage/use)
- **Strings:** `sanitize_text_field()`, `sanitize_textarea_field()`, `sanitize_title()`
- **URLs:** `esc_url_raw()` (for DB storage), `esc_url()` (for output)
- **Integers:** `absint()`, `intval()`
- **HTML content:** `wp_kses_post()` (allows safe HTML), `wp_kses()` (custom allowed tags)
- **File paths:** `sanitize_file_name()`, validate against allowed directories
- **Arrays/complex data:** Sanitize each element individually — never trust `$_POST` or `$_GET` raw
- **REST requests:** Use `$request->get_param()` with sanitize/validate callbacks in the schema

### Output Escaping (before rendering)
- **HTML context:** `esc_html()`, `esc_html__()`
- **Attribute context:** `esc_attr()`, `esc_attr__()`
- **URL context:** `esc_url()`
- **JavaScript context:** `esc_js()`, or better — use `wp_localize_script()` / `wp_add_inline_script()`
- **CSS context:** `safecss_filter_attr()`

### Database Queries
- **Always use `$wpdb->prepare()`** for any query with dynamic values — no exceptions
- **Never concatenate** user input into SQL strings
- Prefer WordPress API functions (`get_post_meta()`, `WP_Query`) over raw queries when possible

### Common Pitfalls to Avoid
- Never use `$_GET`, `$_POST`, `$_REQUEST` directly — access via `WP_REST_Request`, `sanitize_*()`, or `wp_unslash()` + sanitize
- Never use `extract()` — it creates variables from untrusted data
- Never use code evaluation functions or `preg_replace()` with the `e` modifier
- Never output unsanitized data in `wp_die()`, error messages, or admin notices
- `update_option()` auto-serializes — don't `json_encode()` before storing unless you need JSON specifically
- File uploads: validate MIME type with `wp_check_filetype()`, use `wp_handle_upload()` — never move files manually

## Testing Strategy

**Test Locations:**
- PHP Unit: `tests/unit/`
- PHP Feature: `tests/feature/`
- JS Unit: `src/**/test/*.spec.js`
- E2E: `tests-e2e/**/*.spec.{js,ts}`

**Testing Environment:**
- PHP tests run in wp-env WordPress CLI environment
- Requires WordPress test suite
- E2E tests require wp-env running (ports 3333/4333)

**Test Configuration:**
- PHPUnit: `phpunit.xml.dist`
- Jest: `jest.config.unit.js`
- E2E (Jest): `jest.config.e2e.js`
- Playwright: `playwright.config.js` (if exists)

## Key Files Reference

| Path | Purpose |
|------|---------|
| `presto-player.php` | Main plugin file (entry point) |
| `inc/Controller.php` | Component registration controller |
| `inc/Factory.php` | DI container factory and rules |
| `inc/config/app.php` | Component configuration array |
| `inc/Core.php` | Singleton core instance holder |
| `inc/Services/Scripts.php` | Script/style enqueueing |
| `inc/Services/Settings.php` | Global settings management |
| `inc/Services/Shortcodes.php` | Shortcode implementation |
| `inc/Models/` | Database models |
| `inc/Database/` | Table schemas and migrations |
| `package.json` | Root workspace config |
| `@presto-player/presto-player/package.json` | Workspace package config |
| `composer.json` | PHP dependencies and autoload |

## Verification

After making any changes, always verify with Playwright browser testing (via MCP tools) before considering work complete. Build compiling alone does not guarantee correctness. Navigate to the relevant page and confirm changes render, function, and behave correctly — this applies to UI components, PHP backend changes, REST API responses, settings, and any other modification that affects the user-facing experience.

## Important Notes

### WordPress Environment (.wp-env.json)
- Development: `http://localhost:3333`
- Test environment: `http://localhost:4333`
- Loads both presto-player (free) and presto-player-pro plugins

### Vendor Dependencies
- **DICE**: Dependency injection container
- **Imposter**: Namespace isolation for dependencies (critical for avoiding conflicts)
- Always run `composer install` after pulling changes

### Translation Workflow
- Strings use WordPress i18n: `__()`, `_e()`, `esc_html__()` etc.
- Text domain: `presto-player`
- POT file: `languages/presto-player.pot`
- Generated from `src/`, `inc/`, and `templates/`

### Pro Version Integration
- Pro plugin adds components via `presto_player_pro_components` filter
- Pro check: `Plugin::isPro()` method
- Settings constructor accepts `$isPro` parameter
- Pro features conditionally registered based on pro plugin activation

### Workspace Structure
- Yarn workspaces used (Yarn 3+)
- Workspace packages in `@presto-player/presto-player/packages/*`
- Bootstrap command builds workspace dependencies
- Workspace commands run across all packages

### Release Process
```bash
yarn plugin:release
```
This command:
1. Installs all dependencies
2. Generates translation files
3. Reinstalls composer without dev dependencies
4. Builds all workspace packages
5. Creates plugin zip
6. Extracts zip for distribution
