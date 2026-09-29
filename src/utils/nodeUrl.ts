export const isLoopbackHost = (host: string): boolean => {
  const h = host.toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h === '[::1]' ||
    h.endsWith('.localhost')
  );
};

/**
 * May this page send its admin session to `raw`? Only the node that served it,
 * or a loopback node when the page itself is on loopback (dev, desktop, e2e).
 */
export function isAllowedNodeUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

  const page = new URL(window.location.origin);
  if (url.origin === page.origin) return true;
  return isLoopbackHost(page.hostname) && isLoopbackHost(url.hostname);
}
