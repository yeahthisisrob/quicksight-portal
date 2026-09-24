/**
 * `import text from './file.md?raw'`: the file's contents as a string.
 * Vite and Vitest do this natively; esbuild does it through the raw-text
 * plugin in build.js. A `.ts` rather than a `.d.ts` on purpose: the
 * backend's .gitignore drops every `.d.ts`, so a declaration file never
 * reaches another checkout.
 */
declare module '*.md?raw' {
  const text: string;
  export default text;
}
