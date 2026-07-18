-- SmartWealth AI - Demo Data Seed Script
-- Matches Requirement 10.3: ₹120,000 income, ₹78,000 expenses, 20+ transactions across 5+ categories

-- ============================================================
-- Demo Session
-- ============================================================
INSERT INTO sessions (id, created_at, last_accessed_at, is_demo_active)
VALUES (
    'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    '2024-01-15 09:00:00',
    '2024-01-15 09:00:00',
    TRUE
);

-- ============================================================
-- Demo Documents (salary slip + bank statement)
-- ============================================================
INSERT INTO documents (id, session_id, file_name, file_format, document_type, storage_path, status, file_size_bytes, uploaded_at, processed_at)
VALUES
    ('d1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'salary_jan_2024.pdf', 'pdf', 'salary_slip', '/demo/salary_jan_2024.pdf', 'processed', 245760, '2024-01-15 09:00:00', '2024-01-15 09:00:05'),
    ('d2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'bank_statement_jan_2024.pdf', 'pdf', 'bank_statement', '/demo/bank_statement_jan_2024.pdf', 'processed', 512000, '2024-01-15 09:00:00', '2024-01-15 09:00:08');

-- ============================================================
-- Demo Salary Data
-- ============================================================
INSERT INTO salary_data (id, document_id, session_id, gross_salary, net_salary, employer_name, month_year, deductions)
VALUES (
    's1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c',
    'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a',
    'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    150000.00,
    120000.00,
    'TechCorp India Pvt Ltd',
    '2024-01',
    '[{"label": "Provident Fund", "amount": 18000}, {"label": "Professional Tax", "amount": 200}, {"label": "Income Tax (TDS)", "amount": 11800}]'
);

-- ============================================================
-- Demo Transactions (25 transactions across 8 categories)
-- Monthly expenses total: ₹78,000
-- Categories: Rent, Food, Travel, Shopping, Bills, EMI, Healthcare, Entertainment
-- ============================================================
INSERT INTO transactions (id, document_id, session_id, transaction_date, description, amount, type, category, confidence, categorization_method)
VALUES
    -- Salary credit
    ('t0000001-0000-4000-a000-000000000001', 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '2024-01-01', 'SALARY CREDIT - TECHCORP INDIA', 120000.00, 'credit', NULL, NULL, NULL),

    -- Rent (₹25,000)
    ('t0000001-0000-4000-a000-000000000002', 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '2024-01-02', 'RENT TRANSFER TO LANDLORD', 25000.00, 'debit', 'Rent', 0.98, 'rule_based'),

    -- Food (₹18,500 across 6 transactions)
    ('t0000001-0000-4000-a000-000000000003', 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '2024-01-03', 'SWIGGY ORDER #12345', 850.00, 'debit', 'Food', 0.95, 'rule_based'),
    ('t0000001-0000-4000-a000-000000000004', 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '2024-01-06', 'ZOMATO FOOD DELIVERY', 650.00, 'debit', 'Food', 0.94, 'rule_based'),
    ('t0000001-0000-4000-a000-000000000005', 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '2024-01-10', 'BIGBASKET GROCERIES', 4500.00, 'debit', 'Food', 0.92, 'rule_based'),
    ('t0000001-0000-4000-a000-000000000006', 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '2024-01-14', 'SWIGGY ORDER #12890', 750.00, 'debit', 'Food', 0.95, 'rule_based'),
    ('t0000001-0000-4000-a000-000000000007', 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '2024-01-20', 'RESTAURANT DINNER - TAJ PALACE', 3250.00, 'debit', 'Food', 0.88, 'rule_based'),
    ('t0000001-0000-4000-a000-000000000008', 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '2024-01-25', 'BIGBASKET MONTHLY GROCERIES', 8500.00, 'debit', 'Food', 0.92, 'rule_based'),

    -- Travel (₹5,000 across 3 transactions)
    ('t0000001-0000-4000-a000-000000000009', 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '2024-01-05', 'OLA RIDE TO OFFICE', 450.00, 'debit', 'Travel', 0.90, 'rule_based'),
    ('t0000001-0000-4000-a000-000000000010', 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '2024-01-12', 'UBER CAB - AIRPORT', 1800.00, 'debit', 'Travel', 0.91, 'rule_based'),
    ('t0000001-0000-4000-a000-000000000011', 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '2024-01-18', 'METRO CARD RECHARGE', 2750.00, 'debit', 'Travel', 0.85, 'rule_based'),

    -- Shopping (₹8,000 across 2 transactions)
    ('t0000001-0000-4000-a000-000000000012', 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '2024-01-08', 'AMAZON PURCHASE - ELECTRONICS', 5500.00, 'debit', 'Shopping', 0.89, 'rule_based'),
    ('t0000001-0000-4000-a000-000000000013', 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '2024-01-22', 'FLIPKART ORDER - CLOTHING', 2500.00, 'debit', 'Shopping', 0.87, 'rule_based'),

    -- Bills (₹6,000 across 3 transactions)
    ('t0000001-0000-4000-a000-000000000014', 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '2024-01-04', 'AIRTEL POSTPAID BILL', 999.00, 'debit', 'Bills', 0.96, 'rule_based'),
    ('t0000001-0000-4000-a000-000000000015', 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '2024-01-07', 'ELECTRICITY BILL - TATA POWER', 2800.00, 'debit', 'Bills', 0.97, 'rule_based'),
    ('t0000001-0000-4000-a000-000000000016', 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '2024-01-15', 'NETFLIX SUBSCRIPTION', 649.00, 'debit', 'Bills', 0.93, 'rule_based'),
    ('t0000001-0000-4000-a000-000000000017', 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '2024-01-15', 'WATER BILL - MUNICIPAL', 552.00, 'debit', 'Bills', 0.91, 'rule_based'),
    ('t0000001-0000-4000-a000-000000000018', 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '2024-01-20', 'BROADBAND - ACT FIBERNET', 1000.00, 'debit', 'Bills', 0.94, 'rule_based'),

    -- EMI (₹10,000 across 1 transaction)
    ('t0000001-0000-4000-a000-000000000019', 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '2024-01-05', 'HOME LOAN EMI - SBI', 10000.00, 'debit', 'EMI', 0.99, 'rule_based'),

    -- Healthcare (₹2,000 across 1 transaction)
    ('t0000001-0000-4000-a000-000000000020', 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '2024-01-11', 'APOLLO PHARMACY PURCHASE', 2000.00, 'debit', 'Healthcare', 0.86, 'rule_based'),

    -- Entertainment (₹3,500 across 2 transactions)
    ('t0000001-0000-4000-a000-000000000021', 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '2024-01-16', 'PVR CINEMAS - MOVIE TICKETS', 1200.00, 'debit', 'Entertainment', 0.90, 'rule_based'),
    ('t0000001-0000-4000-a000-000000000022', 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '2024-01-28', 'SPOTIFY PREMIUM SUBSCRIPTION', 119.00, 'debit', 'Entertainment', 0.92, 'rule_based'),
    ('t0000001-0000-4000-a000-000000000023', 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '2024-01-30', 'GAMING - STEAM PURCHASE', 2181.00, 'debit', 'Entertainment', 0.80, 'llm_based'),

    -- Investments (₹15,000 across 2 transactions)
    ('t0000001-0000-4000-a000-000000000024', 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '2024-01-05', 'SIP - MUTUAL FUND INVESTMENT', 10000.00, 'debit', 'Investments', 0.97, 'rule_based'),
    ('t0000001-0000-4000-a000-000000000025', 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6b', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '2024-01-10', 'PPF DEPOSIT', 5000.00, 'debit', 'Investments', 0.96, 'rule_based');


-- ============================================================
-- Demo Financial Summary
-- Monthly income: ₹120,000 | Expenses: ₹78,000 | Savings: ₹42,000
-- ============================================================
INSERT INTO financial_summaries (id, session_id, monthly_income, total_expenses, monthly_savings, savings_percentage, expenses_by_category, calculated_at)
VALUES (
    'f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c',
    'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    120000.00,
    78000.00,
    42000.00,
    35.00,
    '{
        "Rent": 25000,
        "Food": 18500,
        "Travel": 5000,
        "Shopping": 8000,
        "Bills": 6000,
        "EMI": 10000,
        "Healthcare": 2000,
        "Entertainment": 3500,
        "Investments": 15000,
        "Savings": 0,
        "Education": 0,
        "Miscellaneous": 0
    }',
    '2024-01-15 09:01:00'
);

-- ============================================================
-- Demo Health Score
-- Total: 72/100 (Very Good)
-- Savings Ratio: 25/30 | Expense Control: 18/25 | EMI Burden: 12/15
-- Investment Allocation: 10/15 | Emergency Fund: 7/15
-- ============================================================
INSERT INTO health_scores (id, session_id, total_score, status_label, savings_ratio_score, expense_control_score, emi_burden_score, investment_allocation_score, emergency_fund_score, component_details, calculated_at)
VALUES (
    'h1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c',
    'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    72,
    'Very Good',
    25,
    18,
    12,
    10,
    7,
    '{
        "savingsRatio": {"score": 25, "maxScore": 30, "value": 0.35, "description": "Savings rate of 35% is excellent"},
        "expenseControl": {"score": 18, "maxScore": 25, "value": 0.42, "description": "Discretionary spending at 42% could be improved"},
        "emiBurden": {"score": 12, "maxScore": 15, "value": 0.083, "description": "EMI burden at 8.3% is well managed"},
        "investmentAllocation": {"score": 10, "maxScore": 15, "value": 0.125, "description": "Investment allocation at 12.5% - consider increasing"},
        "emergencyFundReadiness": {"score": 7, "maxScore": 15, "value": 2.8, "description": "Emergency fund covers 2.8 months - target 6 months"}
    }',
    '2024-01-15 09:01:00'
);

-- ============================================================
-- Demo Recommendations (5 personalized recommendations)
-- ============================================================
INSERT INTO recommendations (id, session_id, display_order, category, text, data_point_reference, generated_at)
VALUES
    ('r1000001-0000-4000-a000-000000000001', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 1, 'Food Expenses', 'Your food spending is ₹18,500/month (23.7% of expenses). Consider meal planning and reducing food delivery orders by 2-3 times per week to save approximately ₹4,000-5,000 monthly.', 'Food: ₹18,500 (23.7% of total expenses)', '2024-01-15 09:01:00'),
    ('r1000001-0000-4000-a000-000000000002', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 2, 'Emergency Fund', 'Your emergency fund covers only 2.8 months of expenses. Aim to build a cushion of at least 6 months (₹4,68,000) by allocating ₹10,000 extra monthly from your savings.', 'Emergency Fund Coverage: 2.8 months (target: 6 months)', '2024-01-15 09:01:00'),
    ('r1000001-0000-4000-a000-000000000003', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 3, 'Investment Growth', 'Your investment allocation is 12.5% of income (₹15,000/month). Consider increasing to 20% (₹24,000/month) to maximize long-term wealth building through systematic investment plans.', 'Investments: ₹15,000/month (12.5% of income)', '2024-01-15 09:01:00'),
    ('r1000001-0000-4000-a000-000000000004', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 4, 'Shopping Control', 'Shopping expenses of ₹8,000/month (10.3% of expenses) can be optimized. Try implementing a 48-hour rule for non-essential purchases above ₹2,000 to reduce impulse buying by 30-40%.', 'Shopping: ₹8,000 (10.3% of total expenses)', '2024-01-15 09:01:00'),
    ('r1000001-0000-4000-a000-000000000005', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 5, 'Savings Optimization', 'Your savings rate of 35% (₹42,000/month) is strong. Consider allocating the surplus beyond emergency fund and investments towards goal-specific accounts to track progress better.', 'Savings: ₹42,000/month (35% savings rate)', '2024-01-15 09:01:00');

-- ============================================================
-- Demo Goal (Buy a Car)
-- ============================================================
INSERT INTO goals (id, session_id, goal_name, goal_type, target_amount, duration_months, existing_savings, expected_return_percent, required_monthly_savings, feasibility_status, created_at)
VALUES (
    'g1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c',
    'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    'Buy a Car',
    'buy_car',
    800000.00,
    24,
    100000.00,
    8.00,
    26923.00,
    'Challenging',
    '2024-01-15 09:02:00'
);

-- ============================================================
-- Demo Chat Messages (sample Q&A)
-- ============================================================
INSERT INTO chat_messages (id, session_id, sequence_number, question, answer, created_at)
VALUES
    ('c1000001-0000-4000-a000-000000000001', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 1, 'What is my biggest expense?', 'Your biggest expense is Rent at ₹25,000 per month, which accounts for 32.1% of your total monthly expenses of ₹78,000. This is followed by Food at ₹18,500 (23.7%) and Investments at ₹15,000 (19.2%). Note: This is informational guidance only. Consult a certified financial advisor for professional advice.', '2024-01-15 09:05:00'),
    ('c1000001-0000-4000-a000-000000000002', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 2, 'How can I improve my financial health score?', 'Your current Financial Health Score is 72/100 (Very Good). To improve it further, focus on these areas: 1) Build your emergency fund from 2.8 months to 6 months coverage (potential +8 points), 2) Increase investment allocation from 12.5% to 20% of income (potential +5 points), 3) Reduce discretionary spending from 42% to below 35% (potential +3-4 points). These changes could push your score into the Excellent range (86+). Note: This is informational guidance only. Consult a certified financial advisor for professional advice.', '2024-01-15 09:06:00');

-- ============================================================
-- Demo Recurring Expenses
-- ============================================================
INSERT INTO recurring_expenses (id, session_id, description, recurring_amount, consecutive_months, detected_at)
VALUES
    ('re000001-0000-4000-a000-000000000001', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'NETFLIX SUBSCRIPTION', 649.00, 3, '2024-01-15 09:01:00'),
    ('re000002-0000-4000-a000-000000000002', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'HOME LOAN EMI - SBI', 10000.00, 6, '2024-01-15 09:01:00'),
    ('re000003-0000-4000-a000-000000000003', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'AIRTEL POSTPAID BILL', 999.00, 4, '2024-01-15 09:01:00');

-- ============================================================
-- Demo Spending Anomaly
-- ============================================================
INSERT INTO spending_anomalies (id, session_id, transaction_id, description, transaction_amount, category, category_average, detected_at)
VALUES (
    'sa000001-0000-4000-a000-000000000001',
    'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    't0000001-0000-4000-a000-000000000012',
    'Amazon electronics purchase significantly exceeds typical Shopping spend',
    5500.00,
    'Shopping',
    2500.00,
    '2024-01-15 09:01:00'
);
