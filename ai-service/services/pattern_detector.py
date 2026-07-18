"""Pattern detection service for recurring expenses and spending anomalies.

Detects:
1. Recurring expenses: transactions with matching descriptions (case-insensitive)
   and amounts within ±10%, appearing in ≥2 consecutive months.
2. Spending anomalies: transactions exceeding 2× the category average
   over the preceding 3 months.
"""

from collections import defaultdict
from datetime import datetime

from models.patterns import (
    DetectPatternsRequest,
    DetectPatternsResponse,
    PatternTransaction,
    RecurringExpense,
    SpendingAnomaly,
)


def _get_year_month(date_str: str) -> str:
    """Extract YYYY-MM from a date string."""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.strftime("%Y-%m")
    except ValueError:
        # Try alternate formats
        for fmt in ("%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"):
            try:
                dt = datetime.strptime(date_str, fmt)
                return dt.strftime("%Y-%m")
            except ValueError:
                continue
        # Fallback: try to extract first 7 chars if already YYYY-MM format
        if len(date_str) >= 7 and date_str[4] == "-":
            return date_str[:7]
        return "unknown"


def _amounts_within_tolerance(a: float, b: float, tolerance: float = 0.10) -> bool:
    """Check if two amounts are within ±tolerance (10%) of each other."""
    if a == 0 and b == 0:
        return True
    if a == 0 or b == 0:
        return False
    return abs(a - b) / max(abs(a), abs(b)) <= tolerance


def _get_sorted_months(months: set[str]) -> list[str]:
    """Sort month strings (YYYY-MM) chronologically."""
    return sorted(months)


def _find_max_consecutive(sorted_months: list[str]) -> int:
    """Find the maximum number of consecutive months in a sorted list of YYYY-MM strings."""
    if not sorted_months:
        return 0
    if len(sorted_months) == 1:
        return 1

    max_consecutive = 1
    current_consecutive = 1

    for i in range(1, len(sorted_months)):
        prev_year, prev_month = map(int, sorted_months[i - 1].split("-"))
        curr_year, curr_month = map(int, sorted_months[i].split("-"))

        # Check if months are consecutive
        expected_month = prev_month + 1
        expected_year = prev_year
        if expected_month > 12:
            expected_month = 1
            expected_year += 1

        if curr_year == expected_year and curr_month == expected_month:
            current_consecutive += 1
        else:
            max_consecutive = max(max_consecutive, current_consecutive)
            current_consecutive = 1

    max_consecutive = max(max_consecutive, current_consecutive)
    return max_consecutive


def _detect_recurring_expenses(
    transactions: list[PatternTransaction],
) -> list[RecurringExpense]:
    """Detect recurring expenses from transaction list.

    Groups transactions by normalized description (case-insensitive),
    checks that amounts are within ±10% of each other,
    and verifies they appear in at least 2 consecutive months.
    """
    # Group transactions by normalized description and month
    desc_month_map: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))

    for txn in transactions:
        normalized_desc = txn.description.strip().lower()
        month = _get_year_month(txn.date)
        if month == "unknown":
            continue
        desc_month_map[normalized_desc][month].append(txn.amount)

    recurring_expenses: list[RecurringExpense] = []

    for desc, month_amounts in desc_month_map.items():
        if len(month_amounts) < 2:
            continue

        # Get representative amount per month (average of amounts in that month)
        monthly_representatives: dict[str, float] = {}
        for month, amounts in month_amounts.items():
            monthly_representatives[month] = sum(amounts) / len(amounts)

        sorted_months = _get_sorted_months(set(monthly_representatives.keys()))

        # Find consecutive months where amounts are within ±10%
        # Build consecutive sequences checking amount tolerance
        best_consecutive = 0
        current_consecutive = 1
        all_amounts_in_sequence: list[float] = [monthly_representatives[sorted_months[0]]]

        for i in range(1, len(sorted_months)):
            prev_year, prev_month_val = map(int, sorted_months[i - 1].split("-"))
            curr_year, curr_month_val = map(int, sorted_months[i].split("-"))

            # Check if months are consecutive
            expected_month = prev_month_val + 1
            expected_year = prev_year
            if expected_month > 12:
                expected_month = 1
                expected_year += 1

            is_consecutive = curr_year == expected_year and curr_month_val == expected_month
            current_amount = monthly_representatives[sorted_months[i]]
            prev_amount = monthly_representatives[sorted_months[i - 1]]

            if is_consecutive and _amounts_within_tolerance(current_amount, prev_amount):
                current_consecutive += 1
                all_amounts_in_sequence.append(current_amount)
            else:
                if current_consecutive >= 2:
                    best_consecutive = max(best_consecutive, current_consecutive)
                    if best_consecutive == current_consecutive:
                        best_amounts = all_amounts_in_sequence[:]
                current_consecutive = 1
                all_amounts_in_sequence = [current_amount]

        # Check the last sequence
        if current_consecutive >= 2:
            if current_consecutive > best_consecutive:
                best_consecutive = current_consecutive
                best_amounts = all_amounts_in_sequence[:]
            elif best_consecutive < 2:
                best_consecutive = current_consecutive
                best_amounts = all_amounts_in_sequence[:]

        if best_consecutive >= 2:
            avg_amount = round(sum(best_amounts) / len(best_amounts), 2)
            # Get original-case description from first matching transaction
            original_desc = desc  # fallback
            for txn in transactions:
                if txn.description.strip().lower() == desc:
                    original_desc = txn.description.strip()
                    break

            recurring_expenses.append(
                RecurringExpense(
                    description=original_desc,
                    recurring_amount=avg_amount,
                    consecutive_months=best_consecutive,
                )
            )

    return recurring_expenses


def _detect_spending_anomalies(
    transactions: list[PatternTransaction],
) -> list[SpendingAnomaly]:
    """Detect spending anomalies from transaction list.

    A transaction is anomalous if its amount exceeds 2× the average
    transaction amount for the same category over the preceding 3 months.
    """
    # Group transactions by month and category
    month_cat_amounts: dict[str, dict[str, list[float]]] = defaultdict(
        lambda: defaultdict(list)
    )

    for txn in transactions:
        month = _get_year_month(txn.date)
        if month == "unknown":
            continue
        month_cat_amounts[month][txn.category].append(txn.amount)

    sorted_months = sorted(month_cat_amounts.keys())
    if len(sorted_months) < 2:
        return []

    anomalies: list[SpendingAnomaly] = []
    seen_anomalies: set[tuple[str, float, str]] = set()

    for txn in transactions:
        month = _get_year_month(txn.date)
        if month == "unknown":
            continue

        month_idx = sorted_months.index(month) if month in sorted_months else -1
        if month_idx < 0:
            continue

        # Get preceding months (up to 3)
        preceding_months = sorted_months[max(0, month_idx - 3) : month_idx]
        if not preceding_months:
            continue

        # Calculate category average over preceding months
        preceding_amounts: list[float] = []
        for prev_month in preceding_months:
            preceding_amounts.extend(
                month_cat_amounts[prev_month].get(txn.category, [])
            )

        if not preceding_amounts:
            continue

        category_avg = sum(preceding_amounts) / len(preceding_amounts)

        # Check if transaction exceeds 2× the category average
        if category_avg > 0 and txn.amount > 2 * category_avg:
            anomaly_key = (txn.description, txn.amount, txn.category)
            if anomaly_key not in seen_anomalies:
                seen_anomalies.add(anomaly_key)
                anomalies.append(
                    SpendingAnomaly(
                        description=txn.description,
                        transaction_amount=txn.amount,
                        category=txn.category,
                        category_average=round(category_avg, 2),
                    )
                )

    return anomalies


def detect_patterns(request: DetectPatternsRequest) -> DetectPatternsResponse:
    """Main entry point for pattern detection.

    If monthsOfData < 2, skips detection and returns empty results with a message.
    Otherwise, detects recurring expenses and spending anomalies.
    """
    if request.months_of_data < 2:
        return DetectPatternsResponse(
            recurring_expenses=[],
            spending_anomalies=[],
            message="Insufficient data: at least 2 months of transaction data are required to enable pattern detection.",
        )

    recurring = _detect_recurring_expenses(request.transactions)
    anomalies = _detect_spending_anomalies(request.transactions)

    return DetectPatternsResponse(
        recurring_expenses=recurring,
        spending_anomalies=anomalies,
        message=None,
    )
