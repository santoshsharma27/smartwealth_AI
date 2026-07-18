package com.smartwealth.client.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * Request DTO for chatbot endpoint POST /ai/chat.
 */
public class ChatRequest {

    public String message;

    @JsonProperty("financialContext")
    public FinancialContext financialContext;

    public ChatRequest() {
    }

    public ChatRequest(String message, FinancialContext financialContext) {
        this.message = message;
        this.financialContext = financialContext;
    }

    public static class FinancialContext {
        public List<Map<String, Object>> transactions = new java.util.ArrayList<>();
        public Map<String, Object> summary;
        public List<Map<String, Object>> goals = new java.util.ArrayList<>();
        public Map<String, Object> score;

        public FinancialContext() {
        }
    }
}
