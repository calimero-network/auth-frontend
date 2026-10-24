import React, { useEffect, useState } from 'react';
import { tokens } from '@calimero-network/mero-tokens';
import { resolveTrustedCallbackUrl } from '../../utils/callbackUrl';
import { getStoredUrlParam } from '../../utils/urlParams';

type Origin = { state: 'pending' } | { state: 'none' } | { state: 'ok'; origin: string };

// Uses the resolver the token handoff uses, so the origin shown is the one
// the token goes to; an unresolved callback is reported, not hidden.
export function CallbackOrigin() {
  const [result, setResult] = useState<Origin>({ state: 'pending' });

  useEffect(() => {
    let live = true;
    resolveTrustedCallbackUrl(getStoredUrlParam('callback-url')).then((url) => {
      if (live) setResult(url ? { state: 'ok', origin: url.origin } : { state: 'none' });
    });
    return () => {
      live = false;
    };
  }, []);

  const ok = result.state === 'ok';
  const color = ok ? tokens.color.brand['600'].value : tokens.color.semantic.warning.value;

  return (
    <div
      data-testid="callback-origin"
      style={{
        padding: '12px 14px',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${color}`,
        background: `${color}14`,
        color: 'var(--color-text-primary)',
        fontSize: '14px',
        overflowWrap: 'anywhere',
      }}
    >
      {result.state === 'pending' && 'Checking where the access token will be sent...'}
      {result.state === 'none' &&
        'No valid callback destination: no token will be sent (the callback URL is missing or not allowed).'}
      {result.state === 'ok' && (
        <>
          Access token will be sent to:{' '}
          <strong style={{ fontFamily: 'monospace' }}>{result.origin}</strong>
        </>
      )}
    </div>
  );
}
