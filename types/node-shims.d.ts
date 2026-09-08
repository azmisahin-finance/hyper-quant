declare module 'node:assert/strict' {
  const assert: any;
  export = assert;
}
declare module 'node:test' {
  const test: any;
  export default test;
}
declare module 'node:fs/promises' {
  export const mkdir: any;
  export const readFile: any;
  export const rm: any;
  export const mkdtemp: any;
  export const open: any;
}
declare module 'node:path' {
  export const dirname: any;
  export const join: any;
}
declare module 'node:crypto' {
  export const createHash: any;
}
declare module 'node:os' {
  export const tmpdir: any;
}
