import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import Button from './Button';

describe('Button', () => {
  it('uses a black focus outline for primary buttons by default', () => {
    render(<Button type="button" text="Primary" />);

    expect(screen.getByRole('button', { name: 'Primary' })).toHaveAttribute(
      'data-focus-outline',
      'black',
    );
  });

  it('uses a white focus outline for secondary buttons by default', () => {
    render(<Button type="button" text="Secondary" variant="secondary" />);

    expect(screen.getByRole('button', { name: 'Secondary' })).toHaveAttribute(
      'data-focus-outline',
      'white',
    );
  });

  it('allows overriding the focus outline color', () => {
    render(
      <Button
        type="button"
        text="Override"
        variant="secondary"
        focusOutline="black"
      />,
    );

    expect(screen.getByRole('button', { name: 'Override' })).toHaveAttribute(
      'data-focus-outline',
      'black',
    );
  });
});
