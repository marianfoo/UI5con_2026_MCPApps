import path from 'node:path';

import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One config for every sample. The build scripts set SAMPLE=<package-folder>,
// e.g. `SAMPLE=00-html-time vite build`. Each sample's app/ bundles to a single
// self-contained app/dist/index.html, which is what the ui:// resource returns.
const sample = process.env.SAMPLE;
if (!sample) {
  throw new Error('Set SAMPLE=<package-folder>, e.g. SAMPLE=00-html-time vite build');
}

export default defineConfig({
  root: path.resolve('packages', sample, 'app'),
  plugins: [viteSingleFile()],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
