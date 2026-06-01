import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import ConfirmationModal from './index';

describe('ConfirmationModal', () => {
  it('renders and confirms the action', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmationModal
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        title="Usuń produkt"
        message="Tej operacji nie można cofnąć."
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Usuń produkt' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Tej operacji nie można cofnąć.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Potwierdź' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
