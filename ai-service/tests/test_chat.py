"""Tests for the chatbot endpoint POST /ai/chat."""

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

DISCLAIMER = (
    "This is informational guidance only. "
    "Consult a certified financial advisor for professional advice."
)

# ─── Sample Financial Context ───────────────────────────────────────────────

FULL_CONTEXT = {
    "financialContext": {
        "summary": {
            "monthlyIncome": 120000,
            "totalExpenses": 78000,
            "monthlySavings": 42000,
            "savingsPercentage": 35.0,
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
        },
        "transactions": [
            {"date": "2024-01-05", "description": "SWIGGY ORDER", "amount": 450, "type": "debit"},
            {"date": "2024-01-10", "description": "RENT PAYMENT", "amount": 25000, "type": "debit"},
        ],
        "goals": [
            {
                "goalName": "Buy a Car",
                "targetAmount": 800000,
                "requiredMonthlySavings": 26923,
                "feasibilityStatus": "Challenging",
            }
        ],
        "score": {
            "totalScore": 72,
            "statusLabel": "Very Good",
            "components": {
                "savingsRatio": {"score": 25, "maxScore": 30},
                "expenseControl": {"score": 18, "maxScore": 25},
                "emiBurden": {"score": 12, "maxScore": 15},
                "investmentAllocation": {"score": 10, "maxScore": 15},
                "emergencyFundReadiness": {"score": 7, "maxScore": 15},
            },
        },
    }
}


# ─── Test: Disclaimer in Every Response ─────────────────────────────────────


class TestDisclaimerPresent:
    """Every response must include the disclaimer."""

    def test_disclaimer_with_spending_question(self):
        payload = {"message": "How much do I spend on food?", **FULL_CONTEXT}
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["disclaimer"] == DISCLAIMER

    def test_disclaimer_with_empty_context(self):
        payload = {
            "message": "What is my savings rate?",
            "financialContext": {
                "transactions": [],
                "summary": None,
                "goals": [],
                "score": None,
            },
        }
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        assert response.json()["disclaimer"] == DISCLAIMER

    def test_disclaimer_with_investment_decline(self):
        payload = {"message": "Should I buy Reliance stock?", **FULL_CONTEXT}
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        assert response.json()["disclaimer"] == DISCLAIMER


# ─── Test: Empty Financial Context ──────────────────────────────────────────


class TestEmptyContext:
    """When financial context is empty, respond with data upload prompt."""

    def test_empty_context_all_none(self):
        payload = {
            "message": "How can I save more?",
            "financialContext": {
                "transactions": [],
                "summary": None,
                "goals": [],
                "score": None,
            },
        }
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "upload" in data["answer"].lower() or "demo data" in data["answer"].lower()

    def test_empty_context_empty_summary(self):
        payload = {
            "message": "What is my score?",
            "financialContext": {
                "transactions": [],
                "summary": {},
                "goals": [],
                "score": None,
            },
        }
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        # Empty dict summary is treated as having some context, so specific handler runs
        # but score handler says data is missing
        data = response.json()
        assert "upload" in data["answer"].lower() or "score" in data["answer"].lower()


# ─── Test: Spending Intent ──────────────────────────────────────────────────


class TestSpendingIntent:
    """Questions about spending patterns should reference user data."""

    def test_spending_overview(self):
        payload = {"message": "What are my spending patterns?", **FULL_CONTEXT}
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        # Should reference actual expense amount
        assert "₹" in data["answer"]
        assert "78,000" in data["answer"] or "78000" in data["answer"]

    def test_specific_category_food(self):
        payload = {"message": "How much do I spend on food?", **FULL_CONTEXT}
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "18,500" in data["answer"]
        assert "Food" in data["answer"]

    def test_spending_missing_transactions(self):
        payload = {
            "message": "What are my expenses?",
            "financialContext": {
                "transactions": [],
                "summary": None,
                "goals": [],
                "score": {"totalScore": 50, "statusLabel": "Fair", "components": {}},
            },
        }
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "upload" in data["answer"].lower() or "transaction" in data["answer"].lower()


# ─── Test: Savings Intent ───────────────────────────────────────────────────


class TestSavingsIntent:
    """Questions about savings should use financial summary data."""

    def test_savings_rate_response(self):
        payload = {"message": "How much can I save?", **FULL_CONTEXT}
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "42,000" in data["answer"] or "1,20,000" in data["answer"]

    def test_savings_missing_income(self):
        payload = {
            "message": "What is my savings potential?",
            "financialContext": {
                "transactions": [],
                "summary": {"totalExpenses": 50000},
                "goals": [],
                "score": None,
            },
        }
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        # Should mention missing income data
        assert "income" in data["answer"].lower() or "salary" in data["answer"].lower()


# ─── Test: Goals Intent ─────────────────────────────────────────────────────


class TestGoalsIntent:
    """Questions about goals should reference user's goal data."""

    def test_goals_overview(self):
        payload = {"message": "What about my goals?", **FULL_CONTEXT}
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "Buy a Car" in data["answer"]
        assert "8,00,000" in data["answer"] or "800000" in data["answer"]

    def test_goals_no_goals_created(self):
        context = {
            "financialContext": {
                "summary": {
                    "monthlyIncome": 100000,
                    "totalExpenses": 60000,
                    "monthlySavings": 40000,
                },
                "transactions": [],
                "goals": [],
                "score": None,
            },
        }
        payload = {"message": "Are my goals feasible?", **context}
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "goal" in data["answer"].lower()


# ─── Test: Score Intent ─────────────────────────────────────────────────────


class TestScoreIntent:
    """Questions about health score should reference score data."""

    def test_score_response(self):
        payload = {"message": "What is my financial health score?", **FULL_CONTEXT}
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "72" in data["answer"]
        assert "Very Good" in data["answer"]

    def test_score_components(self):
        payload = {"message": "How can I improve my score?", **FULL_CONTEXT}
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        # Should mention component breakdown
        assert "Savings Ratio" in data["answer"] or "score" in data["answer"].lower()

    def test_score_missing(self):
        payload = {
            "message": "What is my score?",
            "financialContext": {
                "transactions": [{"date": "2024-01-01", "description": "test", "amount": 100, "type": "debit"}],
                "summary": None,
                "goals": [],
                "score": None,
            },
        }
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "upload" in data["answer"].lower() or "score" in data["answer"].lower()


# ─── Test: Investment Product Decline ───────────────────────────────────────


class TestInvestmentProductDecline:
    """Specific investment product requests should be declined."""

    def test_decline_stock_recommendation(self):
        payload = {"message": "Should I buy Reliance stock?", **FULL_CONTEXT}
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "unable to recommend" in data["answer"].lower() or "cannot recommend" in data["answer"].lower()
        assert "financial advisor" in data["answer"].lower()

    def test_decline_mutual_fund(self):
        payload = {"message": "Is HDFC Mutual Fund a good investment?", **FULL_CONTEXT}
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "unable to recommend" in data["answer"].lower() or "cannot recommend" in data["answer"].lower()

    def test_decline_crypto(self):
        payload = {"message": "Should I invest in Bitcoin?", **FULL_CONTEXT}
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "unable to recommend" in data["answer"].lower() or "cannot recommend" in data["answer"].lower()

    def test_decline_which_stock_to_buy(self):
        payload = {"message": "Which stock should I buy for best returns?", **FULL_CONTEXT}
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "unable to recommend" in data["answer"].lower() or "cannot recommend" in data["answer"].lower()

    def test_decline_specific_fund_scheme(self):
        payload = {"message": "Is SBI Blue Chip Fund good for long term?", **FULL_CONTEXT}
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "unable to recommend" in data["answer"].lower() or "cannot recommend" in data["answer"].lower()


# ─── Test: Missing Data Handling ────────────────────────────────────────────


class TestMissingDataHandling:
    """When required data is missing, state what data type is missing."""

    def test_missing_summary_for_savings(self):
        payload = {
            "message": "How can I increase my savings?",
            "financialContext": {
                "transactions": [{"date": "2024-01-05", "description": "test", "amount": 100, "type": "debit"}],
                "summary": None,
                "goals": [],
                "score": None,
            },
        }
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        # Should state what data is needed
        assert "summary" in data["answer"].lower() or "income" in data["answer"].lower() or "upload" in data["answer"].lower()

    def test_missing_score_data(self):
        payload = {
            "message": "What is my health score?",
            "financialContext": {
                "transactions": [],
                "summary": {"monthlyIncome": 100000, "totalExpenses": 60000},
                "goals": [],
                "score": None,
            },
        }
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "score" in data["answer"].lower()
        assert "upload" in data["answer"].lower() or "demo" in data["answer"].lower()


# ─── Test: Input Validation ─────────────────────────────────────────────────


class TestInputValidation:
    """Test request validation on the endpoint."""

    def test_empty_message_rejected(self):
        payload = {
            "message": "",
            "financialContext": {"transactions": [], "summary": None, "goals": [], "score": None},
        }
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 422

    def test_whitespace_only_message_rejected(self):
        payload = {
            "message": "   ",
            "financialContext": {"transactions": [], "summary": None, "goals": [], "score": None},
        }
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 422

    def test_message_over_500_chars_rejected(self):
        payload = {
            "message": "a" * 501,
            "financialContext": {"transactions": [], "summary": None, "goals": [], "score": None},
        }
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 422

    def test_valid_message_accepted(self):
        payload = {"message": "Hello, how am I doing?", **FULL_CONTEXT}
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200


# ─── Test: Indian Rupee Formatting ──────────────────────────────────────────


class TestIndianRupeeFormatting:
    """Amounts should be formatted with ₹ and Indian comma grouping."""

    def test_format_in_spending_response(self):
        payload = {"message": "Show me my spending breakdown", **FULL_CONTEXT}
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        # Should use ₹ symbol with Indian grouping
        assert "₹" in data["answer"]

    def test_format_in_savings_response(self):
        payload = {"message": "What are my savings?", **FULL_CONTEXT}
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "₹" in data["answer"]
        # ₹1,20,000 or ₹42,000 should appear
        assert "1,20,000" in data["answer"] or "42,000" in data["answer"]


# ─── Test: General/Fallback Intent ──────────────────────────────────────────


class TestGeneralIntent:
    """General questions should provide an overview."""

    def test_general_greeting(self):
        payload = {"message": "Hello, tell me about my finances", **FULL_CONTEXT}
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        # Should give an overview
        assert "₹" in data["answer"]

    def test_unrecognized_question(self):
        payload = {"message": "What is the meaning of life?", **FULL_CONTEXT}
        response = client.post("/ai/chat", json=payload)
        assert response.status_code == 200
        data = response.json()
        # Should still return valid response with disclaimer
        assert len(data["answer"]) > 0
        assert data["disclaimer"] == DISCLAIMER
