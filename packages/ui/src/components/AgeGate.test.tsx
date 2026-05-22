import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgeGate } from './AgeGate';

(globalThis as { React?: typeof React }).React = React;

// ParentGate brings in @radix-ui/react-dialog which renders to a portal; we
// stub it to a simple inline render so we can drive the math problem from
// the test surface without dealing with portal containers.
vi.mock('./ParentGate', () => ({
  ParentGate: ({
    open,
    onPass,
    onOpenChange,
  }: {
    open: boolean;
    onPass: () => void;
    onOpenChange: (b: boolean) => void;
  }) =>
    open ? (
      <div data-testid="parent-gate-stub">
        <button type="button" onClick={onPass}>
          pass
        </button>
        <button type="button" onClick={() => onOpenChange(false)}>
          dismiss
        </button>
      </div>
    ) : null,
}));

describe('AgeGate', () => {
  afterEach(() => cleanup());

  it('renders nothing when open=false', () => {
    const { container } = render(
      <AgeGate
        open={false}
        onOpenChange={() => {}}
        onAdult={() => {}}
        onParentVerified={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('calls onAdult when user picks "Yes"', () => {
    const onAdult = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <AgeGate
        open
        onOpenChange={onOpenChange}
        onAdult={onAdult}
        onParentVerified={() => {}}
      />,
    );
    fireEvent.click(screen.getByText(/Yes, I'm 13 or older/));
    expect(onAdult).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('switches to ParentGate stage when user picks "No" and calls onParentVerified on pass', () => {
    const onParentVerified = vi.fn();
    render(
      <AgeGate
        open
        onOpenChange={() => {}}
        onAdult={() => {}}
        onParentVerified={onParentVerified}
      />,
    );
    fireEvent.click(screen.getByText(/No, I'm under 13/));
    // Stubbed ParentGate is now mounted
    expect(screen.getByTestId('parent-gate-stub')).not.toBeNull();
    fireEvent.click(screen.getByText('pass'));
    expect(onParentVerified).toHaveBeenCalled();
  });

  it('shows guest link when onChildStaysAnonymous provided and invokes it', () => {
    const onGuest = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <AgeGate
        open
        onOpenChange={onOpenChange}
        onAdult={() => {}}
        onParentVerified={() => {}}
        onChildStaysAnonymous={onGuest}
      />,
    );
    fireEvent.click(screen.getByText(/Play as guest instead/));
    expect(onGuest).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
