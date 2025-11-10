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


