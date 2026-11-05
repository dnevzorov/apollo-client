/**
 * Checks that the built package loads in plain Node and exposes the values consumers import from
 * it, with the installed Apollo Client major. Unit tests import from `src/` and cannot see a broken
 * re-export. Run after `pnpm build`.
 *
 * Node loads the ESM build only with Apollo Client 4: Apollo Client 3 has no `exports` map, so its
 * `@apollo/client/react` is a directory import, which Node ESM rejects. Bundlers and Vitest resolve
 * it (see rollup.config.mjs); `scripts/check-consumer.sh` covers that path.
 */
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {version} = require('@apollo/client/package.json');
const isApollo3 = version.startsWith('3.');
const builds = {
  cjs: [require('../dist/index.cjs'), require('@apollo/client/react')],
  ...(isApollo3
    ? {}
    : {esm: [await import('../dist/index.js'), await import('@apollo/client/react')]})
};
const problems = [];

const ownExports = ['useMutation', 'useSubscription', 'setOfflineConfig', 'updateApolloCache'];
// Values MONEI/dashboards imports from this package.
const apolloExports = [
  'ApolloProvider',
  'ApolloClient',
  'InMemoryCache',
  'ApolloLink',
  'makeVar',
  'useReactiveVar',
  'useApolloClient',
  'useQuery',
  'gql',
  'NetworkStatus',
  // Apollo Client 4 removed ApolloError.
  ...(isApollo3 ? ['ApolloError'] : [])
];

for (const [format, [entry, apolloReact]] of Object.entries(builds)) {
  for (const name of [...ownExports, ...apolloExports]) {
    if (entry[name] === undefined) problems.push(`${format}: does not export ${name}`);
  }
  if (entry.OperationTypes?.ADD !== 'add')
    problems.push(`${format}: does not export OperationTypes`);
  if (entry.useMutation === apolloReact.useMutation) {
    problems.push(`${format}: exports Apollo's useMutation instead of the wrapper`);
  }
  if (entry.ApolloProvider !== apolloReact.ApolloProvider) {
    problems.push(`${format}: ApolloProvider is not the one from @apollo/client/react`);
  }
}

if (problems.length > 0) {
  console.error(`@apollo/client ${version}:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`dist exports OK with @apollo/client ${version} (${Object.keys(builds).join(', ')})`);
