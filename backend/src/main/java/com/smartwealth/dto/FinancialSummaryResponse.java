package com.smartwealth.dto;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.Map;
import java.util.UUID;

/**
 * DTO for GET /api/sessions/{id}/summary response.
 * Includes ₹ formatting metadata for the frontend.
 */
public record FinancialSummaryResponse(
        UUID id,
        BigDecimal monthlyIncome,
        BigDecimal totalExpenses,
        BigDecimal monthlySavings,
        BigDecimal savingsPercentage,
        Map<String, Double> expensesByCategory,
        Timestamp calculatedAt,
        CurrencyMetadata currencyMetadata
) {
    public record CurrencyMetadata(
            String symbol,
            String code,
            String locale,
            String groupingSeparator,
            String decimalSeparator
    ) {
        public static CurrencyMetadata INR = new CurrencyMetadata(
                "₹", "INR", "en-IN", ",", "."
        );
    }
}
