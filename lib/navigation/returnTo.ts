export function getSafeReturnToPath(value: string | null | undefined) {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!normalized.startsWith('/') || normalized.startsWith('//')) return null;
  return normalized;
}

export function buildHrefWithReturnTo(targetPath: string, returnTo?: string | null) {
  const safeReturnTo = getSafeReturnToPath(returnTo);
  if (!safeReturnTo) return targetPath;

  const [pathWithQuery, hashFragment = ''] = String(targetPath || '').split('#');
  const [pathname, existingQuery = ''] = pathWithQuery.split('?');
  const params = new URLSearchParams(existingQuery);
  params.set('returnTo', safeReturnTo);

  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ''}${hashFragment ? `#${hashFragment}` : ''}`;
}
