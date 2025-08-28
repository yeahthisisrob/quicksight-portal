import path from 'path';

import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  "stories": [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  "addons": [
    "@storybook/addon-docs",
    "@storybook/addon-themes"
  ],
  "framework": {
    "name": "@storybook/react-vite",
    "options": {}
  },
  async viteFinal(config) {
    // Ensure config.resolve.alias exists
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    
    // Add our mock as the first alias to take precedence
    if (Array.isArray(config.resolve.alias)) {
      config.resolve.alias.unshift({
        find: '@/app/providers',
        replacement: path.resolve(__dirname, './mocks/providers.tsx'),
      });
    } else {
      // If alias is an object, override the specific path
      config.resolve.alias = {
        '@/app/providers': path.resolve(__dirname, './mocks/providers.tsx'),
        ...config.resolve.alias,
      };
    }
    
    return config;
  },
};
export default config;