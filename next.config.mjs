import { realpathSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
if (basePath && (!basePath.startsWith('/') || basePath.endsWith('/') || basePath.includes('..'))) {
  throw new Error('NEXT_PUBLIC_BASE_PATH must be a path such as /repository-name.');
}

const extraOutput = process.env.SITE_OUTPUT_DIR;
if (extraOutput && !/^\.local\/build-[a-z0-9-]+$/.test(extraOutput)) throw new Error('Use an isolated .local/build-name output.');
const generationFile = process.env.SITE_RENDER_GENERATION_FILE;
const configRoot = path.dirname(fileURLToPath(import.meta.url));
if (generationFile && !path.resolve(configRoot, generationFile).startsWith(path.join(configRoot, '.local') + path.sep)) throw new Error('Renderer generation must stay in .local.');
const rendererGeneration = generationFile ? JSON.parse(readFileSync(path.resolve(configRoot, generationFile), 'utf8')).rendererGeneration : null;
if (rendererGeneration && !/^[a-f0-9]{64}$/.test(rendererGeneration)) throw new Error('Invalid renderer generation.');

export default {
  output: 'export',
  distDir: extraOutput || '.next',
  ...(rendererGeneration ? { generateBuildId: async () => rendererGeneration } : {}),
  experimental: { cpus: 4, staticGenerationMaxConcurrency: 8 },
  turbopack: { root: realpathSync.native(path.dirname(fileURLToPath(import.meta.url))) },
  trailingSlash: true,
  // Resource slugs can contain dots (for example cdp-8.0-kraken/). Next's
  // file-extension heuristic otherwise removes their canonical trailing slash.
  skipTrailingSlashRedirect: true,
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  poweredByHeader: false,
  devIndicators: false,
  reactStrictMode: true,
};
