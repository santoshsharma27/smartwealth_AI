import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DisclaimerBar } from './DisclaimerBar';

describe('DisclaimerBar', () => {
  it('renders the disclaimer text', () => {
    render(<DisclaimerBar />);
    expect(
      screen.getByText(
        /This guidance is educational and informational only\. It does not replace a certified financial advisor, tax consultant, or investment professional\./
      )
    ).toBeInTheDocument();
  });

  it('is not dismissible (no close button)', () => {
    render(<DisclaimerBar />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('has an accessible role=note', () => {
    render(<DisclaimerBar />);
    expect(screen.getByRole('note')).toBeInTheDocument();
  });

  it('has an accessible aria-label', () => {
    render(<DisclaimerBar />);
    expect(
      screen.getByLabelText('Financial disclaimer')
    ).toBeInTheDocument();
  });
});
