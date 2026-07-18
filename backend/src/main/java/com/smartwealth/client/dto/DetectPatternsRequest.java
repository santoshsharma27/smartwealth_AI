package com.smartwealth.client.dto;

import java.util.List;

/**
 * Request DTO for pattern detection endpoint POST /ai/detect-patterns.
 */
public class DetectPatternsRequest {

    public List<PatternTransaction> transactions;

    public DetectPatternsRequest() {
    }

    public DetectPatternsRequest(List<PatternTransaction> transactions) {
        this.transactions = transactions;
    }

    public static class PatternTransaction {
        public String date;
        public String description;
        public double amount;
        public String category;

        public PatternTransaction() {
        }

        public PatternTransaction(String date, String description, double amount, String category) {
            this.date = date;
            this.description = description;
            this.amount = amount;
            this.category = category;
        }
    }
}
