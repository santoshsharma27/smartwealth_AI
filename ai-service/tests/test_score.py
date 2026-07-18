"""Unit tests for Financial Health Score endpoint POST /ai/score."""

import pytest
from fastapi.testclient import TestClient

from main import app
from models.score import ScoreRequest
from services.scorer import (
    _calculate_emergency_fund,
    _calculate_emi_burden,
    _calculate_expense_control,
    _calculate_investment_allocation,
    _calculate_savings_ratio,
    _get_status_label,
    calculate_health_score,
)

client = TestClient(app)


# --- Status Label Mapping Tests ---


class TestStatusLabel:
    def test_needs_attention_lower_bound(self):
        assert _get_status_label(0) == "Needs Attention"

    def test_needs_attention_upper_bound(self):
        assert _get_status_label(30) == "Needs Attention"

    def test_fair_lower_bound(self):
        assert _get_status_label(31) == "Fair"

    def test_fair_upper_bound(self):
        assert _get_status_label(50) == "Fair"

    def test_good_lower_bound(self):
        assert _get_status_label(51) == "Good"

    def test_good_upper_bound(self):
        assert _get_status_label(70) == "Good"

    def test_very_good_lower_bound(self):
        assert _get_status_label(71) == "Very Good"

    def test_very_good_upper_bound(self):
        assert _get_status_label(85) == "Very Good"

    def test_excellent_lower_bound(self):
        assert _get_status_label(86) == "Excellent"

    def test_excellent_upper_bound(self):
        assert _get_status_label(100) == "Excellent"


# --- Savings Ratio Component Tests ---


class TestSavingsRatio:
    def test_zero_savings(self):
        """0% savings → 0 points."""
        result = _calculate_savings_ratio(100000, 100000)
        assert result.score == 0

    def test_max_savings(self):
        """30% savings → 30 points."""
        result = _calculate_savings_ratio(100000, 70000)
        assert result.score == 30

    def test_above_max_savings(self):
        """50% savings → still capped at 30 points."""
        result = _calculate_savings_ratio(100000, 50000)
        assert result.score == 30

    def test_proportional_15_percent(self):
        """15% savings → 15 points (half of 30)."""
        result = _calculate_savings_ratio(100000, 85000)
        assert result.score == 15

    def test_expenses_exceed_income(self):
        """Negative savings → 0 points."""
        result = _calculate_savings_ratio(100000, 120000)
        assert result.score == 0


# --- Expense Control Component Tests ---


class TestExpenseControl:
    def test_zero_discretionary(self):
        """0% discretionary → 25 points."""
        expenses = {"Rent": 50000, "Bills": 20000, "EMI": 10000}
        result = _calculate_expense_control(expenses, 80000)
        assert result.score == 25

    def test_full_discretionary(self):
        """100% discretionary → 0 points."""
        expenses = {"Food": 30000, "Shopping": 20000, "Entertainment": 10000, "Travel": 10000}
        result = _calculate_expense_control(expenses, 70000)
        assert result.score == 0

    def test_30_percent_discretionary(self):
        """30% discretionary → 25 points (threshold)."""
        expenses = {"Food": 15000, "Shopping": 9000, "Rent": 56000}
        result = _calculate_expense_control(expenses, 80000)
        assert result.score == 25

    def test_zero_expenses(self):
        """No expenses → 25 points (perfect control)."""
        result = _calculate_expense_control({}, 0)
        assert result.score == 25

    def test_proportional_65_percent(self):
        """65% discretionary is between 30% and 100% → proportional score."""
        expenses = {"Food": 32500, "Shopping": 32500, "Rent": 35000}
        result = _calculate_expense_control(expenses, 100000)
        assert 0 <= result.score <= 25


# --- EMI Burden Component Tests ---


class TestEmiBurden:
    def test_zero_emi(self):
        """0% EMI → 15 points."""
        expenses = {"Rent": 30000}
        result = _calculate_emi_burden(expenses, 100000)
        assert result.score == 15

    def test_50_percent_emi(self):
        """50% EMI → 0 points."""
        expenses = {"EMI": 50000}
        result = _calculate_emi_burden(expenses, 100000)
        assert result.score == 0

    def test_above_50_percent_emi(self):
        """60% EMI → 0 points (capped)."""
        expenses = {"EMI": 60000}
        result = _calculate_emi_burden(expenses, 100000)
        assert result.score == 0

    def test_proportional_25_percent_emi(self):
        """25% EMI → 7 or 8 points (half of 15)."""
        expenses = {"EMI": 25000}
        result = _calculate_emi_burden(expenses, 100000)
        assert result.score == 8  # round((1 - 0.25/0.5) * 15) = round(7.5) = 8


# --- Investment Allocation Component Tests ---


class TestInvestmentAllocation:
    def test_zero_investment(self):
        """0% investment → 0 points."""
        expenses = {"Rent": 50000}
        result = _calculate_investment_allocation(expenses, 100000)
        assert result.score == 0

    def test_20_percent_investment(self):
        """20% investment → 15 points."""
        expenses = {"Investments": 20000}
        result = _calculate_investment_allocation(expenses, 100000)
        assert result.score == 15

    def test_above_20_percent_investment(self):
        """30% investment → capped at 15 points."""
        expenses = {"Investments": 30000}
        result = _calculate_investment_allocation(expenses, 100000)
        assert result.score == 15

    def test_proportional_10_percent(self):
        """10% investment → 8 points."""
        expenses = {"Investments": 10000}
        result = _calculate_investment_allocation(expenses, 100000)
        assert result.score == 8  # round(0.10 / 0.20 * 15) = round(7.5) = 8


# --- Emergency Fund Readiness Component Tests ---


class TestEmergencyFund:
    def test_zero_savings_balance(self):
        """0 months coverage → 0 points."""
        result = _calculate_emergency_fund(0, 50000)
        assert result.score == 0

    def test_six_months_coverage(self):
        """6 months coverage → 15 points."""
        result = _calculate_emergency_fund(300000, 50000)
        assert result.score == 15

    def test_above_six_months(self):
        """12 months coverage → 15 points (capped)."""
        result = _calculate_emergency_fund(600000, 50000)
        assert result.score == 15

    def test_three_months_coverage(self):
        """3 months coverage → 8 points."""
        result = _calculate_emergency_fund(150000, 50000)
        assert result.score == 8  # round(3/6 * 15) = round(7.5) = 8

    def test_zero_expenses_with_savings(self):
        """No expenses but has savings → full coverage."""
        result = _calculate_emergency_fund(100000, 0)
        assert result.score == 15

    def test_zero_expenses_no_savings(self):
        """No expenses and no savings → 0 points."""
        result = _calculate_emergency_fund(0, 0)
        assert result.score == 0


# --- Full Score Calculation Tests ---


class TestCalculateHealthScore:
    def test_zero_income(self):
        """Zero income → score 0 with reason."""
        request = ScoreRequest(
            monthlyIncome=0,
            totalExpenses=0,
            expensesByCategory={},
            cumulativeSavingsBalance=0,
            monthsOfData=1,
        )
        result = calculate_health_score(request)
        assert result.total_score == 0
        assert result.status == "Needs Attention"
        assert result.reason is not None
        assert "insufficient" in result.reason.lower() or "income" in result.reason.lower()

    def test_perfect_score(self):
        """Ideal financial profile → high score (near 100)."""
        request = ScoreRequest(
            monthlyIncome=100000,
            totalExpenses=60000,
            expensesByCategory={
                "Rent": 25000,
                "Bills": 10000,
                "Healthcare": 5000,
                "Investments": 20000,
            },
            cumulativeSavingsBalance=500000,
            monthsOfData=3,
        )
        result = calculate_health_score(request)
        assert result.total_score >= 86
        assert result.status == "Excellent"
        assert result.reason is None

    def test_component_sum_equals_total(self):
        """Sum of all component scores equals total score."""
        request = ScoreRequest(
            monthlyIncome=120000,
            totalExpenses=78000,
            expensesByCategory={
                "Rent": 25000,
                "Food": 18500,
                "Travel": 5000,
                "Shopping": 8000,
                "Bills": 6000,
                "EMI": 10000,
                "Healthcare": 2000,
                "Entertainment": 3500,
            },
            cumulativeSavingsBalance=280000,
            monthsOfData=3,
        )
        result = calculate_health_score(request)
        component_sum = sum(c.score for c in result.components.values())
        assert component_sum == result.total_score

    def test_score_bounded_0_100(self):
        """Score is always between 0 and 100."""
        request = ScoreRequest(
            monthlyIncome=50000,
            totalExpenses=80000,
            expensesByCategory={"Food": 40000, "Shopping": 30000, "EMI": 10000},
            cumulativeSavingsBalance=0,
            monthsOfData=1,
        )
        result = calculate_health_score(request)
        assert 0 <= result.total_score <= 100


# --- API Endpoint Integration Tests ---


class TestScoreEndpoint:
    def test_post_score_success(self):
        """POST /ai/score returns a valid score response."""
        payload = {
            "monthlyIncome": 120000,
            "totalExpenses": 78000,
            "expensesByCategory": {
                "Rent": 25000,
                "Food": 18500,
                "Travel": 5000,
                "Shopping": 8000,
                "Bills": 6000,
                "EMI": 10000,
                "Healthcare": 2000,
                "Entertainment": 3500,
            },
            "cumulativeSavingsBalance": 280000,
            "monthsOfData": 3,
        }
        response = client.post("/ai/score", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "totalScore" in data
        assert "status" in data
        assert "components" in data
        assert 0 <= data["totalScore"] <= 100
        assert data["status"] in [
            "Needs Attention", "Fair", "Good", "Very Good", "Excellent"
        ]
        # Check all 5 components present
        assert "savingsRatio" in data["components"]
        assert "expenseControl" in data["components"]
        assert "emiBurden" in data["components"]
        assert "investmentAllocation" in data["components"]
        assert "emergencyFundReadiness" in data["components"]

    def test_post_score_zero_income(self):
        """POST /ai/score with zero income returns score 0 with reason."""
        payload = {
            "monthlyIncome": 0,
            "totalExpenses": 0,
            "expensesByCategory": {},
            "cumulativeSavingsBalance": 0,
            "monthsOfData": 1,
        }
        response = client.post("/ai/score", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["totalScore"] == 0
        assert data["status"] == "Needs Attention"
        assert data["reason"] is not None

    def test_post_score_invalid_category(self):
        """POST /ai/score with invalid category returns 422."""
        payload = {
            "monthlyIncome": 100000,
            "totalExpenses": 50000,
            "expensesByCategory": {"InvalidCategory": 5000},
            "cumulativeSavingsBalance": 100000,
            "monthsOfData": 1,
        }
        response = client.post("/ai/score", json=payload)
        assert response.status_code == 422

    def test_post_score_missing_required_field(self):
        """POST /ai/score with missing field returns 422."""
        payload = {
            "monthlyIncome": 100000,
            # missing totalExpenses
            "expensesByCategory": {},
            "cumulativeSavingsBalance": 0,
            "monthsOfData": 1,
        }
        response = client.post("/ai/score", json=payload)
        assert response.status_code == 422

    def test_demo_data_scenario(self):
        """Test with the exact demo data from requirements (₹120k income)."""
        payload = {
            "monthlyIncome": 120000,
            "totalExpenses": 78000,
            "expensesByCategory": {
                "Rent": 25000,
                "Food": 18500,
                "Travel": 5000,
                "Shopping": 8000,
                "Bills": 6000,
                "EMI": 10000,
                "Healthcare": 2000,
                "Entertainment": 3500,
                "Investments": 15000,
            },
            "cumulativeSavingsBalance": 280000,
            "monthsOfData": 3,
        }
        response = client.post("/ai/score", json=payload)
        assert response.status_code == 200
        data = response.json()
        # Score should be reasonable for this demo data
        assert 50 <= data["totalScore"] <= 85
        # Component sum should equal total
        component_sum = sum(c["score"] for c in data["components"].values())
        assert component_sum == data["totalScore"]
