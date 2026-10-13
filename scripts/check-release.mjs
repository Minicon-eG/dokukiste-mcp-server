import { readFile } from 'node:fs/promises';
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
const product = JSON.parse(await readFile(new URL('../api/product.json', import.meta.url)));
if (process.env.RELEASE_TAG !== 'v' + pkg.version || product.version !== pkg.version) throw new Error('Release tag and product/package versions must agree');
