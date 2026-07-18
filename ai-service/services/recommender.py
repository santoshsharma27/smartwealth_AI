"""Core recommendation engine logic.

Generates 3-7 personalized financial recommendations based on the user's
financial summary data. Each recommendation:
- Addresses a distinct financial category/behavior
- References at least one specific numeric data point
- Uses plain language with inline explanations for financial terms
- Includes quantified improvement targets where applicable
- Excludes specific financial instrument names (stocks, funds, crypto)
"""

import re

from models.recommend import Recommendation, RecommendRequest, RecommendResponse


DISCLAIMER = (
    "These recommendations are for educational and informational purposes only. "
    "They do not constitute professional financial advice. Please consult a "
    "certified financial advisor before making major financial decisions."
)

# Regex patterns to detect specific financial instrument names
_INSTRUMENT_PATTERNS = [
    # Stock names / tickers (2-5 uppercase letters that look like tickers)
    r"\b[A-Z]{2,5}\b(?:\s+(?:stock|shares|equity))",
    # Specific mutual fund scheme names
    r"(?i)\b(?:HDFC|ICICI|SBI|Axis|Kotak|Nippon|Mirae|DSP|Tata|UTI|Aditya Birla)"
    r"\s+(?:Mutual Fund|MF|Fund|Scheme|Growth|Direct|Regular)\b",
    # Crypto tokens
    r"(?i)\b(?:Bitcoin|BTC|Ethereum|ETH|Dogecoin|DOGE|Solana|SOL|Cardano|ADA"
    r"|Ripple|XRP|Litecoin|LTC|Shiba Inu|SHIB|Polygon|MATIC)\b",
    # Named stocks
    r"(?i)\b(?:Reliance|Infosys|TCS|Wipro|HDFC Bank|ICICI Bank|SBI|Adani|Tata Motors"
    r"|Bajaj Finance|HUL|ITC|Maruti|Asian Paints|Bharti Airtel)\s*(?:stock|share|Ltd|Limited)?\b",
]

_COMPILED_PATTERNS = [re.compile(p) for p in _INSTRUMENT_PATTERNS]


def _contains_financial_instruments(text: str) -> bool:
    """Check if text contains specific financial instrument names."""
    for pattern in _COMPILED_PATTERNS:
        if pattern.search(text):
            return True
    return False


def _sanitize_recommendation_text(text: str) -> str:
    """Remove any specific financial instrument references from text.

    Replaces specific names with generic category-level guidance.
    """
    # Replace specific mutual fund names with generic
    text = re.sub(
        r"(?i)\b(?:HDFC|ICICI|SBI|Axis|Kotak|Nippon|Mirae|DSP|Tata|UTI|Aditya Birla)"
        r"\s+(?:Mutual Fund|MF|Fund|Scheme|Growth|Direct|Regular)\b",
        "a diversified mutual fund",
        text,
    )
    # Replace crypto tokens
    text = re.sub(
        r"(?i)\b(?:Bitcoin|BTC|Ethereum|ETH|Dogecoin|DOGE|Solana|SOL|Cardano|ADA"
        r"|Ripple|XRP|Litecoin|LTC|Shiba Inu|SHIB|Polygon|MATIC)\b",
        "cryptocurrency",
        text,
    )
    # Replace named stocks
    text = re.sub(
        r"(?i)\b(?:Reliance|Infosys|TCS|Wipro|HDFC Bank|ICICI Bank|SBI|Adani|Tata Motors"
        r"|Bajaj Finance|HUL|ITC|Maruti|Asian Paints|Bharti Airtel)\s*(?:stock|share|Ltd|Limited)?\b",
        "equity investments",
        text,
    )
    return text


def _format_inr(amount: float) -> str:
    """Format amount in Indian Rupee notation with comma grouping."""
    if amount < 0:
        return f"-₹{_format_inr_positive(-amount)[1:]}"
    return _format_inr_positive(amount)


def _format_inr_positive(amount: float) -> str:
    """Format positive amount in Indian Rupee comma style (₹1,20,000)."""
    amount_int = int(round(amount))
    s = str(amount_int)
    if len(s) <= 3:
        return f"₹{s}"
    # Indian grouping: last 3 digits, then groups of 2
    last_three = s[-3:]
    remaining = s[:-3]
    groups = []
    while remaining:
        groups.append(remaining[-2:])
        remaining = remaining[:-2]
    groups.reverse()
    return f"₹{','.join(groups)},{last_three}"


def _identify_missing_categories(request: RecommendRequest) -> list[str]:
    """Identify which data categories are missing from the request."""
    missing = []
    if request.monthly_income is None or request.monthly_income == 0:
        missing.append("income")
    if request.total_expenses is None:
        missing.append("expenses")
    if request.expenses_by_category is None or len(request.expenses_by_category) == 0:
        missing.append("expense_categories")
    if request.savings_rate is None:
        missing.append("savings_rate")
    if request.emi_amount is None:
        missing.append("emi_burden")
    if request.investment_amount is None:
        missing.append("investment_allocation")
    return missing


def _generate_savings_recommendation(
    monthly_income: float, savings_rate: float
) -> Recommendation | None:
    """Generate recommendation about savings rate."""
    if savings_rate < 0.20:
        target_rate = 0.20
        current_savings = monthly_income * savings_rate
        target_savings = monthly_income * target_rate
        increase_needed = target_savings - current_savings
        text = (
            f"Your current savings rate is {savings_rate * 100:.1f}% of your monthly income "
            f"of {_format_inr(monthly_income)}. Aim to save at least 20% of your income, "
            f"which means increasing your monthly savings by approximately "
            f"{_format_inr(increase_needed)}. Start by identifying one or two "
            f"non-essential expenses you can reduce."
        )
        return Recommendation(
            category="Savings",
            text=text,
            data_point_reference=f"Savings rate: {savings_rate * 100:.1f}%",
        )
    elif savings_rate >= 0.30:
        text = (
            f"Your savings rate of {savings_rate * 100:.1f}% is excellent — well above "
            f"the recommended 20% minimum. Consider directing a portion of your surplus "
            f"savings of {_format_inr(monthly_income * (savings_rate - 0.20))} "
            f"into long-term wealth-building instruments like equity or debt funds."
        )
        return Recommendation(
            category="Savings",
            text=text,
            data_point_reference=f"Savings rate: {savings_rate * 100:.1f}%",
        )
    return None


def _generate_food_recommendation(
    food_expense: float, total_expenses: float, monthly_income: float
) -> Recommendation | None:
    """Generate recommendation about food spending if high."""
    if total_expenses <= 0:
        return None
    food_pct = food_expense / total_expenses * 100
    if food_pct > 20:
        target_pct = 15.0
        target_amount = total_expenses * target_pct / 100
        potential_saving = food_expense - target_amount
        text = (
            f"Your food spending of {_format_inr(food_expense)} accounts for "
            f"{food_pct:.1f}% of your total expenses. The recommended range is "
            f"15-20%. Reducing dining out by 2-3 times per week could save you "
            f"approximately {_format_inr(potential_saving)} per month."
        )
        return Recommendation(
            category="Food",
            text=text,
            data_point_reference=f"Food expense: {_format_inr(food_expense)} ({food_pct:.1f}% of total expenses)",
        )
    return None


def _generate_emi_recommendation(
    emi_amount: float, monthly_income: float
) -> Recommendation | None:
    """Generate recommendation about EMI burden."""
    if monthly_income <= 0:
        return None
    emi_ratio = emi_amount / monthly_income
    if emi_ratio > 0.40:
        target_ratio = 0.30
        target_emi = monthly_income * target_ratio
        reduction_needed = emi_amount - target_emi
        text = (
            f"Your EMI payments (Equated Monthly Installments — fixed monthly loan "
            f"repayments) of {_format_inr(emi_amount)} consume {emi_ratio * 100:.1f}% "
            f"of your income. Financial experts recommend keeping EMI burden below 30-40%. "
            f"Consider prepaying high-interest loans to reduce your EMI outflow by "
            f"{_format_inr(reduction_needed)}."
        )
        return Recommendation(
            category="EMI Burden",
            text=text,
            data_point_reference=f"EMI: {_format_inr(emi_amount)} ({emi_ratio * 100:.1f}% of income)",
        )
    elif emi_ratio > 0.20:
        text = (
            f"Your EMI payments of {_format_inr(emi_amount)} are {emi_ratio * 100:.1f}% "
            f"of your income — within acceptable limits but worth monitoring. "
            f"Avoid taking on additional loan commitments until existing EMIs reduce."
        )
        return Recommendation(
            category="EMI Burden",
            text=text,
            data_point_reference=f"EMI: {_format_inr(emi_amount)} ({emi_ratio * 100:.1f}% of income)",
        )
    return None


def _generate_investment_recommendation(
    investment_amount: float, monthly_income: float
) -> Recommendation | None:
    """Generate recommendation about investment allocation."""
    if monthly_income <= 0:
        return None
    invest_ratio = investment_amount / monthly_income
    if invest_ratio < 0.10:
        target_amount = monthly_income * 0.15
        increase_needed = target_amount - investment_amount
        text = (
            f"Your current investment allocation is {_format_inr(investment_amount)}, "
            f"which is only {invest_ratio * 100:.1f}% of your income. Aim for at least "
            f"15-20% of income in investments. Consider starting a SIP (Systematic "
            f"Investment Plan — a method of investing a fixed amount regularly) of "
            f"{_format_inr(increase_needed)} per month to build long-term wealth."
        )
        return Recommendation(
            category="Investments",
            text=text,
            data_point_reference=f"Investment: {_format_inr(investment_amount)} ({invest_ratio * 100:.1f}% of income)",
        )
    elif invest_ratio < 0.20:
        target_amount = monthly_income * 0.20
        increase_needed = target_amount - investment_amount
        text = (
            f"You are investing {_format_inr(investment_amount)} ({invest_ratio * 100:.1f}% "
            f"of income). Good start! Increase by {_format_inr(increase_needed)} to reach "
            f"the recommended 20% allocation for optimal long-term wealth creation."
        )
        return Recommendation(
            category="Investments",
            text=text,
            data_point_reference=f"Investment: {_format_inr(investment_amount)} ({invest_ratio * 100:.1f}% of income)",
        )
    return None


def _generate_shopping_recommendation(
    shopping_expense: float, total_expenses: float
) -> Recommendation | None:
    """Generate recommendation about shopping/discretionary spending."""
    if total_expenses <= 0:
        return None
    shopping_pct = shopping_expense / total_expenses * 100
    if shopping_pct > 15:
        target_amount = total_expenses * 0.10
        potential_saving = shopping_expense - target_amount
        text = (
            f"Your shopping expenses of {_format_inr(shopping_expense)} represent "
            f"{shopping_pct:.1f}% of your total spending. Try implementing a 48-hour "
            f"rule for non-essential purchases — wait 48 hours before buying items over "
            f"₹2,000. This could help you save up to {_format_inr(potential_saving)} monthly."
        )
        return Recommendation(
            category="Shopping",
            text=text,
            data_point_reference=f"Shopping: {_format_inr(shopping_expense)} ({shopping_pct:.1f}% of expenses)",
        )
    return None


def _generate_entertainment_recommendation(
    entertainment_expense: float, total_expenses: float
) -> Recommendation | None:
    """Generate recommendation about entertainment spending."""
    if total_expenses <= 0:
        return None
    ent_pct = entertainment_expense / total_expenses * 100
    if ent_pct > 10:
        target_amount = total_expenses * 0.07
        potential_saving = entertainment_expense - target_amount
        text = (
            f"Entertainment spending of {_format_inr(entertainment_expense)} is "
            f"{ent_pct:.1f}% of your expenses. Consider reviewing subscriptions you "
            f"may not actively use. Reducing by {_format_inr(potential_saving)} could "
            f"free up funds for savings or investment."
        )
        return Recommendation(
            category="Entertainment",
            text=text,
            data_point_reference=f"Entertainment: {_format_inr(entertainment_expense)} ({ent_pct:.1f}% of expenses)",
        )
    return None


def _generate_emergency_fund_recommendation(
    monthly_income: float, total_expenses: float, savings_rate: float
) -> Recommendation | None:
    """Generate recommendation about building an emergency fund."""
    if total_expenses <= 0 or monthly_income <= 0:
        return None
    monthly_savings = monthly_income * savings_rate
    target_fund = total_expenses * 6
    text = (
        f"Aim to build an emergency fund (a reserve of money for unexpected expenses "
        f"like medical bills or job loss) equal to 6 months of expenses, which for you "
        f"would be {_format_inr(target_fund)}. With your current monthly savings of "
        f"{_format_inr(monthly_savings)}, you can reach this target in approximately "
        f"{int(target_fund / monthly_savings) if monthly_savings > 0 else 'many'} months."
    )
    return Recommendation(
        category="Emergency Fund",
        text=text,
        data_point_reference=f"Monthly expenses: {_format_inr(total_expenses)}",
    )


def _generate_rent_recommendation(
    rent_expense: float, monthly_income: float
) -> Recommendation | None:
    """Generate recommendation about rent if it's high relative to income."""
    if monthly_income <= 0:
        return None
    rent_ratio = rent_expense / monthly_income
    if rent_ratio > 0.30:
        target_rent = monthly_income * 0.25
        excess = rent_expense - target_rent
        text = (
            f"Your rent of {_format_inr(rent_expense)} is {rent_ratio * 100:.1f}% of your "
            f"income. Financial guidelines suggest keeping housing costs under 25-30% of "
            f"income. If possible, exploring more affordable housing options could save you "
            f"{_format_inr(excess)} monthly."
        )
        return Recommendation(
            category="Rent",
            text=text,
            data_point_reference=f"Rent: {_format_inr(rent_expense)} ({rent_ratio * 100:.1f}% of income)",
        )
    return None


def _generate_travel_recommendation(
    travel_expense: float, total_expenses: float
) -> Recommendation | None:
    """Generate recommendation about travel spending."""
    if total_expenses <= 0:
        return None
    travel_pct = travel_expense / total_expenses * 100
    if travel_pct > 10:
        target_amount = total_expenses * 0.07
        potential_saving = travel_expense - target_amount
        text = (
            f"Your travel and commute costs of {_format_inr(travel_expense)} make up "
            f"{travel_pct:.1f}% of your expenses. Consider carpooling, using public "
            f"transport, or consolidating trips to potentially save "
            f"{_format_inr(potential_saving)} per month."
        )
        return Recommendation(
            category="Travel",
            text=text,
            data_point_reference=f"Travel: {_format_inr(travel_expense)} ({travel_pct:.1f}% of expenses)",
        )
    return None


def _generate_general_budgeting_recommendation(
    monthly_income: float, total_expenses: float
) -> Recommendation:
    """Generate a general budgeting recommendation (always applicable)."""
    expense_ratio = total_expenses / monthly_income if monthly_income > 0 else 1.0
    text = (
        f"Your total monthly expenses of {_format_inr(total_expenses)} are "
        f"{expense_ratio * 100:.1f}% of your income of {_format_inr(monthly_income)}. "
        f"Consider following the 50-30-20 rule: allocate 50% to needs "
        f"({_format_inr(monthly_income * 0.50)}), 30% to wants "
        f"({_format_inr(monthly_income * 0.30)}), and 20% to savings and investments "
        f"({_format_inr(monthly_income * 0.20)})."
    )
    return Recommendation(
        category="Budgeting",
        text=text,
        data_point_reference=f"Total expenses: {_format_inr(total_expenses)} ({expense_ratio * 100:.1f}% of income)",
    )


def generate_recommendations(request: RecommendRequest) -> RecommendResponse:
    """Generate personalized financial recommendations.

    Produces 3-7 recommendations based on available financial data.
    Each recommendation references specific numeric data points and
    uses plain language with inline explanations for financial terms.
    """
    missing_categories = _identify_missing_categories(request)

    # Use defaults for missing values
    monthly_income = request.monthly_income or 0.0
    total_expenses = request.total_expenses or 0.0
    expenses_by_category = request.expenses_by_category or {}
    savings_rate = request.savings_rate if request.savings_rate is not None else (
        (monthly_income - total_expenses) / monthly_income if monthly_income > 0 else 0.0
    )
    emi_amount = request.emi_amount if request.emi_amount is not None else expenses_by_category.get("EMI", 0.0)
    investment_amount = request.investment_amount if request.investment_amount is not None else expenses_by_category.get("Investments", 0.0)

    recommendations: list[Recommendation] = []

    # Generate recommendations from each category
    if monthly_income > 0:
        # Savings recommendation
        rec = _generate_savings_recommendation(monthly_income, savings_rate)
        if rec:
            recommendations.append(rec)

        # EMI recommendation
        if emi_amount > 0:
            rec = _generate_emi_recommendation(emi_amount, monthly_income)
            if rec:
                recommendations.append(rec)

        # Investment recommendation
        rec = _generate_investment_recommendation(investment_amount, monthly_income)
        if rec:
            recommendations.append(rec)

        # Rent recommendation
        rent_expense = expenses_by_category.get("Rent", 0.0)
        if rent_expense > 0:
            rec = _generate_rent_recommendation(rent_expense, monthly_income)
            if rec:
                recommendations.append(rec)

    if total_expenses > 0:
        # Food recommendation
        food_expense = expenses_by_category.get("Food", 0.0)
        if food_expense > 0:
            rec = _generate_food_recommendation(food_expense, total_expenses, monthly_income)
            if rec:
                recommendations.append(rec)

        # Shopping recommendation
        shopping_expense = expenses_by_category.get("Shopping", 0.0)
        if shopping_expense > 0:
            rec = _generate_shopping_recommendation(shopping_expense, total_expenses)
            if rec:
                recommendations.append(rec)

        # Entertainment recommendation
        entertainment_expense = expenses_by_category.get("Entertainment", 0.0)
        if entertainment_expense > 0:
            rec = _generate_entertainment_recommendation(entertainment_expense, total_expenses)
            if rec:
                recommendations.append(rec)

        # Travel recommendation
        travel_expense = expenses_by_category.get("Travel", 0.0)
        if travel_expense > 0:
            rec = _generate_travel_recommendation(travel_expense, total_expenses)
            if rec:
                recommendations.append(rec)

    # Emergency fund recommendation
    if monthly_income > 0 and total_expenses > 0 and savings_rate > 0:
        rec = _generate_emergency_fund_recommendation(monthly_income, total_expenses, savings_rate)
        if rec:
            recommendations.append(rec)

    # General budgeting (always generated if income and expenses are available)
    if monthly_income > 0 and total_expenses > 0:
        recommendations.append(
            _generate_general_budgeting_recommendation(monthly_income, total_expenses)
        )

    # Ensure we have at least 3 recommendations
    # If we don't have enough, add more generic ones
    if len(recommendations) < 3 and monthly_income > 0:
        # Add emergency fund if not already present
        categories_used = {r.category for r in recommendations}
        if "Emergency Fund" not in categories_used and total_expenses > 0:
            rec = _generate_emergency_fund_recommendation(
                monthly_income, total_expenses, savings_rate if savings_rate > 0 else 0.10
            )
            if rec:
                recommendations.append(rec)

        if len(recommendations) < 3 and "Budgeting" not in categories_used:
            recommendations.append(
                _generate_general_budgeting_recommendation(monthly_income, total_expenses)
            )

        # If still not enough, add a generic health score improvement recommendation
        if len(recommendations) < 3:
            recommendations.append(
                Recommendation(
                    category="Financial Health",
                    text=(
                        f"With a monthly income of {_format_inr(monthly_income)}, "
                        f"focus on automating your savings by setting up an auto-debit "
                        f"on salary day. Even saving {_format_inr(monthly_income * 0.10)} "
                        f"(10% of income) consistently will compound significantly over time."
                    ),
                    data_point_reference=f"Monthly income: {_format_inr(monthly_income)}",
                )
            )

    # Cap at 7 recommendations maximum
    recommendations = recommendations[:7]

    # Ensure minimum of 3 — if still fewer (edge case: no income/expense data at all)
    if len(recommendations) < 3:
        # Generate very basic recommendations from whatever data is available
        if total_expenses > 0:
            recommendations.append(
                Recommendation(
                    category="Expense Tracking",
                    text=(
                        f"Your total monthly expenses are {_format_inr(total_expenses)}. "
                        f"Start tracking daily expenses using a budget app or spreadsheet "
                        f"to identify patterns and potential savings opportunities."
                    ),
                    data_point_reference=f"Total expenses: {_format_inr(total_expenses)}",
                )
            )
        while len(recommendations) < 3:
            income_display = _format_inr(monthly_income) if monthly_income > 0 else "not available"
            expense_display = _format_inr(total_expenses) if total_expenses > 0 else "not available"
            if len(recommendations) == 0:
                recommendations.append(
                    Recommendation(
                        category="Data Completeness",
                        text=(
                            f"Your income data shows {income_display} and expense data "
                            f"shows {expense_display}. Upload additional financial documents "
                            f"for more personalized recommendations."
                        ),
                        data_point_reference=f"Income: {income_display}, Expenses: {expense_display}",
                    )
                )
            elif len(recommendations) == 1:
                recommendations.append(
                    Recommendation(
                        category="Financial Planning",
                        text=(
                            f"Based on your available data showing expenses of {expense_display}, "
                            f"create a monthly budget that categorizes all spending. This helps "
                            f"identify areas where you can reduce costs."
                        ),
                        data_point_reference=f"Expenses: {expense_display}",
                    )
                )
            else:
                recommendations.append(
                    Recommendation(
                        category="Goal Setting",
                        text=(
                            "Set at least one specific financial goal with a target amount "
                            "and timeline. Having a concrete goal increases savings motivation. "
                            f"Your current financial data shows income of {income_display}."
                        ),
                        data_point_reference=f"Income: {income_display}",
                    )
                )

    # Sanitize all recommendations to remove specific financial instrument names
    sanitized_recommendations = []
    for rec in recommendations:
        sanitized_text = _sanitize_recommendation_text(rec.text)
        sanitized_recommendations.append(
            Recommendation(
                category=rec.category,
                text=sanitized_text,
                data_point_reference=rec.data_point_reference,
            )
        )

    return RecommendResponse(
        recommendations=sanitized_recommendations,
        count=len(sanitized_recommendations),
        disclaimer=DISCLAIMER,
        missing_data_categories=missing_categories,
    )
