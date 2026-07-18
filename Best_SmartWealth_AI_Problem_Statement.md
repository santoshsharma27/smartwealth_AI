# SmartWealth AI – Personal Financial Copilot

## 1. Project Title

**SmartWealth AI – Upload. Analyze. Plan.**

## 2. Tagline

**Your Personal Financial Copilot for Smarter Money Decisions**

## 3. Final Problem Statement

Millions of salaried individuals receive income every month but still struggle to clearly understand where their money goes, whether they are saving enough, and how to plan for important financial goals such as buying a house, purchasing a car, building an emergency fund, funding education, or preparing for retirement.

Although banking apps, UPI apps, salary slips, investment platforms, and bank statements contain useful financial data, this information is usually scattered across multiple documents and applications. Most existing personal finance tools show balances, transactions, or charts, but they do not convert raw financial documents into simple, personalized, and actionable guidance.

As a result, users often overspend without realizing it, save inconsistently, miss opportunities to reduce unnecessary expenses, invest without a clear plan, and struggle to measure their overall financial health.

The challenge is to build an AI-powered personal financial advisor that allows users to upload salary slips and bank statements, automatically extracts and categorizes financial data, calculates income, expenses, savings, and a Financial Health Score, generates personalized recommendations, supports goal planning, and answers user questions through an AI chatbot using the uploaded financial data.

SmartWealth AI should help users understand their financial situation without requiring financial expertise and guide them toward better savings, spending discipline, and goal-based planning.

## 4. Elevator Pitch

SmartWealth AI helps salaried individuals understand their money in minutes. Users upload a salary slip and bank statement, and the app generates a clean dashboard showing income, expenses, savings, spending categories, a Financial Health Score, personalized AI recommendations, goal planning, and a chatbot that answers questions based on the user’s own financial data.

## 5. Target Users

- Salaried employees
- Young professionals
- First-time investors
- Individuals who want better savings discipline
- Families planning major financial goals
- Users who do not have access to a personal financial advisor
- People who want simple AI-driven financial guidance

## 6. Core User Problems

Users want simple answers to questions like:

- Where is my money going every month?
- Am I saving enough?
- Which expense category is too high?
- What expenses can I reduce?
- How much can I invest safely every month?
- Can I afford a car, house, vacation, or education goal?
- What is my savings rate?
- How can I improve my financial health?

## 7. Proposed Solution

Build an AI-powered web application where users can upload financial documents and receive personalized financial insights. The system extracts salary and transaction information, categorizes expenses, calculates financial summaries, generates a Financial Health Score, recommends improvements, supports goal planning, and provides an AI chatbot for finance-related questions.

The application should focus on simplicity, explainability, and judge-friendly demonstration. For the MVP, demo data can be used to show the end-to-end user experience even if full PDF parsing is not complete.

## 8. MVP Features

### 8.1 Must Have

- Landing page with app introduction
- Try Demo Data button for judges
- Salary slip and bank statement upload flow
- Income, expense, and savings dashboard
- Expense categorization
- Financial Health Score
- AI-generated personalized recommendations
- Clean and responsive UI

### 8.2 Should Have

- Goal planner
- AI finance chatbot
- CSV/PDF transaction parsing
- Recurring expense and unusual spending detection

### 8.3 Nice to Have

- Downloadable AI Financial Report
- Persistent login
- Real PDF parsing for different bank formats
- Bank API integration
- Tax and investment optimization

## 9. Key Functional Requirements

### 9.1 Document Upload

Users should be able to upload:

- Salary slip PDF
- Bank statement PDF or CSV
- Optional mutual fund statement
- Optional Form 16

### 9.2 Document Processing

The system should extract:

- Monthly salary
- Employer information
- Credits and debits
- Transaction history
- Deductions
- Investment details, where available

### 9.3 Expense Categorization

Transactions should be categorized into:

- Rent
- Food
- Travel
- Shopping
- Bills
- EMI or loans
- Healthcare
- Entertainment
- Investments
- Savings
- Education
- Miscellaneous

### 9.4 Dashboard

The dashboard should show:

- Monthly income
- Total expenses
- Monthly savings
- Savings percentage
- Top spending categories
- Expense category chart
- Spending trends
- Recurring expenses
- Unusual spending patterns
- Financial Health Score

### 9.5 Financial Health Score

Calculate a score from 0 to 100 based on:

- Savings ratio
- Expense control
- EMI burden
- Investment allocation
- Emergency fund readiness
- Spending discipline

Suggested scoring split:

| Component | Points |
|---|---:|
| Savings Ratio | 30 |
| Expense Control | 25 |
| EMI Burden | 15 |
| Investment Allocation | 15 |
| Emergency Fund Readiness | 15 |
| **Total** | **100** |

Example:

```text
Financial Health Score: 78 / 100
Status: Good, but savings can be improved.
```

### 9.6 AI Recommendations

The AI should generate practical suggestions such as:

- Reduce food delivery expenses by 15%.
- Review high shopping or entertainment expenses.
- Build an emergency fund worth 6 months of expenses.
- Increase monthly SIP investment if savings allow.
- Avoid unnecessary recurring subscriptions.

### 9.7 Goal Planner

Users should be able to create goals such as:

- Buy a car
- Buy a house
- Save for vacation
- Build emergency fund
- Education planning
- Retirement planning

The app should estimate:

- Target amount
- Existing savings
- Duration
- Required monthly savings or SIP
- Approximate completion timeline

### 9.8 AI Finance Chatbot

The chatbot should answer only using uploaded or demo financial data.

Example questions:

- Where am I overspending?
- How can I save ₹10,000 more per month?
- Can I afford a car in 2 years?
- What is my biggest financial risk?
- What is my savings rate?
- How can I improve my Financial Health Score?

### 9.9 AI Financial Report

Generate a downloadable report containing:

- Income summary
- Expense summary
- Savings analysis
- Financial Health Score
- Key risks
- AI recommendations
- Goal plan
- Next action items

## 10. Recommended Tech Stack

### Frontend

- React
- Tailwind CSS
- Chart.js or Recharts

### Backend

- Java Quarkus
- REST APIs

### AI Service

- Python FastAPI
- PyMuPDF or pdfplumber for PDF parsing
- Rule-based categorization plus LLM recommendations
- OpenAI, Gemini, Azure OpenAI, or local LLM

### Database

- PostgreSQL

### Deployment

- Vercel for React frontend
- Render or Railway for backend services
- Neon or Supabase for PostgreSQL

## 11. Suggested Architecture

```text
React UI
   |
   v
Quarkus Backend API
   |
   +--> PostgreSQL Database
   |
   +--> Python FastAPI AI Service
              |
              +--> PDF/CSV Parser
              +--> Expense Categorizer
              +--> Financial Health Score Engine
              +--> LLM Recommendation Engine
              +--> Chatbot Engine
              +--> Report Generator
```

## 12. Main Application Flow

1. User opens SmartWealth AI.
2. User clicks Try Demo Data or uploads documents.
3. User uploads salary slip and bank statement.
4. Backend stores document metadata.
5. AI service extracts salary and transaction data.
6. Transactions are categorized automatically.
7. Financial summary is generated.
8. Financial Health Score is calculated.
9. AI recommendations are generated.
10. User views the dashboard.
11. User creates a financial goal.
12. User asks questions in the chatbot.
13. User downloads the AI Financial Report.

## 13. Sample Pages to Build

### 13.1 Landing Page

- App title and tagline
- Short explanation
- Upload documents button
- Try Demo Data button
- Key feature cards

### 13.2 Upload Page

- Salary slip upload
- Bank statement upload
- Submit button
- Upload status

### 13.3 Dashboard Page

- Monthly income card
- Monthly expense card
- Monthly savings card
- Savings percentage card
- Financial Health Score card
- Expense category chart
- AI recommendation panel

### 13.4 Goal Planner Page

Inputs:

- Goal name
- Target amount
- Target duration
- Existing savings
- Expected return percentage

Output:

- Required monthly savings or SIP
- Goal feasibility status
- Completion timeline

### 13.5 Chatbot Page

- Ask personal finance questions
- Answer using uploaded or demo financial data
- Suggest next best actions

### 13.6 Report Page

- Generate financial wellness report
- Download report as PDF or markdown

## 14. Demo Data for Judges

Include a **Try Demo Data** button so judges can test the app quickly without uploading personal documents.

```json
{
  "monthlyIncome": 120000,
  "monthlyExpense": 78000,
  "monthlySavings": 42000,
  "savingsPercentage": 35,
  "financialHealthScore": 78,
  "topExpenses": [
    { "category": "Rent", "amount": 30000 },
    { "category": "Food", "amount": 15000 },
    { "category": "Travel", "amount": 8000 },
    { "category": "Shopping", "amount": 12000 },
    { "category": "Bills", "amount": 6000 }
  ],
  "recommendations": [
    "Savings rate is healthy at 35%.",
    "Shopping expense can be reduced by 20%.",
    "Build an emergency fund of at least ₹4,68,000.",
    "Consider increasing monthly SIP allocation."
  ]
}
```

## 15. API Endpoints

### Upload Documents

```http
POST /api/documents/upload
```

Purpose:

- Upload salary slip and bank statement.
- Send files to AI service for parsing.

### Get Dashboard Summary

```http
GET /api/dashboard/{userId}
```

Purpose:

- Return income, expenses, savings, score, and recommendations.

### Get Transactions

```http
GET /api/transactions/{userId}
```

Purpose:

- Return categorized transactions.

### Create Goal

```http
POST /api/goals
```

Purpose:

- Create a financial goal.
- Calculate required monthly savings.

### Ask Chatbot

```http
POST /api/chat
```

Purpose:

- Ask finance questions based on user financial data.

### Generate Report

```http
GET /api/report/{userId}
```

Purpose:

- Generate AI Financial Report.

## 16. Database Tables

### users

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### uploaded_documents

```sql
CREATE TABLE uploaded_documents (
    id UUID PRIMARY KEY,
    user_id UUID,
    file_name VARCHAR(255),
    file_type VARCHAR(50),
    document_type VARCHAR(50),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### transactions

```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY,
    user_id UUID,
    transaction_date DATE,
    description TEXT,
    amount DECIMAL(12,2),
    transaction_type VARCHAR(20),
    category VARCHAR(100)
);
```

### financial_summary

```sql
CREATE TABLE financial_summary (
    id UUID PRIMARY KEY,
    user_id UUID,
    monthly_income DECIMAL(12,2),
    monthly_expense DECIMAL(12,2),
    monthly_savings DECIMAL(12,2),
    savings_percentage DECIMAL(5,2),
    financial_health_score INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### goals

```sql
CREATE TABLE goals (
    id UUID PRIMARY KEY,
    user_id UUID,
    goal_name VARCHAR(255),
    target_amount DECIMAL(12,2),
    duration_months INT,
    monthly_saving_required DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### chat_history

```sql
CREATE TABLE chat_history (
    id UUID PRIMARY KEY,
    user_id UUID,
    question TEXT,
    answer TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 17. AI Prompt for Recommendations

```text
You are a personal financial advisor.
Analyze the user's income, expenses, savings, spending categories, EMI burden, investments, emergency fund readiness, and goals.
Generate simple, practical, and personalized financial recommendations.
Avoid complex jargon.
Focus on savings improvement, expense reduction, emergency fund, investment discipline, and goal planning.
Return the response in clear bullet points.
Do not provide risky investment advice.
Clearly mention when data is missing.
```

## 18. AI Prompt for Chatbot

```text
You are SmartWealth AI, a personal finance copilot.
Answer the user's questions only using available salary, transaction, spending, savings, and goal data.
If data is missing, clearly say what information is needed.
Give practical and simple suggestions.
Do not provide risky financial advice.
Do not guarantee investment returns.
Encourage users to consult a certified financial advisor for major investment, tax, loan, or insurance decisions.
```

## 19. Hackathon Demo Script

1. Open SmartWealth AI landing page.
2. Click Try Demo Data.
3. Show income, expense, and savings summary.
4. Show expense category chart.
5. Explain the Financial Health Score.
6. Show AI-generated recommendations.
7. Create a goal such as buying a car.
8. Ask chatbot: “How can I save ₹10,000 more per month?”
9. Generate and download AI Financial Report.
10. End with roadmap and impact.

## 20. Judge Evaluation Mapping

| Evaluation Area | How SmartWealth AI Addresses It |
|---|---|
| Innovation | Combines document intelligence, AI recommendations, financial health scoring, goal planning, and chatbot experience. |
| Technical Depth | Uses React, Quarkus, FastAPI, PostgreSQL, PDF/CSV parsing, categorization, and LLM-based recommendations. |
| Business Value | Helps salaried individuals understand spending, improve savings, and plan goals. |
| User Experience | Simple upload-to-insight flow with dashboard, chatbot, demo data, and downloadable report. |
| Scalability | Can later integrate with bank APIs, investment platforms, tax systems, credit score services, and multilingual support. |

## 21. Safety and Disclaimer

SmartWealth AI should provide educational and informational financial guidance only. It should not claim to replace a certified financial advisor, tax consultant, or investment professional. For major investment, tax, loan, or insurance decisions, users should consult a qualified professional.

## 22. Recommended Build Priority for Coding Agent

1. Build landing page and polished dashboard.
2. Add Try Demo Data button.
3. Add financial summary cards and charts.
4. Implement expense categorization logic.
5. Implement Financial Health Score.
6. Generate AI recommendations.
7. Add goal planner.
8. Add chatbot using financial context.
9. Add upload flow.
10. Add downloadable report.
11. Deploy frontend and backend with a public URL.

## 23. Final Product Vision

SmartWealth AI is a personal finance copilot that turns financial documents into clear, personalized, and actionable guidance. Instead of showing only raw numbers, it explains what the numbers mean, identifies where users can improve, and helps them take practical steps toward financial goals.
