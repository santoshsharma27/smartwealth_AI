package com.smartwealth.client.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

/**
 * Request DTO for health score calculation endpoint POST /ai/score.
 */
public class ScoreRequest {

    @JsonProperty("monthlyIncome")
    public double monthlyIncome;

    @JsonProperty("totalExpenses")
    public double totalExpenses;

    @JsonProperty("expensesByCategory")
    public Map<String, Double> expensesByCategory;

    @JsonProperty("cumulativeSavingsBalance")
    public double cumulativeSavingsBalance;

    @JsonProperty("monthsOfData")
    public int monthsOfData;

    public ScoreRequest() {
    }

    public ScoreRequest(double monthlyIncome, double totalExpenses, Map<String, Double> expensesByCategory,
                        double cumulativeSavingsBalance, int monthsOfData) {
        this.monthlyIncome = monthlyIncome;
        this.totalExpenses = totalExpenses;
        this.expensesByCategory = expensesByCategory;
        this.cumulativeSavingsBalance = cumulativeSavingsBalance;
        this.monthsOfData = monthsOfData;
    }
}
