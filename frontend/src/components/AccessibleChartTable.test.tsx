import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AccessibleChartTable } from './AccessibleChartTable';

describe('AccessibleChartTable', () => {
  const columns = [
    { header: 'Category', accessor: 'name' },
    { header: 'Amount', accessor: 'amount' },
    { header: 'Percentage', accessor: (row: Record<string, unknown>) => `${row.pct}%` },
  ];

  const data = [
    { name: 'Food', amount: '₹18,500', pct: 23.7 },
    { name: 'Rent', amount: '₹25,000', pct: 32.1 },
    { name: 'Bills', amount: '₹6,000', pct: 7.7 },
  ];

  it('renders a table with the provided caption', () => {
    render(
      <AccessibleChartTable
        caption="Expense breakdown"
        columns={columns}
        data={data}
      />
    );
    expect(screen.getByRole('table', { name: /expense breakdown/i })).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(
      <AccessibleChartTable
        caption="Expense breakdown"
        columns={columns}
        data={data}
      />
    );
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Percentage')).toBeInTheDocument();
  });

  it('renders data rows with string accessor', () => {
    render(
      <AccessibleChartTable
        caption="Expense breakdown"
        columns={columns}
        data={data}
      />
    );
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('Rent')).toBeInTheDocument();
    expect(screen.getByText('₹25,000')).toBeInTheDocument();
  });

  it('renders data rows with function accessor', () => {
    render(
      <AccessibleChartTable
        caption="Expense breakdown"
        columns={columns}
        data={data}
      />
    );
    expect(screen.getByText('23.7%')).toBeInTheDocument();
    expect(screen.getByText('32.1%')).toBeInTheDocument();
  });

  it('returns null when data is empty', () => {
    const { container } = render(
      <AccessibleChartTable
        caption="Empty chart"
        columns={columns}
        data={[]}
      />
    );
    expect(container.querySelector('table')).toBeNull();
  });

  it('has sr-only class for visual hiding', () => {
    const { container } = render(
      <AccessibleChartTable
        caption="Expense breakdown"
        columns={columns}
        data={data}
      />
    );
    const table = container.querySelector('table');
    expect(table?.className).toContain('sr-only');
  });

  it('uses custom ariaLabel when provided', () => {
    render(
      <AccessibleChartTable
        caption="Expense breakdown"
        columns={columns}
        data={data}
        ariaLabel="Custom accessible label"
      />
    );
    expect(screen.getByRole('table', { name: /custom accessible label/i })).toBeInTheDocument();
  });

  it('uses th elements with scope="col" for headers', () => {
    const { container } = render(
      <AccessibleChartTable
        caption="Expense breakdown"
        columns={columns}
        data={data}
      />
    );
    const thElements = container.querySelectorAll('th');
    thElements.forEach((th) => {
      expect(th.getAttribute('scope')).toBe('col');
    });
  });
});
