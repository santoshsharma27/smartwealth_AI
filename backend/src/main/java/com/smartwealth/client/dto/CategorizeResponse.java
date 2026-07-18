package com.smartwealth.client.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Response DTO for categorization endpoint POST /ai/categorize.
 */
public class CategorizeResponse {

    @JsonProperty("categorizedTransactions")
    public List<CategorizedTransaction> categorizedTransactions;

    public CategorizeStats stats;

    public static class CategorizedTransaction {
        public String id;
        public String category;
        public double confidence;
        public String method;
    }

    public static class CategorizeStats {
        @JsonProperty("totalProcessed")
        public int totalProcessed;

        @JsonProperty("ruleBased")
        public int ruleBased;

        @JsonProperty("llmBased")
        public int llmBased;

        @JsonProperty("llmAvailable")
        public boolean llmAvailable;
    }
}
