/**
 * Reusable card displaying a financial metric label and formatted value.
 * Uses ₹ Indian Rupee formatting with comma-separated grouping (lakhs/crores).
 * Validates: Requirement 5.1
 */

export interface SummaryCardProps {
  label: string;
  value: number;
  /** If true, format as percentage (e.g., "35%") instead of currency */
  isPercentage?: boolean;
  /** Color variant for the value text */
  variant?: 'default' | 'income' | 'expense' | 'savings';
}

const variantClasses: Record<string, string> = {
  default: 'text-neutral-900',
  income: 'text-blue-700',
  expense: 'text-red-600',
  savings: 'text-green-600',
};

/**
 * Format a number as Indian Rupees (₹) with proper comma grouping.
 * Example: 120000 → ₹1,20,000
 */
export function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function SummaryCard({ label, value, isPercentage = false, variant = 'default' }: SummaryCardProps) {
  const displayValue = isPercentage ? `${Math.round(value)}%` : formatINR(value);

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-sm">
      <p className="text-sm font-medium text-neutral-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${variantClasses[variant]}`} aria-label={`${label}: ${displayValue}`}>
        {displayValue}
      </p>
    </div>
  );
}
