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
  /**
   * Comma-separated list of node origins `app-url` / `auth-url` may point at,
   * in addition to loopback and the auth frontend's own origin. Only needed
   * when this UI is hosted separately from the nodes it logs into. The login
   * password and admin tokens are sent there, so keep it tight. See nodeUrl.ts.
   */
  readonly VITE_ALLOWED_NODE_ORIGINS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

