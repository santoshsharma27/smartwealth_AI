package com.smartwealth.dto;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.Map;
import java.util.UUID;

/**
 * DTO for GET /api/sessions/{id}/score response.
 * Matches the design contract with score components including value fields,
 * and a metadata block with income/expense/savings information.
 */
public record HealthScoreResponse(
        int totalScore,
        String statusLabel,
        ScoreComponents components,
        ScoreMetadata metadata
) {
    public record ScoreComponent(int score, int maxScore, Double value) {
    }

    public record ScoreComponents(
            ScoreComponent savingsRatio,
            ScoreComponent expenseControl,
            ScoreComponent emiBurden,
            ScoreComponent investmentAllocation,
            ScoreComponent emergencyFundReadiness
    ) {
    }

    public record ScoreMetadata(
            BigDecimal monthlyIncome,
            BigDecimal monthlyExpenses,
            BigDecimal monthlySavings,
            Timestamp calculatedAt
    ) {
    }
}
