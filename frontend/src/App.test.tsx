import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App Router', () => {
  it('renders the landing page at root route with SmartWealth AI heading', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { level: 1, name: /SmartWealth AI/i })
    ).toBeInTheDocument();
  });

  it('renders the landing page tagline', () => {
    render(<App />);
    expect(
      screen.getByText(/AI-powered personal financial copilot/i)
    ).toBeInTheDocument();
  });
});
