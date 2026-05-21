# Tailwind CSS Setup for Presto Player

This document explains how to use Tailwind CSS in the Presto Player project.

## ✅ What's Been Configured

1. **Tailwind CSS v3.4.17** - Installed and configured with PostCSS
2. **Tailwind Plugins** - Added @tailwindcss/forms and @tailwindcss/typography
3. **Custom Configuration** - Created tailwind.config.js with project-specific settings
4. **Custom Components** - Added reusable component classes in src/styles/tailwind.css
5. **Webpack Integration** - Added tailwind.css to webpack entry points
6. **Build Process** - Successfully integrated with existing build system
7. **Development Workflow** - Integrated with yarn dev and workspace setup

## 🚀 Development Workflow

### Using `yarn dev` (Recommended)

The project uses a monorepo setup with workspaces. For development:

```bash
yarn dev
```

This command:

- Runs `composer install` to install PHP dependencies
- Runs `yarn start:workspace` which executes `yarn workspaces foreach -pvi run watch`
- Watches all packages including the main plugin and component packages
- Processes Tailwind CSS automatically during development

### Build Commands

- `yarn dev` - Development mode with hot reloading (watches all workspaces)
- `yarn build` - Production build with Tailwind CSS processing
- `yarn start` - Development mode for main plugin only
- `yarn build:workspace` - Build all workspace packages

## 📁 How to Use

### 1. Import Tailwind CSS

In your JavaScript/React files, import the Tailwind CSS:

```javascript
import "../styles/tailwind.css";
```

### 2. Use Tailwind Classes

You can now use Tailwind classes directly in your components:

```jsx
<div className="bg-white rounded-lg shadow-md p-6">
  <h2 className="text-2xl font-bold text-gray-900">Hello Tailwind!</h2>
  <p className="text-gray-600 mt-2">This is styled with Tailwind CSS.</p>
</div>
```

### 3. Use Custom Component Classes

We've created custom component classes for common UI patterns:

```jsx
// Button with custom styling
<button className="presto-button">Click me</button>

// Form input with consistent styling
<input className="presto-input" placeholder="Enter text..." />

// Card container
<div className="presto-card">
  <h3 className="text-lg font-semibold">Card Title</h3>
  <p>Card content goes here...</p>
</div>

// Form label
<label className="presto-label">Email Address</label>
```

## 🎨 Custom Components Available

### presto-button

- Styled button with hover and focus states
- Uses presto brand colors
- Includes proper accessibility features

### presto-input

- Consistent form input styling
- Focus states with brand colors
- Works with all input types

### presto-card

- Card container with shadow and border
- Consistent padding and spacing
- Clean, modern appearance

### presto-label

- Form label styling
- Proper spacing and typography
- Accessible text sizing

## 🔧 Configuration

### Tailwind Config (`tailwind.config.js`)

- Content paths configured for all project files
- Custom presto brand colors
- Forms and typography plugins enabled
- Optimized for performance

### PostCSS Config (`postcss.config.js`)

- Tailwind CSS processing
- Autoprefixer for browser compatibility
- CSS minification in production

### Webpack Integration

- Tailwind CSS included in build process
- Automatic processing during development
- Optimized for production builds

## 📦 Project Structure

```
presto-player/
├── src/
│   ├── styles/
│   │   └── tailwind.css          # Main Tailwind CSS file
│   └── components/
│       └── TailwindDemo.js       # Example component
├── packages/
│   ├── components/               # Stencil components
│   └── components-react/         # React components
├── tailwind.config.js           # Tailwind configuration
├── postcss.config.js            # PostCSS configuration
└── webpack.config.js            # Webpack with Tailwind entry
```

## 🚨 Important Notes

1. **Development Workflow**: Always use `yarn dev` for development as it properly handles the workspace setup
2. **Hot Reloading**: Changes to Tailwind classes will be reflected immediately during development
3. **Build Process**: Tailwind CSS is automatically processed during both development and production builds
4. **Workspace Integration**: Tailwind CSS works across all packages in the monorepo

## 🎯 Example Usage

See `src/components/TailwindDemo.js` for a complete example of how to use Tailwind CSS in your components.

## 🔍 Troubleshooting

If you encounter issues:

1. **Build Errors**: Run `yarn build` to check for configuration issues
2. **Missing Styles**: Ensure you've imported `../styles/tailwind.css` in your component
3. **Hot Reload Issues**: Restart `yarn dev` to refresh the development server
4. **Workspace Issues**: Run `yarn bootstrap` to ensure all packages are properly linked

The Tailwind CSS setup is now fully integrated with your development workflow and ready to use!
