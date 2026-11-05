import {execSync} from 'node:child_process';
import esbuild from 'rollup-plugin-esbuild';

const generateDeclarations = () => ({
  name: 'generate-declarations',
  buildEnd: (err) => {
    if (err) return;
    execSync('tsc --project tsconfig.build.json --emitDeclarationOnly');
  }
});

export default {
  input: 'src/index.ts',
  external: (id) => !/^[./]/.test(id),
  plugins: [generateDeclarations(), esbuild({target: 'es2020'})],
  output: [
    // A `.js` file in a package without `"type": "module"` is not valid Node ESM, so Vitest
    // transforms it instead of handing it to Node. Its `@apollo/client` imports then resolve
    // exactly like the consumer's own: Apollo Client 3 has no `exports` map, and Vitest picks its
    // CJS main. As `.mjs`, Node would load it, fail on the `@apollo/client/react` directory import,
    // and any workaround path would load a second Apollo Client 3 instance.
    {file: 'dist/index.js', format: 'esm', sourcemap: true},
    {file: 'dist/index.cjs', format: 'cjs', sourcemap: true}
  ]
};
