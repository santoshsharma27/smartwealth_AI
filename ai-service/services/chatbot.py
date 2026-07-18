"""Core chatbot engine logic.

Implements a rule-based/template-based chatbot (no LLM required for MVP) that:
- Detects question intent (spending, savings, goals, score, general)
- Generates relevant responses using the financial context data
- Formats amounts in ₹ with Indian comma grouping
- Includes a disclaimer in every response
- Declines specific investment product requests
- States missing data when question requires unavailable information
"""

import re
from enum import Enum

from models.chat import ChatRequest, ChatResponse, FinancialContext


DISCLAIMER = (
    "This is informational guidance only. "
    "Consult a certified financial advisor for professional advice."
)

# Patterns to detect investment product requests
_INVESTMENT_PRODUCT_PATTERNS = [
    # Specific stocks
    r"(?i)\b(?:Reliance|Infosys|TCS|Wipro|HDFC Bank|ICICI Bank|SBI|Adani|"
    r"Tata Motors|Bajaj Finance|HUL|ITC|Maruti|Asian Paints|Bharti Airtel)\b",
    # Stock tickers
    r"\b[A-Z]{2,5}\b\s*(?:stock|shares?|equity|buy|sell)",
    # Mutual fund names
    r"(?i)\b(?:HDFC|ICICI|SBI|Axis|Kotak|Nippon|Mirae|DSP|Tata|UTI|Aditya Birla)"
    r"\s+(?:Mutual Fund|MF|Fund|Scheme|Growth|Direct|Regular|Flexi|Blue\s?chip|"
    r"Large\s?cap|Mid\s?cap|Small\s?cap)\b",
    # Crypto tokens
    r"(?i)\b(?:Bitcoin|BTC|Ethereum|ETH|Dogecoin|DOGE|Solana|SOL|Cardano|ADA|"
    r"Ripple|XRP|Litecoin|LTC|Shiba Inu|SHIB|Polygon|MATIC)\b",
    # General investment product intent
    r"(?i)\b(?:which|best|recommend|suggest|buy|invest\s+in)\b.*"
    r"\b(?:stock|share|mutual fund|crypto|NFT|IPO|bond|debenture)\b",
    r"(?i)\b(?:stock|share|mutual fund|crypto|NFT|IPO|bond|debenture)\b.*"
    r"\b(?:which|best|recommend|suggest|buy|invest\s+in)\b",
]

_COMPILED_INVESTMENT_PATTERNS = [re.compile(p) for p in _INVESTMENT_PRODUCT_PATTERNS]


class Intent(str, Enum):
    """Detected question intent categories."""

    SPENDING = "spending"
    SAVINGS = "savings"
    GOALS = "goals"
    SCORE = "score"
    GENERAL = "general"
    INVESTMENT_PRODUCT = "investment_product"


# Intent detection keyword mappings
_SPENDING_KEYWORDS = [
    "spend", "spending", "expense", "expenses", "spent", "cost", "costs",
    "food", "rent", "shopping", "entertainment", "travel", "bills", "emi",
    "category", "categories", "budget", "reduce", "cut", "save on",
    "where does my money go", "money go", "high expense", "too much",
]

_SAVINGS_KEYWORDS = [
    "save", "saving", "savings", "save more", "increase savings",
    "how much can i save", "saving potential", "saving rate",
    "put aside", "set aside", "savings percentage",
]

_GOALS_KEYWORDS = [
    "goal", "goals", "target", "plan", "planning", "feasible",
    "feasibility", "achieve", "car", "house", "vacation", "emergency fund",
    "retirement", "education", "monthly savings needed", "how long",
    "can i afford", "reach my goal",
]

_SCORE_KEYWORDS = [
    "score", "health score", "financial health", "improve score",
    "rating", "how am i doing", "financial wellness", "assessment",
    "component", "components",
]


def _format_inr(amount: float) -> str:
    """Format amount in Indian Rupee notation with comma grouping (₹1,20,000)."""
    if amount < 0:
        return f"-₹{_format_inr_abs(-amount)}"
    return f"₹{_format_inr_abs(amount)}"


def _format_inr_abs(amount: float) -> str:
    """Format absolute amount with Indian comma grouping."""
    amount_int = int(round(amount))
    s = str(amount_int)
    if len(s) <= 3:
        return s
    last_three = s[-3:]
    remaining = s[:-3]
    groups = []
    while remaining:
        groups.append(remaining[-2:])
        remaining = remaining[:-2]
    groups.reverse()
    return f"{','.join(groups)},{last_three}"


def _detect_intent(message: str) -> Intent:
    """Detect the user's question intent from their message."""
    message_lower = message.lower()

    # Check for investment product requests first (highest priority)
    for pattern in _COMPILED_INVESTMENT_PATTERNS:
        if pattern.search(message):
            return Intent.INVESTMENT_PRODUCT

    # Score detection
    for keyword in _SCORE_KEYWORDS:
        if keyword in message_lower:
            return Intent.SCORE

    # Goals detection
    for keyword in _GOALS_KEYWORDS:
        if keyword in message_lower:
            return Intent.GOALS

    # Savings detection (before spending since "save" overlaps)
    for keyword in _SAVINGS_KEYWORDS:
        if keyword in message_lower:
            return Intent.SAVINGS

    # Spending detection
    for keyword in _SPENDING_KEYWORDS:
        if keyword in message_lower:
            return Intent.SPENDING

    return Intent.GENERAL


def _is_context_empty(context: FinancialContext) -> bool:
    """Check if the financial context has no meaningful data."""
    has_transactions = len(context.transactions) > 0
    has_summary = context.summary is not None and len(context.summary) > 0
    has_goals = len(context.goals) > 0
    has_score = context.score is not None and len(context.score) > 0
    return not (has_transactions or has_summary or has_goals or has_score)


def _handle_investment_product_request() -> str:
    """Return decline message for specific investment product requests."""
    return (
        "I'm unable to recommend specific stocks, mutual fund schemes, "
        "cryptocurrency tokens, or other named financial instruments. "
        "My role is to provide general financial guidance based on your data. "
        "For specific investment product recommendations, please consult a "
        "certified financial advisor who can assess your risk profile and "
        "investment horizon."
    )


def _handle_empty_context() -> str:
    """Return message when no financial data is available."""
    return (
        "I don't have any financial data to work with yet. "
        "Please upload your salary slips and bank statements, "
        "or try the demo data to see how I can help you with "
        "personalized financial guidance."
    )


def _handle_spending_intent(context: FinancialContext, message: str) -> str:
    """Generate response for spending-related questions."""
    summary = context.summary
    transactions = context.transactions

    if not summary and not transactions:
        return (
            "I need your transaction data to answer questions about spending. "
            "Please upload your bank statements so I can analyze your expense patterns."
        )

    # Extract spending data from summary
    if summary:
        total_expenses = summary.get("totalExpenses") or summary.get("total_expenses", 0)
        monthly_income = summary.get("monthlyIncome") or summary.get("monthly_income", 0)
        expenses_by_category = (
            summary.get("expensesByCategory")
            or summary.get("expenses_by_category", {})
        )

        if not expenses_by_category and not transactions:
            return (
                "I have your income and expense totals but no category-level breakdown. "
                "Please upload bank statements to see detailed spending patterns by category."
            )

        # Check if user asked about a specific category
        message_lower = message.lower()
        category_match = None
        for cat in ["Food", "Rent", "Shopping", "Entertainment", "Travel",
                    "Bills", "EMI", "Healthcare", "Investments", "Education",
                    "Savings", "Miscellaneous"]:
            if cat.lower() in message_lower:
                category_match = cat
                break

        if category_match and expenses_by_category:
            cat_amount = expenses_by_category.get(category_match, 0)
            if cat_amount > 0:
                pct = (cat_amount / total_expenses * 100) if total_expenses > 0 else 0
                response = (
                    f"Based on your data, you spent {_format_inr(cat_amount)} on "
                    f"{category_match} last month, which is {pct:.1f}% of your total "
                    f"expenses of {_format_inr(total_expenses)}."
                )
                if pct > 25:
                    response += (
                        f" This is a significant portion of your spending. "
                        f"Consider reviewing this category for potential savings."
                    )
                elif pct > 15:
                    response += (
                        f" This is a moderate portion of your budget. "
                        f"Look for small optimizations to reduce costs."
                    )
                return response
            else:
                return (
                    f"Based on your data, you have no recorded spending in the "
                    f"{category_match} category for the current period."
                )

        # General spending overview
        if expenses_by_category:
            sorted_cats = sorted(
                expenses_by_category.items(), key=lambda x: x[1], reverse=True
            )
            top_categories = sorted_cats[:3]
            lines = [
                f"Here's your spending overview. Your total monthly expenses are "
                f"{_format_inr(total_expenses)}."
            ]
            if monthly_income > 0:
                expense_pct = total_expenses / monthly_income * 100
                lines[0] += f" That's {expense_pct:.1f}% of your income of {_format_inr(monthly_income)}."

            lines.append("\nYour top spending categories are:")
            for cat, amount in top_categories:
                pct = (amount / total_expenses * 100) if total_expenses > 0 else 0
                lines.append(f"  • {cat}: {_format_inr(amount)} ({pct:.1f}%)")

            if total_expenses > 0 and monthly_income > 0 and total_expenses / monthly_income > 0.70:
                lines.append(
                    "\nYour expenses are over 70% of your income. Consider reducing "
                    "discretionary spending to improve your savings rate."
                )
            return "\n".join(lines)

        # Fallback with just totals
        return (
            f"Your total monthly expenses are {_format_inr(total_expenses)}. "
            f"Upload detailed bank statements to see a breakdown by category."
        )

    # Only transactions available, no summary
    if transactions:
        total = sum(t.get("amount", 0) for t in transactions if t.get("type") == "debit")
        return (
            f"Based on your {len(transactions)} transactions, your total spending "
            f"comes to {_format_inr(total)}. Upload more documents for a complete "
            f"financial summary with category-level insights."
        )

    return (
        "I need transaction or summary data to answer spending questions. "
        "Please upload your bank statements."
    )


def _handle_savings_intent(context: FinancialContext) -> str:
    """Generate response for savings-related questions."""
    summary = context.summary

    if not summary:
        return (
            "I need your financial summary data (income and expenses) to analyze "
            "your savings potential. Please upload your salary slips and bank statements."
        )

    monthly_income = summary.get("monthlyIncome") or summary.get("monthly_income", 0)
    total_expenses = summary.get("totalExpenses") or summary.get("total_expenses", 0)
    monthly_savings = summary.get("monthlySavings") or summary.get("monthly_savings", 0)
    savings_percentage = summary.get("savingsPercentage") or summary.get("savings_percentage", 0)

    if monthly_income <= 0:
        return (
            "I don't have your income data, which is needed to assess savings potential. "
            "Please upload your salary slips."
        )

    # Calculate savings if not directly available
    if monthly_savings == 0 and monthly_income > 0 and total_expenses > 0:
        monthly_savings = monthly_income - total_expenses
        savings_percentage = (monthly_savings / monthly_income) * 100

    response = (
        f"Your monthly income is {_format_inr(monthly_income)} and your expenses "
        f"are {_format_inr(total_expenses)}, leaving you with savings of "
        f"{_format_inr(monthly_savings)} ({savings_percentage:.1f}% of income)."
    )

    if savings_percentage >= 30:
        response += (
            " Excellent! Your savings rate is above the recommended 30% threshold. "
            "Consider directing surplus savings into long-term investments."
        )
    elif savings_percentage >= 20:
        response += (
            " Good savings rate! You're above the 20% minimum recommendation. "
            "Try to gradually increase to 30% for stronger financial health."
        )
    elif savings_percentage >= 10:
        response += (
            " Your savings rate could be improved. The recommended minimum is 20%. "
            "Review your discretionary expenses (shopping, entertainment, dining out) "
            "for potential cuts."
        )
    else:
        response += (
            " Your savings rate is below 10%, which needs attention. "
            "Focus on reducing non-essential spending and consider the 50-30-20 rule: "
            "50% needs, 30% wants, 20% savings."
        )

    return response


def _handle_goals_intent(context: FinancialContext, message: str) -> str:
    """Generate response for goal-related questions."""
    goals = context.goals
    summary = context.summary

    if not goals and not summary:
        return (
            "I need your financial data and goals to provide goal-related guidance. "
            "Please upload your documents and create goals in the Goal Planner to "
            "get feasibility assessments."
        )

    if not goals:
        return (
            "You haven't created any financial goals yet. Use the Goal Planner to "
            "set targets like buying a car, saving for a vacation, or building an "
            "emergency fund. I can then help assess feasibility based on your "
            f"current savings of {_format_inr(summary.get('monthlySavings') or summary.get('monthly_savings', 0))} per month."
        )

    # Display goals summary
    lines = [f"You have {len(goals)} financial goal(s):"]
    for goal in goals:
        name = goal.get("goalName") or goal.get("goal_name", "Unnamed goal")
        target = goal.get("targetAmount") or goal.get("target_amount", 0)
        required = goal.get("requiredMonthlySavings") or goal.get("required_monthly_savings", 0)
        feasibility = goal.get("feasibilityStatus") or goal.get("feasibility_status", "Unknown")
        lines.append(
            f"  • {name}: Target {_format_inr(target)}, "
            f"needs {_format_inr(required)}/month — {feasibility}"
        )

    if summary:
        monthly_savings = summary.get("monthlySavings") or summary.get("monthly_savings", 0)
        total_required = sum(
            g.get("requiredMonthlySavings") or g.get("required_monthly_savings", 0)
            for g in goals
        )
        if monthly_savings > 0:
            lines.append(
                f"\nWith your monthly savings of {_format_inr(monthly_savings)}, "
                f"you need {_format_inr(total_required)} total across all goals."
            )
            if total_required > monthly_savings:
                lines.append(
                    "You may need to prioritize goals or extend timelines to make them feasible."
                )

    return "\n".join(lines)


def _handle_score_intent(context: FinancialContext) -> str:
    """Generate response for score-related questions."""
    score = context.score

    if not score:
        return (
            "I don't have your Financial Health Score data. Your score is calculated "
            "after uploading documents. Please upload salary slips and bank statements, "
            "or load demo data to see your score."
        )

    total_score = score.get("totalScore") or score.get("total_score", 0)
    status_label = score.get("statusLabel") or score.get("status_label", "Unknown")
    components = score.get("components", {})

    response = (
        f"Your Financial Health Score is {total_score}/100 — rated \"{status_label}\"."
    )

    # Break down components if available
    if components:
        response += "\n\nHere's the breakdown:"
        component_info = [
            ("savingsRatio", "savings_ratio", "Savings Ratio", 30),
            ("expenseControl", "expense_control", "Expense Control", 25),
            ("emiBurden", "emi_burden", "EMI Burden", 15),
            ("investmentAllocation", "investment_allocation", "Investment Allocation", 15),
            ("emergencyFundReadiness", "emergency_fund_readiness", "Emergency Fund", 15),
        ]

        weakest_component = None
        weakest_pct = 1.0

        for camel_key, snake_key, label, max_score in component_info:
            comp = components.get(camel_key) or components.get(snake_key, {})
            if isinstance(comp, dict):
                comp_score = comp.get("score", 0)
            else:
                comp_score = comp
            pct = comp_score / max_score if max_score > 0 else 0
            response += f"\n  • {label}: {comp_score}/{max_score}"
            if pct < weakest_pct:
                weakest_pct = pct
                weakest_component = label

        if weakest_component and weakest_pct < 0.5:
            response += (
                f"\n\nYour weakest area is {weakest_component} "
                f"(scoring below 50% of its maximum). "
                f"Improving this component would have the biggest impact on your overall score."
            )

    return response


def _handle_general_intent(context: FinancialContext) -> str:
    """Generate response for general financial questions."""
    summary = context.summary
    score = context.score

    if summary:
        monthly_income = summary.get("monthlyIncome") or summary.get("monthly_income", 0)
        total_expenses = summary.get("totalExpenses") or summary.get("total_expenses", 0)
        monthly_savings = summary.get("monthlySavings") or summary.get("monthly_savings", 0)

        response = (
            f"Here's a quick overview of your finances: "
            f"Monthly income {_format_inr(monthly_income)}, "
            f"expenses {_format_inr(total_expenses)}, "
            f"savings {_format_inr(monthly_savings)}."
        )

        if score:
            total_score = score.get("totalScore") or score.get("total_score", 0)
            status_label = score.get("statusLabel") or score.get("status_label", "")
            response += f" Your Financial Health Score is {total_score}/100 ({status_label})."

        response += (
            "\n\nYou can ask me about:\n"
            "  • Spending patterns and expense breakdown\n"
            "  • Savings potential and improvement tips\n"
            "  • Goal feasibility and planning\n"
            "  • Financial Health Score components\n"
            "  • Expense reduction strategies"
        )
        return response

    return (
        "I can help you understand your finances once you upload your documents. "
        "You can ask me about spending patterns, savings potential, goal feasibility, "
        "expense reduction, and your Financial Health Score. "
        "Upload salary slips and bank statements to get started, or try the demo data."
    )


def process_chat(request: ChatRequest) -> ChatResponse:
    """Process a chatbot question and generate a contextual response.

    The chatbot:
    - Detects question intent (spending, savings, goals, score, general)
    - Uses ONLY the user's provided financial context data
    - If LLM is available (LM Studio), enhances responses with natural language
    - References specific numbers from their data
    - Includes a disclaimer in every response
    - Declines specific investment product requests
    - States missing data type if needed
    """
    context = request.financial_context

    # Check for empty financial context
    if _is_context_empty(context):
        return ChatResponse(
            answer=_handle_empty_context(),
            disclaimer=DISCLAIMER,
        )

    # Detect intent
    intent = _detect_intent(request.message)

    # Handle investment product requests (decline)
    if intent == Intent.INVESTMENT_PRODUCT:
        return ChatResponse(
            answer=_handle_investment_product_request(),
            disclaimer=DISCLAIMER,
        )

    # Try LLM-enhanced response first
    llm_answer = _try_llm_response(request.message, context, intent)
    if llm_answer:
        return ChatResponse(
            answer=llm_answer,
            disclaimer=DISCLAIMER,
        )

    # Fallback to template-based response
    if intent == Intent.SPENDING:
        answer = _handle_spending_intent(context, request.message)
    elif intent == Intent.SAVINGS:
        answer = _handle_savings_intent(context)
    elif intent == Intent.GOALS:
        answer = _handle_goals_intent(context, request.message)
    elif intent == Intent.SCORE:
        answer = _handle_score_intent(context)
    else:
        answer = _handle_general_intent(context)

    return ChatResponse(
        answer=answer,
        disclaimer=DISCLAIMER,
    )


def _try_llm_response(message: str, context: FinancialContext, intent: Intent) -> str | None:
    """Try to generate an LLM-enhanced response using LM Studio.

    Returns None if LLM is unavailable, letting the template fallback handle it.
    """
    from services.llm_client import chat_completion, is_available

    if not is_available():
        return None

    # Build context summary for the LLM
    context_parts = []

    if context.summary:
        summary = context.summary
        income = summary.get("monthlyIncome") or summary.get("monthly_income", 0)
        expenses = summary.get("totalExpenses") or summary.get("total_expenses", 0)
        savings = summary.get("monthlySavings") or summary.get("monthly_savings", 0)
        savings_pct = summary.get("savingsPercentage") or summary.get("savings_percentage", 0)
        context_parts.append(
            f"Monthly income: ₹{income:,.0f}, Expenses: ₹{expenses:,.0f}, "
            f"Savings: ₹{savings:,.0f} ({savings_pct:.1f}%)"
        )
        expenses_by_cat = summary.get("expensesByCategory") or summary.get("expenses_by_category", {})
        if expenses_by_cat:
            cat_str = ", ".join(f"{k}: ₹{v:,.0f}" for k, v in expenses_by_cat.items() if v > 0)
            context_parts.append(f"Expenses by category: {cat_str}")

    if context.score:
        score = context.score
        total = score.get("totalScore") or score.get("total_score", 0)
        label = score.get("statusLabel") or score.get("status_label", "")
        context_parts.append(f"Financial Health Score: {total}/100 ({label})")

    if context.goals:
        goals_str = ", ".join(
            f"{g.get('goalName', g.get('goal_name', 'Goal'))}: ₹{g.get('targetAmount', g.get('target_amount', 0)):,.0f}"
            for g in context.goals[:3]
        )
        context_parts.append(f"Goals: {goals_str}")

    if not context_parts:
        return None

    financial_context_str = "\n".join(context_parts)

    messages = [
        {
            "role": "system",
            "content": (
                "You are a helpful personal finance assistant. "
                "Answer the user's question using ONLY the financial data provided below. "
                "Reference specific numbers from their data. "
                "Use ₹ Indian Rupee formatting. Keep responses concise (2-4 sentences). "
                "Do NOT recommend specific stocks, mutual funds, or financial products by name. "
                "Do NOT provide tax advice. "
                "Provide general actionable suggestions only.\n\n"
                f"USER'S FINANCIAL DATA:\n{financial_context_str}"
            ),
        },
        {
            "role": "user",
            "content": message,
        },
    ]

    try:
        result = chat_completion(messages, temperature=0.4, max_tokens=300)
        if result:
            # Verify the response doesn't contain blocked content
            for pattern in _COMPILED_INVESTMENT_PATTERNS:
                if pattern.search(result):
                    return None  # Fall back to template if LLM suggests specific products
            return result
        return None
    except Exception:
        return None
