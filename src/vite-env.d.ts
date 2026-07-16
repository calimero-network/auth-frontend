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
  /**
   * Comma-separated list of trusted origins the SSO `callback-url` may point at,
   * in addition to loopback and the auth frontend's own origin. Set this to the
   * origins of apps served from a different host than the node
   * (e.g. "https://app.example.com,https://chat.example.com"). See callbackUrl.ts.
   */
  readonly VITE_ALLOWED_CALLBACK_ORIGINS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

