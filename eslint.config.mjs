import { config } from '@n8n/node-cli/eslint';

// Tests are not shipped (package.json "files" is only "dist"), and they use
// Node's built-in test runner (node:test, node:assert), which the cloud
// compatibility rules below reject for shipped node code.
export default [...config, { ignores: ['test/**'] }];
