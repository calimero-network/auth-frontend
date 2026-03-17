/// <reference types="vite/client" />

declare module '*.svg' {
  const src: string;
  export default src;
}
declare module '*.svg?url' {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  readonly VITE_REGISTRY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

