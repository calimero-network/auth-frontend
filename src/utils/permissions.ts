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

export const restrictToAppPermissions = (permissions: string[]): string[] => {
  const dropped = permissions.filter((p) => !isAppPermission(p));
  if (dropped.length > 0) {
    console.warn('Dropping permissions an app flow may not request:', dropped);
  }
  return permissions.filter(isAppPermission);
};
