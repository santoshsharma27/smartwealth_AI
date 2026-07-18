package com.smartwealth.client.dto;

import java.util.List;

/**
 * Request DTO for categorization endpoint POST /ai/categorize.
 */
public class CategorizeRequest {

    public List<TransactionInput> transactions;

    public CategorizeRequest() {
    }

    public CategorizeRequest(List<TransactionInput> transactions) {
        this.transactions = transactions;
    }

    public static class TransactionInput {
        public String id;
        public String description;
        public double amount;
        public String type;

        public TransactionInput() {
        }

        public TransactionInput(String id, String description, double amount, String type) {
            this.id = id;
            this.description = description;
            this.amount = amount;
            this.type = type;
        }
    }
}
