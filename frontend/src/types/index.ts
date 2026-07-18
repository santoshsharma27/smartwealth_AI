/**
 * SmartWealth AI - TypeScript Type Definitions
 *
 * Core data models used across the frontend application.
 */

/** Expense categories used for transaction classification */
export type ExpenseCategory =
  | 'Rent'
  | 'Food'
  | 'Travel'
  | 'Shopping'
  | 'Bills'
  | 'EMI'
  | 'Healthcare'
  | 'Entertainment'
  | 'Investments'
  | 'Savings'
  | 'Education'
  | 'Miscellaneous';

/** Goal type presets and custom option */
export type GoalType =
  | 'buy_car'
  | 'buy_house'
  | 'vacation'
  | 'emergency_fund'
  | 'education'
  | 'retirement'
  | 'custom';

/** User session representing a single visitor's context */
export interface Session {
  id: string;
  isDemoActive: boolean;
}

/** Monthly financial summary derived from uploaded/demo data */
export interface FinancialSummary {
  monthlyIncome: number;
  totalExpenses: number;
  monthlySavings: number;
  savingsPercentage: number;
  expensesByCategory: Record<ExpenseCategory, number>;
}

/** A single scored component of the Financial Health Score */
export interface ScoreComponent {
  score: number;
  maxScore: number;
  value: number;
}

/** Financial Health Score (0-100) with component breakdown */
export interface HealthScore {
  totalScore: number;
  statusLabel: 'Needs Attention' | 'Fair' | 'Good' | 'Very Good' | 'Excellent';
  components: {
    savingsRatio: ScoreComponent;
    expenseControl: ScoreComponent;
    emiBurden: ScoreComponent;
    investmentAllocation: ScoreComponent;
    emergencyFundReadiness: ScoreComponent;
  };
}

/** A financial goal with feasibility assessment */
export interface Goal {
  id: string;
  goalName: string;
  goalType: GoalType;
  targetAmount: number;
  durationMonths: number;
  existingSavings: number;
  expectedReturnPercent: number;
  requiredMonthlySavings: number;
  feasibilityStatus:
    | 'Achievable'
    | 'Challenging'
    | 'Not Feasible'
    | 'Unable to assess'
    | 'Already Met';
}

/** A single chatbot conversation exchange */
export interface ChatMessage {
  id: string;
  question: string;
  answer: string;
  timestamp: string;
}

/** AI-generated financial recommendation */
export interface Recommendation {
  id: string;
  category: string;
  text: string;
  dataPointReference: string;
}

/** A single bank statement transaction */
export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  category?: ExpenseCategory;
  confidence?: number;
}

/** A detected recurring expense pattern */
export interface RecurringExpense {
  id: string;
  description: string;
  recurringAmount: number;
  consecutiveMonths: number;
}

/** A flagged unusual spending transaction */
export interface SpendingAnomaly {
  id: string;
  description: string;
  transactionAmount: number;
  category: ExpenseCategory;
  categoryAverage: number;
}
