# Force UI Setup for Presto Player

This document explains how Force UI has been integrated into the Presto Player project.

## Installation Summary

Force UI has been successfully installed and configured in your Presto Player project. Here's what was done:

### 1. Package Installation

- Added `@bsf/force-ui` dependency to `package.json`
- Installed the package using yarn: `yarn install`

### 2. Tailwind Configuration

- Updated `tailwind.config.js` to use the `withTW()` wrapper from Force UI
- Added all Force UI theme colors and design tokens
- Maintained existing Presto Player custom colors

### 3. Demo Component

- Created `src/components/ForceUIDemo.js` showcasing various Force UI components

## Usage

### Importing Components

```jsx
import { Button, Input, Card, Badge, Alert, Toggle } from "@bsf/force-ui";
```

### Basic Usage Examples

```jsx
// Buttons
<Button variant="primary">Primary Button</Button>
<Button variant="secondary">Secondary Button</Button>
<Button variant="tertiary">Tertiary Button</Button>
<Button variant="danger">Danger Button</Button>

// Input Fields
<Input
  label="My Input"
  placeholder="Enter text..."
  value={value}
  onChange={handleChange}
/>

// Cards
<Card>
  <h2>Card Title</h2>
  <p>Card content goes here</p>
</Card>

// Badges
<Badge variant="green">Success</Badge>
<Badge variant="red">Error</Badge>
<Badge variant="yellow">Warning</Badge>

// Alerts
<Alert variant="neutral">Neutral message</Alert>
<Alert variant="danger">Error message</Alert>
<Alert variant="warning">Warning message</Alert>
<Alert variant="green">Success message</Alert>

// Toggle
<Toggle
  checked={isEnabled}
  onChange={setIsEnabled}
  label="Enable feature"
/>
```

## Available Components

Force UI provides a comprehensive set of components:

- **Buttons**: Primary, secondary, tertiary, danger variants
- **Inputs**: Text, email, password, with labels and validation
- **Cards**: Content containers with consistent styling
- **Badges**: Status indicators in various colors
- **Alerts**: Notification messages with different variants
- **Toggles**: Switch controls
- **Modals**: Dialog boxes
- **Tabs**: Tabbed interfaces
- **Tooltips**: Hover information
- **Progress**: Loading indicators
- **Tables**: Data display
- **Forms**: Complete form components

## Theme Customization

The Force UI theme has been integrated with your existing Tailwind configuration. You can customize colors by modifying the `colors` section in `tailwind.config.js`.

### Key Color Variables

- `brand-*`: Brand colors
- `background-*`: Background colors
- `text-*`: Text colors
- `border-*`: Border colors
- `button-*`: Button colors
- `field-*`: Form field colors

## Documentation

For complete documentation and component examples, visit:

- [Force UI Wiki](https://github.com/brainstormforce/force-ui/wiki)
- [GitHub Repository](https://github.com/brainstormforce/force-ui)

## Testing

To test the Force UI integration:

1. Build the project: `yarn build:workspace`
2. Import and use the `ForceUIDemo` component in your React components
3. Verify that all components render correctly with proper styling

## Troubleshooting

If you encounter issues:

1. **Build errors**: Run `yarn install` to ensure all dependencies are installed
2. **Styling issues**: Check that Tailwind CSS is properly configured
3. **Component not found**: Verify the import path is correct
4. **Theme not applied**: Ensure `withTW()` wrapper is used in `tailwind.config.js`

## Next Steps

1. Start using Force UI components in your existing Presto Player components
2. Customize the theme colors to match your brand
3. Explore additional Force UI components as needed
4. Consider creating reusable component wrappers for common patterns
