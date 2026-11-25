import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

function chromeExtensionPlugin() {
  return {
    name: 'chrome-extension-plugin',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');
      if (!existsSync(distDir)) {
        mkdirSync(distDir, { recursive: true });
      }

      // Read manifest from src/manifest.json
      const manifestPath = resolve(__dirname, 'src/manifest.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

      // Ensure dist manifest paths match Vite dist output structure
      manifest.background = {
        service_worker: 'background.js',
        type: 'module'
      };
      manifest.devtools_page = 'src/devtools/devtools.html';
      manifest.action = {
        default_title: 'Playwright Locator Generator Settings',
        default_popup: 'src/settings.html'
      };
      manifest.content_scripts = [
        {
          matches: ['<all_urls>'],
          js: ['content/pick.js'],
          run_at: 'document_end',
          all_frames: true
        }
      ];

      writeFileSync(resolve(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
      console.log('✓ Generated dist/manifest.json');
    }
  };
}

export default defineConfig({
  plugins: [chromeExtensionPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        'content/pick': resolve(__dirname, 'src/content/pick.ts'),
        'src/devtools/devtools': resolve(__dirname, 'src/devtools/devtools.html'),
        'src/devtools/panel': resolve(__dirname, 'src/devtools/panel.html'),
        'src/settings': resolve(__dirname, 'src/settings.html'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background.js';
          if (chunkInfo.name === 'content/pick') return 'content/pick.js';
          return '[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
