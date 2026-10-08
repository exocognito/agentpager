import type { StorybookConfig } from '@storybook/react-vite';
export default {
  stories:['../../blueprint/design/**/*.stories.tsx'],
  addons:['@storybook/addon-a11y','@storybook/addon-vitest'],
  framework:{name:'@storybook/react-vite',options:{}},
  core:{disableTelemetry:true},
} satisfies StorybookConfig;
