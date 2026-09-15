/**
 * The error card must not send people to fix the wrong thing.
 *
 * ⚠️ WHY THIS EXISTS. The footer read "If the problem persists, check that
 * your node is running and reachable" on EVERY error, including the
 * `HTTP 400 Bad Request` the install screen answered with because the client
 * was sending a field core had deleted. The node was up the whole time, so the
 * advice cost the reader a node restart and hid the only sentence that said
 * what was actually wrong.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ErrorView } from '../ErrorView';

const REACHABILITY = /check that your node is running and reachable/i;

describe('ErrorView', () => {
  it('shows the node\'s own message verbatim', () => {
    const message =
      'HTTP 400: Invalid JSON data: Failed to deserialize the JSON body into the target type: url: unknown field `url`, expected `package` or `version`';
    render(<ErrorView message={message} />);

    expect(screen.getByText(message)).toBeTruthy();
  });

  it('does NOT blame connectivity for a request the node refused', () => {
    render(<ErrorView message="HTTP 400: unknown field `url`" />);

    expect(screen.queryByText(REACHABILITY)).toBeNull();
    expect(screen.getByText(/answered and refused this request/i)).toBeTruthy();
  });

  it('still blames connectivity when nothing answered', () => {
    render(<ErrorView message="Failed to fetch" />);

    expect(screen.getByText(REACHABILITY)).toBeTruthy();
  });

  it('blames connectivity for a 5xx, which can be something in front of the node', () => {
    render(<ErrorView message="HTTP 502 Bad Gateway" />);

    expect(screen.getByText(REACHABILITY)).toBeTruthy();
  });

  it('lets a caller override the footer, or drop it entirely', () => {
    const { unmount } = render(
      <ErrorView message="HTTP 401 Unauthorized" hint="Sign in again." />,
    );
    expect(screen.getByText('Sign in again.')).toBeTruthy();
    unmount();

    render(<ErrorView message="HTTP 401 Unauthorized" hint={null} />);
    expect(screen.queryByText(REACHABILITY)).toBeNull();
    expect(screen.queryByText(/answered and refused/i)).toBeNull();
  });
});
