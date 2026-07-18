package com.smartwealth.client.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * Response DTO for document parsing endpoint POST /ai/parse.
 */
public class ParseResponse {

    public boolean success;

    @JsonProperty("documentType")
    public String documentType;

    public List<ExtractedTransaction> transactions;

    @JsonProperty("salaryData")
    public SalaryData salaryData;

    @JsonProperty("extractionErrors")
    public List<String> extractionErrors;

    public ParseMetadata metadata;

    public static class ExtractedTransaction {
        public String date;
        public String description;
        public double amount;
        public String type;
    }

    public static class SalaryData {
        @JsonProperty("grossSalary")
        public double grossSalary;

        @JsonProperty("netSalary")
        public double netSalary;

        @JsonProperty("employerName")
        public String employerName;

        @JsonProperty("monthYear")
        public String monthYear;

        public List<Map<String, Object>> deductions;
    }

    public static class ParseMetadata {
        @JsonProperty("totalTransactions")
        public int totalTransactions;

        @JsonProperty("dateRange")
        public Map<String, String> dateRange;
    }
}
