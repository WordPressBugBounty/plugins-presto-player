# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Presto Player is a WordPress video player plugin (v4.1.0) that provides video capabilities for WordPress websites with support for multiple sources (YouTube, Vimeo, self-hosted HTML5, HLS streams, Bunny.net). It features a modern architecture combining PHP backend with React frontend, built specifically for WordPress Block Editor (Gutenberg) with extensive LMS and page builder integrations.

**Requirements:** PHP 7.3+, WordPress 5.6+

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
