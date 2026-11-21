
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const serverDir = dirname(fileURLToPath(import.meta.url));
const sharedDir = resolve(serverDir, '../shared');

await build({
  entryPoints: [resolve(serverDir, 'src/index.ts')],
  outfile: resolve(serverDir, 'dist/index.js'),

  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',

  packages: 'external',

  plugins: [
    {
      name: 'bundle-shared',
      setup(build) {
        build.onResolve(
          { filter: /^tank-arena-shared\/(.+)$/ },
          (args) => ({
            path: resolve(
              sharedDir,
              args.path.replace('tank-arena-shared/', '') + '.ts'
            ),
          })
        );
      },
    },
  ],

  logLevel: 'info',
});
