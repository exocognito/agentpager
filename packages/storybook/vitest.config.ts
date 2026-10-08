import { defineConfig } from 'vitest/config';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { fileURLToPath } from 'node:url';
const configDir=fileURLToPath(new URL('./.storybook',import.meta.url));
export default defineConfig({test:{projects:(['phone','desktop'] as const).map(viewport=>({
  plugins:[storybookTest({configDir,initialGlobals:{viewport:{value:viewport,isRotated:false}}})],
  test:{name:`stories:${viewport}`,testTimeout:15000,browser:{enabled:true,headless:true,provider:playwright(),instances:[{browser:'chromium' as const}]}},
}))}});
