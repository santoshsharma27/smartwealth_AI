"""Core Financial Health Score calculation logic.

Calculates a score from 0 to 100 based on five weighted components:
- Savings Ratio (0–30 points)
- Expense Control (0–25 points)
- EMI Burden (0–15 points)
- Investment Allocation (0–15 points)
- Emergency Fund Readiness (0–15 points)
"""

from models.score import ScoreComponentDetail, ScoreRequest, ScoreResponse, StatusLabel


def _get_status_label(total_score: int) -> StatusLabel:
    """Map total score to a status label.

    0–30: "Needs Attention"
    31–50: "Fair"
    51–70: "Good"
    71–85: "Very Good"
    86–100: "Excellent"
    """
    if total_score <= 30:
        return "Needs Attention"
    elif total_score <= 50:
        return "Fair"
    elif total_score <= 70:
        return "Good"
    elif total_score <= 85:
        return "Very Good"
    else:
        return "Excellent"


def _calculate_savings_ratio(monthly_income: float, total_expenses: float) -> ScoreComponentDetail:
    """Calculate Savings Ratio component (max 30 points).

    savings_ratio = (monthly_income - total_expenses) / monthly_income
    score = min(30, round(savings_ratio / 0.30 * 30))
    At 0% savings → 0 points, at ≥30% savings → 30 points, proportional between.
    """
    savings_ratio = (monthly_income - total_expenses) / monthly_income
    # Clamp ratio to [0, 1] to handle cases where expenses exceed income
    savings_ratio = max(0.0, min(1.0, savings_ratio))
    score = min(30, round(savings_ratio / 0.30 * 30))
    score = max(0, score)
    return ScoreComponentDetail(score=score, max_score=30, ratio=round(savings_ratio, 4))


def _calculate_expense_control(
    expenses_by_category: dict[str, float], total_expenses: float
) -> ScoreComponentDetail:
    """Calculate Expense Control component (max 25 points).

    discretionary = sum of Shopping + Entertainment + Travel + Food
    discretionary_ratio = discretionary / total_expenses
    At ≤30% discretionary → 25 points, at 100% discretionary → 0 points, proportional between.
    """
    if total_expenses <= 0:
        # No expenses means perfect expense control
        return ScoreComponentDetail(score=25, max_score=25, ratio=0.0)

    discretionary_categories = ["Shopping", "Entertainment", "Travel", "Food"]
    discretionary = sum(
        expenses_by_category.get(cat, 0.0) for cat in discretionary_categories
    )
    discretionary_ratio = discretionary / total_expenses
    discretionary_ratio = max(0.0, min(1.0, discretionary_ratio))

    if discretionary_ratio <= 0.30:
        score = 25
    else:
        # Proportional: from 25 at 30% down to 0 at 100%
        score = round((1 - (discretionary_ratio - 0.30) / 0.70) * 25)
        score = max(0, min(25, score))

    return ScoreComponentDetail(score=score, max_score=25, ratio=round(discretionary_ratio, 4))


def _calculate_emi_burden(
    expenses_by_category: dict[str, float], monthly_income: float
) -> ScoreComponentDetail:
    """Calculate EMI Burden component (max 15 points).

    emi_ratio = emi_amount / monthly_income
    At 0% EMI → 15 points, at ≥50% EMI → 0 points, proportional between.
    """
    emi_amount = expenses_by_category.get("EMI", 0.0)
    emi_ratio = emi_amount / monthly_income
    emi_ratio = max(0.0, min(1.0, emi_ratio))

    if emi_ratio >= 0.50:
        score = 0
    else:
        score = round((1 - emi_ratio / 0.50) * 15)
        score = max(0, min(15, score))

    return ScoreComponentDetail(score=score, max_score=15, ratio=round(emi_ratio, 4))


def _calculate_investment_allocation(
    expenses_by_category: dict[str, float], monthly_income: float
) -> ScoreComponentDetail:
    """Calculate Investment Allocation component (max 15 points).

    investment_ratio = investment_amount / monthly_income
    At 0% investment → 0 points, at ≥20% investment → 15 points, proportional between.
    """
    investment_amount = expenses_by_category.get("Investments", 0.0)
    investment_ratio = investment_amount / monthly_income
    investment_ratio = max(0.0, min(1.0, investment_ratio))

    score = min(15, round(investment_ratio / 0.20 * 15))
    score = max(0, score)

    return ScoreComponentDetail(score=score, max_score=15, ratio=round(investment_ratio, 4))


def _calculate_emergency_fund(
    cumulative_savings_balance: float, total_expenses: float
) -> ScoreComponentDetail:
    """Calculate Emergency Fund Readiness component (max 15 points).

    months_coverage = cumulative_savings_balance / avg_monthly_expenses
    At 0 months → 0 points, at ≥6 months → 15 points, proportional between.
    """
    if total_expenses <= 0:
        # If no expenses, any savings gives full coverage
        if cumulative_savings_balance > 0:
            return ScoreComponentDetail(score=15, max_score=15, ratio=6.0)
        return ScoreComponentDetail(score=0, max_score=15, ratio=0.0)

    months_coverage = cumulative_savings_balance / total_expenses
    months_coverage = max(0.0, months_coverage)

    score = min(15, round(months_coverage / 6.0 * 15))
    score = max(0, score)

    return ScoreComponentDetail(score=score, max_score=15, ratio=round(months_coverage, 4))


def calculate_health_score(request: ScoreRequest) -> ScoreResponse:
    """Calculate the Financial Health Score from the given financial data.

    Returns a ScoreResponse with total score (0-100), status label,
    and individual component breakdowns.

    If monthly income is zero, returns score 0 with all components at 0
    and a reason indicating insufficient income data.
    """
    # Handle zero income case
    if request.monthly_income == 0:
        zero_components = {
            "savingsRatio": ScoreComponentDetail(score=0, max_score=30, ratio=0.0),
            "expenseControl": ScoreComponentDetail(score=0, max_score=25, ratio=0.0),
            "emiBurden": ScoreComponentDetail(score=0, max_score=15, ratio=0.0),
            "investmentAllocation": ScoreComponentDetail(score=0, max_score=15, ratio=0.0),
            "emergencyFundReadiness": ScoreComponentDetail(score=0, max_score=15, ratio=0.0),
        }
        return ScoreResponse(
            total_score=0,
            status="Needs Attention",
            components=zero_components,
            reason="Insufficient income data available for score calculation.",
        )

    # Calculate each component
    savings_ratio = _calculate_savings_ratio(request.monthly_income, request.total_expenses)
    expense_control = _calculate_expense_control(
        request.expenses_by_category, request.total_expenses
    )
    emi_burden = _calculate_emi_burden(request.expenses_by_category, request.monthly_income)
    investment_alloc = _calculate_investment_allocation(
        request.expenses_by_category, request.monthly_income
    )
    emergency_fund = _calculate_emergency_fund(
        request.cumulative_savings_balance, request.total_expenses
    )

    # Sum components for total score
    total_score = (
        savings_ratio.score
        + expense_control.score
        + emi_burden.score
        + investment_alloc.score
        + emergency_fund.score
    )
    # Clamp total to [0, 100]
    total_score = max(0, min(100, total_score))

    status = _get_status_label(total_score)

    components = {
        "savingsRatio": savings_ratio,
        "expenseControl": expense_control,
        "emiBurden": emi_burden,
        "investmentAllocation": investment_alloc,
        "emergencyFundReadiness": emergency_fund,
    }

    return ScoreResponse(
        total_score=total_score,
        status=status,
        components=components,
    )
