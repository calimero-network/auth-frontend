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

const APP_PERMISSIONS = new Set([
  'context:create',
  // mero-react's MultiContext grant (#82): an app that may create contexts may
  // delete them. Without it DELETE /admin-api/contexts/:id answers 403.
  'context:delete',
  'context:list',
  'context:list-own',
  'context:execute',
  'context:subscribe',
  'application:list',
]);

const APP_PERMISSION_FAMILIES = ['blob', 'namespace', 'group', 'context:alias'];

const isAppPermission = (permission: string): boolean => {
  const trimmed = permission.trim();
  const bracket = trimmed.indexOf('[');
  const main = bracket === -1 ? trimmed : trimmed.slice(0, bracket);
  if (APP_PERMISSIONS.has(main)) {
    return true;
  }
  return APP_PERMISSION_FAMILIES.some((family) => main === family || main.startsWith(`${family}:`));
};

/**
 * First-party apps that run the node for you, as the admin dashboard does,
 * and so sign in with full access: package → the origins it is trusted at.
 * Both must match: the package names the app, and the callback, which is
 * where the tokens go, must be its own frontend. Calimero Desktop trusts the
 * same list (tauri-app `TRUSTED_APPS`). Fixed here and never read from a
 * manifest or the request: an app cannot ask its way in.
 */
export const TRUSTED_APPS: Readonly<Record<string, readonly string[]>> = {
  // hyperfeed.me is Hyperfeed's own domain; the vercel.app origin stays until
  // every node runs a Hyperfeed bundle that names hyperfeed.me.
  'com.calimero.hyperfeed': ['https://hyperfeed.me', 'https://www.hyperfeed.me', 'https://hyperfeed-two.vercel.app'],
};

/** Whether `packageName`, calling back to `callbackUrl`, is a trusted first-party app. */
export const isTrustedApp = (packageName: string | undefined, callbackUrl: string | null | undefined): boolean => {
  const origins = packageName ? TRUSTED_APPS[packageName] : undefined;
  if (!origins || !callbackUrl) return false;
  try {
    return origins.includes(new URL(callbackUrl).origin);
  } catch {
    return false;
  }
};

/**
 * What a package sign-in grants. An app gets what it asked for within the app
 * set; a trusted app signing in without a context gets full access instead,
 * shown as such on the consent screen. A context-bound key cannot hold
 * `admin` (core refuses it), so single-context keeps the app set.
 */
export const permissionsForPackage = (
  mode: AppMode,
  requested: string[],
  packageName: string | undefined,
  callbackUrl: string | null | undefined,
): string[] => {
  if (mode !== 'single-context' && isTrustedApp(packageName, callbackUrl)) return ['admin'];
  return restrictToAppPermissions(normalizePermissions(mode, requested));
};

export const restrictToAppPermissions = (permissions: string[]): string[] => {
  const dropped = permissions.filter((p) => !isAppPermission(p));
  if (dropped.length > 0) {
    console.warn('Dropping permissions an app flow may not request:', dropped);
  }
  return permissions.filter(isAppPermission);
};
