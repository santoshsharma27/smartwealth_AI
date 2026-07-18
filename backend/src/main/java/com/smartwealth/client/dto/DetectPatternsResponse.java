package com.smartwealth.client.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Response DTO for pattern detection endpoint POST /ai/detect-patterns.
 */
public class DetectPatternsResponse {

    @JsonProperty("recurringExpenses")
    public List<RecurringExpense> recurringExpenses;

    @JsonProperty("spendingAnomalies")
    public List<SpendingAnomaly> spendingAnomalies;

    public static class RecurringExpense {
        public String description;

        @JsonProperty("recurringAmount")
        public double recurringAmount;

        @JsonProperty("consecutiveMonths")
        public int consecutiveMonths;
    }

    public static class SpendingAnomaly {
        public String description;

        @JsonProperty("transactionAmount")
        public double transactionAmount;

        public String category;

        @JsonProperty("categoryAverage")
        public double categoryAverage;
    }
}
