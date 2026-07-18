"""Tests for the expense categorization endpoint POST /ai/categorize."""

import uuid

import pytest
from fastapi.testclient import TestClient

from main import app
from services.categorizer import categorize_rule_based, categorize_transaction

client = TestClient(app)


def _make_transaction(description: str, amount: float = 500.0) -> dict:
    """Helper to create a transaction input dict."""
    return {
        "id": str(uuid.uuid4()),
        "description": description,
        "amount": amount,
        "type": "debit",
    }


# --- Rule-based categorization unit tests ---


class TestRuleBasedCategorization:
    """Tests for the rule-based keyword matching logic."""

    def test_food_swiggy(self):
        category, confidence = categorize_rule_based("SWIGGY ORDER")
        assert category == "Food"
        assert confidence >= 0.7

    def test_food_zomato(self):
        category, confidence = categorize_rule_based("Zomato delivery")
        assert category == "Food"
        assert confidence >= 0.7

    def test_travel_uber(self):
        category, confidence = categorize_rule_based("UBER TRIP")
        assert category == "Travel"
        assert confidence >= 0.7

    def test_travel_ola(self):
        category, confidence = categorize_rule_based("Ola Cab Ride")
        assert category == "Travel"
        assert confidence >= 0.7

    def test_shopping_amazon(self):
        category, confidence = categorize_rule_based("Amazon purchase")
        assert category == "Shopping"
        assert confidence >= 0.7

    def test_bills_electricity(self):
        category, confidence = categorize_rule_based("Electricity bill payment")
        assert category == "Bills"
        assert confidence >= 0.7

    def test_emi_loan(self):
        category, confidence = categorize_rule_based("Home Loan EMI")
        assert category == "EMI"
        assert confidence >= 0.7

    def test_healthcare_hospital(self):
        category, confidence = categorize_rule_based("Apollo Hospital")
        assert category == "Healthcare"
        assert confidence >= 0.7

    def test_entertainment_netflix(self):
        category, confidence = categorize_rule_based("NETFLIX subscription")
        assert category == "Entertainment"
        assert confidence >= 0.7

    def test_investments_sip(self):
        category, confidence = categorize_rule_based("SIP mutual fund")
        assert category == "Investments"
        assert confidence >= 0.7

    def test_savings(self):
        category, confidence = categorize_rule_based("Transfer to savings account")
        assert category == "Savings"
        assert confidence >= 0.7

    def test_education_course(self):
        category, confidence = categorize_rule_based("Udemy course payment")
        assert category == "Education"
        assert confidence >= 0.7

    def test_rent(self):
        category, confidence = categorize_rule_based("House Rent payment")
        assert category == "Rent"
        assert confidence >= 0.7

    def test_miscellaneous_unknown(self):
        """Unknown description should fall to Miscellaneous."""
        category, confidence = categorize_rule_based("XYZ123 random gibberish")
        assert category == "Miscellaneous"
        assert confidence < 0.7


# --- categorize_transaction integration tests ---


class TestCategorizeTransaction:
    """Tests for the full categorize_transaction flow."""

    def test_high_confidence_uses_rule_based(self):
        category, confidence, method = categorize_transaction("Swiggy food order")
        assert category == "Food"
        assert confidence >= 0.7
        assert method == "rule_based"

    def test_unknown_falls_to_miscellaneous(self):
        category, confidence, method = categorize_transaction(
            "QWE789 unknown merchant XYZ"
        )
        assert category == "Miscellaneous"
        assert method == "rule_based"  # LLM unavailable without API key


# --- Endpoint integration tests ---


class TestCategorizeEndpoint:
    """Tests for POST /ai/categorize endpoint."""

    def test_output_count_equals_input_count(self):
        """N inputs must produce exactly N outputs."""
        transactions = [
            _make_transaction("Swiggy order"),
            _make_transaction("Uber trip"),
            _make_transaction("Unknown merchant"),
        ]
        response = client.post("/ai/categorize", json={"transactions": transactions})
        assert response.status_code == 200
        data = response.json()
        assert len(data["categorizedTransactions"]) == len(transactions)

    def test_categorize_known_keywords(self):
        """Known keywords should produce correct categories."""
        transactions = [
            _make_transaction("SWIGGY ORDER 12345"),
            _make_transaction("UBER TRIP TO AIRPORT"),
            _make_transaction("Netflix subscription renewal"),
        ]
        response = client.post("/ai/categorize", json={"transactions": transactions})
        assert response.status_code == 200
        data = response.json()
        results = data["categorizedTransactions"]

        assert results[0]["category"] == "Food"
        assert results[1]["category"] == "Travel"
        assert results[2]["category"] == "Entertainment"

    def test_miscellaneous_fallback_for_unknown(self):
        """Unknown descriptions should fall back to Miscellaneous."""
        transactions = [_make_transaction("ABCXYZ totally unknown 9876")]
        response = client.post("/ai/categorize", json={"transactions": transactions})
        assert response.status_code == 200
        data = response.json()
        assert data["categorizedTransactions"][0]["category"] == "Miscellaneous"

    def test_all_12_categories_assignable(self):
        """All 12 categories should be assignable via rule-based matching."""
        descriptions = [
            ("House Rent payment", "Rent"),
            ("Swiggy food delivery", "Food"),
            ("Uber cab ride", "Travel"),
            ("Amazon shopping", "Shopping"),
            ("Electricity bill", "Bills"),
            ("Home Loan EMI", "EMI"),
            ("Apollo Hospital visit", "Healthcare"),
            ("Netflix subscription", "Entertainment"),
            ("SIP investment", "Investments"),
            ("Transfer to savings", "Savings"),
            ("Udemy course", "Education"),
            ("XYZ random unknown 999", "Miscellaneous"),
        ]
        transactions = [_make_transaction(desc) for desc, _ in descriptions]
        response = client.post("/ai/categorize", json={"transactions": transactions})
        assert response.status_code == 200
        data = response.json()
        results = data["categorizedTransactions"]

        for i, (_, expected_category) in enumerate(descriptions):
            assert results[i]["category"] == expected_category, (
                f"Transaction '{descriptions[i][0]}' expected '{expected_category}' "
                f"but got '{results[i]['category']}'"
            )

    def test_response_includes_stats(self):
        """Response should include categorization statistics."""
        transactions = [_make_transaction("Zomato order")]
        response = client.post("/ai/categorize", json={"transactions": transactions})
        assert response.status_code == 200
        data = response.json()
        stats = data["stats"]
        assert "totalProcessed" in stats
        assert "ruleBased" in stats
        assert "llmBased" in stats
        assert "llmAvailable" in stats
        assert stats["totalProcessed"] == 1

    def test_response_fields_structure(self):
        """Each categorized transaction should have id, category, confidence, method."""
        transactions = [_make_transaction("Flipkart order")]
        response = client.post("/ai/categorize", json={"transactions": transactions})
        assert response.status_code == 200
        data = response.json()
        result = data["categorizedTransactions"][0]
        assert "id" in result
        assert "category" in result
        assert "confidence" in result
        assert "method" in result
        assert 0.0 <= result["confidence"] <= 1.0
        assert result["method"] in ("rule_based", "llm_based")

    def test_empty_transactions_rejected(self):
        """Empty transaction list should be rejected by validation."""
        response = client.post("/ai/categorize", json={"transactions": []})
        assert response.status_code == 422

    def test_llm_unavailable_notice(self):
        """When LLM is unavailable, stats should indicate it."""
        transactions = [_make_transaction("Swiggy order")]
        response = client.post("/ai/categorize", json={"transactions": transactions})
        assert response.status_code == 200
        data = response.json()
        # Without OPENAI_API_KEY set, LLM should be unavailable
        assert data["stats"]["llmAvailable"] is False
