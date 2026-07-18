/**
 * Expense category breakdown chart using Recharts PieChart (donut style).
 * Includes a visually hidden accessible data table for screen readers.
 * Validates: Requirements 5.2, 12.4
 */
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { ExpenseCategory } from '../types';
import { formatINR } from './SummaryCard';

export interface CategoryChartProps {
  expensesByCategory: Partial<Record<ExpenseCategory, number>>;
}

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Rent: '#6366f1',
  Food: '#f59e0b',
  Travel: '#06b6d4',
  Shopping: '#ec4899',
  Bills: '#8b5cf6',
  EMI: '#ef4444',
  Healthcare: '#10b981',
  Entertainment: '#f97316',
  Investments: '#14b8a6',
  Savings: '#22c55e',
  Education: '#3b82f6',
  Miscellaneous: '#6b7280',
};

interface ChartDataItem {
  name: string;
  value: number;
  percentage: number;
}

function computeChartData(expensesByCategory: Partial<Record<ExpenseCategory, number>>): ChartDataItem[] {
  if (!expensesByCategory) return [];
  const entries = Object.entries(expensesByCategory).filter(
    ([, amount]) => amount !== undefined && amount > 0
  ) as [ExpenseCategory, number][];

  const total = entries.reduce((sum, [, amount]) => sum + amount, 0);
  if (total === 0) return [];

  // Compute raw percentages rounded to 1 decimal
  const data = entries.map(([category, amount]) => ({
    name: category,
    value: amount,
    percentage: Math.round((amount / total) * 1000) / 10,
  }));

  // Adjust to ensure percentages sum to 100%
  const sumPct = data.reduce((s, d) => s + d.percentage, 0);
  const diff = Math.round((100 - sumPct) * 10) / 10;
  if (data.length > 0 && diff !== 0) {
    // Apply adjustment to the largest item
    const largestIdx = data.reduce((maxIdx, item, idx, arr) =>
      item.value > arr[maxIdx].value ? idx : maxIdx, 0);
    data[largestIdx].percentage = Math.round((data[largestIdx].percentage + diff) * 10) / 10;
  }

  return data;
}

export function CategoryChart({ expensesByCategory }: CategoryChartProps) {
  const data = computeChartData(expensesByCategory);

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-neutral-800 mb-4">Expense Breakdown</h3>
        <p className="text-neutral-500 text-sm">No expense data available.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-neutral-800 mb-4">Expense Breakdown</h3>
      <div className="w-full h-64 md:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="40%"
              outerRadius="70%"
              dataKey="value"
              nameKey="name"
              label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(1)}%`}
              labelLine={false}
              aria-label="Expense category pie chart"
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={CATEGORY_COLORS[entry.name as ExpenseCategory] || '#6b7280'}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatINR(Number(value))}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Accessible data table for screen readers */}
      <table className="sr-only" aria-label="Expense breakdown data table">
        <caption>Expense category breakdown with amounts and percentages</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Amount</th>
            <th scope="col">Percentage</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.name}>
              <td>{item.name}</td>
              <td>{formatINR(item.value)}</td>
              <td>{item.percentage}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
