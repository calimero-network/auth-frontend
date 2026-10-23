import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('a login link that repeats a flow param', () => {
  afterEach(() => {
    (window.location as any).search = '';
    sessionStorage.clear();
  });

  it('is refused and stores nothing', () => {
    (window.location as any).search =
      '?permissions=context:list&permissions=admin&callback-url=http://a/';
    render(<App />);
    expect(screen.getByText(/repeats permissions/i)).toBeTruthy();
    expect(sessionStorage.getItem('permissions')).toBeNull();
  });
});
