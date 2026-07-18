-- SmartWealth AI - Initial Database Schema
-- Migration V001: Create all tables with constraints, indexes, and relationships

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Table: sessions
-- ============================================================
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_accessed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    is_demo_active BOOLEAN NOT NULL DEFAULT FALSE
);

-- ============================================================
-- Table: documents
-- ============================================================
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_format VARCHAR(10) NOT NULL CHECK (file_format IN ('pdf', 'csv')),
    document_type VARCHAR(20) NOT NULL CHECK (document_type IN ('salary_slip', 'bank_statement')),
    storage_path VARCHAR(512) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'processed', 'failed')),
    file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 15728640),
    uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP
);

-- ============================================================
-- Table: salary_data
-- ============================================================
CREATE TABLE salary_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    gross_salary NUMERIC(12, 2) NOT NULL,
    net_salary NUMERIC(12, 2) NOT NULL,
    employer_name VARCHAR(255),
    month_year VARCHAR(7),
    deductions JSONB DEFAULT '[]'
);

-- ============================================================
-- Table: transactions
-- ============================================================
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    description VARCHAR(500) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    type VARCHAR(6) NOT NULL CHECK (type IN ('credit', 'debit')),
    category VARCHAR(20) CHECK (category IN ('Rent', 'Food', 'Travel', 'Shopping', 'Bills', 'EMI', 'Healthcare', 'Entertainment', 'Investments', 'Savings', 'Education', 'Miscellaneous')),
    confidence NUMERIC(3, 2),
    categorization_method VARCHAR(10) CHECK (categorization_method IN ('rule_based', 'llm_based'))
);

-- ============================================================
-- Table: financial_summaries
-- ============================================================
CREATE TABLE financial_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    monthly_income NUMERIC(12, 2) NOT NULL,
    total_expenses NUMERIC(12, 2) NOT NULL,
    monthly_savings NUMERIC(12, 2) NOT NULL,
    savings_percentage NUMERIC(5, 2) NOT NULL,
    expenses_by_category JSONB NOT NULL DEFAULT '{}',
    calculated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (session_id)
);

-- ============================================================
-- Table: health_scores
-- ============================================================
CREATE TABLE health_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    total_score INTEGER NOT NULL CHECK (total_score >= 0 AND total_score <= 100),
    status_label VARCHAR(20) NOT NULL,
    savings_ratio_score INTEGER NOT NULL CHECK (savings_ratio_score >= 0 AND savings_ratio_score <= 30),
    expense_control_score INTEGER NOT NULL CHECK (expense_control_score >= 0 AND expense_control_score <= 25),
    emi_burden_score INTEGER NOT NULL CHECK (emi_burden_score >= 0 AND emi_burden_score <= 15),
    investment_allocation_score INTEGER NOT NULL CHECK (investment_allocation_score >= 0 AND investment_allocation_score <= 15),
    emergency_fund_score INTEGER NOT NULL CHECK (emergency_fund_score >= 0 AND emergency_fund_score <= 15),
    component_details JSONB NOT NULL DEFAULT '{}',
    calculated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (session_id)
);

-- ============================================================
-- Table: recommendations
-- ============================================================
CREATE TABLE recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL,
    category VARCHAR(50) NOT NULL,
    text TEXT NOT NULL,
    data_point_reference VARCHAR(255) NOT NULL,
    generated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Table: goals
-- ============================================================
CREATE TABLE goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    goal_name VARCHAR(100) NOT NULL,
    goal_type VARCHAR(30) NOT NULL,
    target_amount NUMERIC(12, 2) NOT NULL CHECK (target_amount >= 1 AND target_amount <= 999999999),
    duration_months INTEGER NOT NULL CHECK (duration_months >= 1 AND duration_months <= 360),
    existing_savings NUMERIC(12, 2) NOT NULL DEFAULT 0,
    expected_return_percent NUMERIC(5, 2) NOT NULL CHECK (expected_return_percent >= 0 AND expected_return_percent <= 30),
    required_monthly_savings NUMERIC(12, 2) NOT NULL,
    feasibility_status VARCHAR(20) NOT NULL CHECK (feasibility_status IN ('Achievable', 'Challenging', 'Not Feasible', 'Unable to assess', 'Already Met')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (existing_savings <= target_amount)
);

-- ============================================================
-- Table: chat_messages
-- ============================================================
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,
    question VARCHAR(500) NOT NULL,
    answer TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, sequence_number)
);

-- ============================================================
-- Table: recurring_expenses
-- ============================================================
CREATE TABLE recurring_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    description VARCHAR(500) NOT NULL,
    recurring_amount NUMERIC(12, 2) NOT NULL,
    consecutive_months INTEGER NOT NULL CHECK (consecutive_months >= 2),
    detected_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Table: spending_anomalies
-- ============================================================
CREATE TABLE spending_anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    description VARCHAR(500) NOT NULL,
    transaction_amount NUMERIC(12, 2) NOT NULL,
    category VARCHAR(20) NOT NULL,
    category_average NUMERIC(12, 2) NOT NULL,
    detected_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX idx_documents_session ON documents(session_id);
CREATE INDEX idx_transactions_session ON transactions(session_id);
CREATE INDEX idx_transactions_category ON transactions(session_id, category);
CREATE INDEX idx_transactions_date ON transactions(session_id, transaction_date);
CREATE INDEX idx_goals_session ON goals(session_id);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, sequence_number);
CREATE INDEX idx_recommendations_session ON recommendations(session_id, display_order);
