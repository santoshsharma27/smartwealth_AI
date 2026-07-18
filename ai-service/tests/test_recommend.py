"""Tests for the recommendation engine endpoint POST /ai/recommend."""

import pytest
from fastapi.testclient import TestClient

from main import app
from services.recommender import (
    _contains_financial_instruments,
    _format_inr,
    _sanitize_recommendation_text,
    generate_recommendations,
)
from models.recommend import RecommendRequest


client = TestClient(app)


class TestRecommendEndpoint:
    """Integration tests for POST /ai/recommend."""

    def test_full_data_returns_recommendations(self):
        """With complete financial data, endpoint returns 3-7 recommendations."""
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
            "savingsRate": 0.35,
            "emiAmount": 10000,
            "investmentAmount": 15000,
        }
        response = client.post("/ai/recommend", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert 3 <= data["count"] <= 7
        assert len(data["recommendations"]) == data["count"]
        assert data["disclaimer"] != ""
        assert isinstance(data["missingDataCategories"], list)

    def test_each_recommendation_has_required_fields(self):
        """Each recommendation has category, text, and dataPointReference."""
        payload = {
            "monthlyIncome": 120000,
            "totalExpenses": 78000,
            "expensesByCategory": {
                "Rent": 25000,
                "Food": 18500,
                "Shopping": 8000,
                "EMI": 10000,
            },
            "savingsRate": 0.35,
            "emiAmount": 10000,
            "investmentAmount": 15000,
        }
        response = client.post("/ai/recommend", json=payload)
        data = response.json()
        for rec in data["recommendations"]:
            assert "category" in rec
            assert "text" in rec
            assert "dataPointReference" in rec
            assert len(rec["text"]) > 0
            assert len(rec["dataPointReference"]) > 0

    def test_recommendations_reference_numeric_data(self):
        """Each recommendation references at least one numeric data point."""
        payload = {
            "monthlyIncome": 120000,
            "totalExpenses": 78000,
            "expensesByCategory": {
                "Rent": 25000,
                "Food": 18500,
                "Shopping": 8000,
                "EMI": 10000,
            },
            "savingsRate": 0.35,
            "emiAmount": 10000,
            "investmentAmount": 15000,
        }
        response = client.post("/ai/recommend", json=payload)
        data = response.json()
        for rec in data["recommendations"]:
            # dataPointReference should contain a number (₹ or %)
            has_number = any(c.isdigit() for c in rec["dataPointReference"])
            assert has_number, f"No numeric data in reference: {rec['dataPointReference']}"

    def test_disclaimer_present(self):
        """Response includes a disclaimer about consulting a financial advisor."""
        payload = {
            "monthlyIncome": 120000,
            "totalExpenses": 78000,
            "expensesByCategory": {"Rent": 25000, "Food": 18500},
            "savingsRate": 0.35,
            "emiAmount": 10000,
            "investmentAmount": 15000,
        }
        response = client.post("/ai/recommend", json=payload)
        data = response.json()
        assert "financial advisor" in data["disclaimer"].lower()

    def test_partial_data_missing_categories_reported(self):
        """With partial data, missing categories are reported."""
        payload = {
            "monthlyIncome": 100000,
            "totalExpenses": 60000,
            "expensesByCategory": {"Rent": 20000, "Food": 15000},
            "savingsRate": 0.40,
            # emiAmount and investmentAmount missing (null)
        }
        response = client.post("/ai/recommend", json=payload)
        data = response.json()
        assert response.status_code == 200
        assert "emi_burden" in data["missingDataCategories"]
        assert "investment_allocation" in data["missingDataCategories"]
        # Still produces 3-7 recommendations
        assert 3 <= data["count"] <= 7

    def test_minimum_data_still_produces_recommendations(self):
        """Even with minimal data, at least 3 recommendations are generated."""
        payload = {
            "monthlyIncome": 50000,
            "totalExpenses": 40000,
            "expensesByCategory": {"Food": 10000},
            "savingsRate": 0.20,
            "emiAmount": 0,
            "investmentAmount": 0,
        }
        response = client.post("/ai/recommend", json=payload)
        data = response.json()
        assert response.status_code == 200
        assert data["count"] >= 3

    def test_no_financial_instruments_in_output(self):
        """Recommendations do not contain specific financial instrument names."""
        payload = {
            "monthlyIncome": 120000,
            "totalExpenses": 78000,
            "expensesByCategory": {
                "Rent": 25000,
                "Food": 18500,
                "Shopping": 8000,
                "EMI": 10000,
                "Investments": 15000,
            },
            "savingsRate": 0.35,
            "emiAmount": 10000,
            "investmentAmount": 15000,
        }
        response = client.post("/ai/recommend", json=payload)
        data = response.json()
        blocked_terms = [
            "Reliance", "Infosys", "TCS", "Bitcoin", "Ethereum",
            "HDFC Mutual Fund", "SBI Fund", "Dogecoin",
        ]
        for rec in data["recommendations"]:
            for term in blocked_terms:
                assert term.lower() not in rec["text"].lower(), (
                    f"Found blocked term '{term}' in recommendation: {rec['text']}"
                )

    def test_distinct_categories(self):
        """Recommendations address distinct categories."""
        payload = {
            "monthlyIncome": 120000,
            "totalExpenses": 78000,
            "expensesByCategory": {
                "Rent": 25000,
                "Food": 18500,
                "Travel": 12000,
                "Shopping": 10000,
                "EMI": 10000,
                "Entertainment": 8000,
            },
            "savingsRate": 0.35,
            "emiAmount": 10000,
            "investmentAmount": 5000,
        }
        response = client.post("/ai/recommend", json=payload)
        data = response.json()
        categories = [rec["category"] for rec in data["recommendations"]]
        # Each recommendation should address a distinct category
        assert len(categories) == len(set(categories))

    def test_high_savings_rate_recommendations(self):
        """High savings rate generates appropriate recommendations."""
        payload = {
            "monthlyIncome": 200000,
            "totalExpenses": 80000,
            "expensesByCategory": {
                "Rent": 30000,
                "Food": 15000,
                "Bills": 10000,
                "Investments": 40000,
            },
            "savingsRate": 0.60,
            "emiAmount": 0,
            "investmentAmount": 40000,
        }
        response = client.post("/ai/recommend", json=payload)
        data = response.json()
        assert response.status_code == 200
        assert 3 <= data["count"] <= 7

    def test_zero_income_handles_gracefully(self):
        """Zero income generates recommendations without crashing."""
        payload = {
            "monthlyIncome": 0,
            "totalExpenses": 50000,
            "expensesByCategory": {"Food": 15000, "Rent": 20000},
            "savingsRate": 0.0,
            "emiAmount": 0,
            "investmentAmount": 0,
        }
        response = client.post("/ai/recommend", json=payload)
        data = response.json()
        assert response.status_code == 200
        assert data["count"] >= 3
        assert "income" in data["missingDataCategories"]


class TestRecommenderService:
    """Unit tests for the recommender service functions."""

    def test_format_inr_small_amount(self):
        """Format small amounts correctly."""
        assert _format_inr(500) == "₹500"
        assert _format_inr(999) == "₹999"

    def test_format_inr_thousands(self):
        """Format thousands with Indian comma grouping."""
        assert _format_inr(1000) == "₹1,000"
        assert _format_inr(10000) == "₹10,000"
        assert _format_inr(99999) == "₹99,999"

    def test_format_inr_lakhs(self):
        """Format lakhs with Indian comma grouping."""
        assert _format_inr(100000) == "₹1,00,000"
        assert _format_inr(120000) == "₹1,20,000"
        assert _format_inr(1500000) == "₹15,00,000"

    def test_format_inr_crores(self):
        """Format crores with Indian comma grouping."""
        assert _format_inr(10000000) == "₹1,00,00,000"

    def test_contains_financial_instruments_stock(self):
        """Detects stock names in text."""
        assert _contains_financial_instruments("Invest in Reliance stock")
        assert _contains_financial_instruments("Buy Infosys shares")

    def test_contains_financial_instruments_crypto(self):
        """Detects crypto names in text."""
        assert _contains_financial_instruments("Buy Bitcoin now")
        assert _contains_financial_instruments("Invest in Ethereum")

    def test_contains_financial_instruments_mutual_fund(self):
        """Detects mutual fund scheme names in text."""
        assert _contains_financial_instruments("Invest in HDFC Mutual Fund")
        assert _contains_financial_instruments("SBI Fund scheme is good")

    def test_no_instruments_in_clean_text(self):
        """Clean text does not trigger false positives."""
        assert not _contains_financial_instruments(
            "Save more money by reducing dining out"
        )
        assert not _contains_financial_instruments(
            "Consider equity investments for long-term growth"
        )

    def test_sanitize_removes_mutual_fund_names(self):
        """Sanitize replaces mutual fund names with generic text."""
        text = "Invest in HDFC Mutual Fund for better returns"
        sanitized = _sanitize_recommendation_text(text)
        assert "HDFC" not in sanitized
        assert "diversified mutual fund" in sanitized

    def test_sanitize_removes_crypto_names(self):
        """Sanitize replaces crypto names with generic text."""
        text = "Bitcoin is a good investment option"
        sanitized = _sanitize_recommendation_text(text)
        assert "Bitcoin" not in sanitized
        assert "cryptocurrency" in sanitized

    def test_generate_recommendations_minimum_count(self):
        """Service always generates at least 3 recommendations."""
        request = RecommendRequest(
            monthly_income=50000,
            total_expenses=30000,
            expenses_by_category={"Food": 10000},
            savings_rate=0.40,
            emi_amount=0,
            investment_amount=0,
        )
        result = generate_recommendations(request)
        assert len(result.recommendations) >= 3
        assert result.count >= 3

    def test_generate_recommendations_maximum_count(self):
        """Service generates at most 7 recommendations."""
        request = RecommendRequest(
            monthly_income=120000,
            total_expenses=100000,
            expenses_by_category={
                "Rent": 35000,
                "Food": 20000,
                "Travel": 12000,
                "Shopping": 12000,
                "Bills": 6000,
                "EMI": 30000,
                "Entertainment": 10000,
            },
            savings_rate=0.17,
            emi_amount=30000,
            investment_amount=5000,
        )
        result = generate_recommendations(request)
        assert len(result.recommendations) <= 7
        assert result.count <= 7

    def test_missing_categories_detected(self):
        """Missing data categories are correctly identified."""
        request = RecommendRequest(
            monthly_income=100000,
            total_expenses=60000,
            expenses_by_category={"Food": 15000},
            savings_rate=None,
            emi_amount=None,
            investment_amount=None,
        )
        result = generate_recommendations(request)
        assert "savings_rate" in result.missing_data_categories
        assert "emi_burden" in result.missing_data_categories
        assert "investment_allocation" in result.missing_data_categories

    def test_plain_language_no_jargon(self):
        """Recommendations explain financial terms inline."""
        request = RecommendRequest(
            monthly_income=120000,
            total_expenses=78000,
            expenses_by_category={"EMI": 50000, "Food": 10000},
            savings_rate=0.35,
            emi_amount=50000,
            investment_amount=5000,
        )
        result = generate_recommendations(request)
        # At least one recommendation should have an inline explanation
        # (EMI or SIP explanations)
        all_text = " ".join(r.text for r in result.recommendations)
        # Check that when financial terms are used, they're explained
        if "EMI" in all_text:
            assert "Equated Monthly Installment" in all_text or "loan" in all_text.lower()
        if "SIP" in all_text:
            assert "Systematic Investment Plan" in all_text or "fixed amount regularly" in all_text.lower()
