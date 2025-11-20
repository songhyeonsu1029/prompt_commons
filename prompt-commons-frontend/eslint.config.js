import globals from 'globals';
import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettierConfig from 'eslint-config-prettier';

export default [
  // Global ignores
  {
    ignores: ['dist/**', '.DS_Store', 'node_modules/'],
  },
  
  // Base JS config
  js.configs.recommended,

  // React-specific config
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // From eslint-plugin-react
      ...react.configs.recommended.rules,
      // From eslint-plugin-react-hooks
      ...reactHooks.configs.recommended.rules,
      // From eslint-plugin-jsx-a11y
      ...jsxA11y.configs.recommended.rules,
      
      // Rule Overrides from README
      'no-unused-vars': 'warn',
      'react/prop-types': 'off', // As requested
      'react/react-in-jsx-scope': 'off', // Not needed with modern React/Vite
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  // Prettier config - must be last
  prettierConfig,
];