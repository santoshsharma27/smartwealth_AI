import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AlertCard } from './AlertCard';

describe('AlertCard', () => {
  describe('recurring expense type', () => {
    it('renders recurring expense with description and amount', () => {
      render(
        <AlertCard
          type="recurring"
          description="Netflix Subscription"
          recurringAmount={649}
          consecutiveMonths={4}
        />
      );

      expect(screen.getByText('Netflix Subscription')).toBeInTheDocument();
      expect(screen.getByText(/₹649/)).toBeInTheDocument();
      expect(screen.getByText(/4 consecutive months/)).toBeInTheDocument();
    });

    it('formats large recurring amounts with Indian grouping', () => {
      render(
        <AlertCard
          type="recurring"
          description="EMI Payment"
          recurringAmount={25000}
          consecutiveMonths={6}
        />
      );

      expect(screen.getByText('EMI Payment')).toBeInTheDocument();
      expect(screen.getByText(/₹25,000/)).toBeInTheDocument();
    });
  });

  describe('anomaly type', () => {
    it('renders anomaly with description, amount, and category average', () => {
      render(
        <AlertCard
          type="anomaly"
          description="Electronics Store Purchase"
          transactionAmount={45000}
          category="Shopping"
          categoryAverage={8000}
        />
      );

      expect(screen.getByText('Electronics Store Purchase')).toBeInTheDocument();
      expect(screen.getByText(/₹45,000/)).toBeInTheDocument();
      expect(screen.getByText(/Shopping/)).toBeInTheDocument();
      expect(screen.getByText(/₹8,000/)).toBeInTheDocument();
    });
  });
});
