import path from 'node:path';

import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One config for every sample. The build scripts set SAMPLE with cross-env,
// e.g. `npm run build:sample:00`. Each sample's app/ bundles to a single
// self-contained app/dist/index.html, which is what the ui:// resource returns.
const sample = process.env.SAMPLE;
if (!sample) {
  throw new Error('Choose a sample with an npm build script, e.g. npm run build:sample:00');
}

export default defineConfig({
  root: path.resolve('packages', sample, 'app'),
  plugins: [viteSingleFile()],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
