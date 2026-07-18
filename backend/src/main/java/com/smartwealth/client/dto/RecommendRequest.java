package com.smartwealth.client.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

/**
 * Request DTO for recommendation generation endpoint POST /ai/recommend.
 */
public class RecommendRequest {

    @JsonProperty("monthlyIncome")
    public double monthlyIncome;

    @JsonProperty("totalExpenses")
    public double totalExpenses;

    @JsonProperty("expensesByCategory")
    public Map<String, Double> expensesByCategory;

    @JsonProperty("savingsRate")
    public double savingsRate;

    @JsonProperty("emiAmount")
    public double emiAmount;

    @JsonProperty("investmentAmount")
    public double investmentAmount;

    public RecommendRequest() {
    }

    public RecommendRequest(double monthlyIncome, double totalExpenses, Map<String, Double> expensesByCategory,
                            double savingsRate, double emiAmount, double investmentAmount) {
        this.monthlyIncome = monthlyIncome;
        this.totalExpenses = totalExpenses;
        this.expensesByCategory = expensesByCategory;
        this.savingsRate = savingsRate;
        this.emiAmount = emiAmount;
        this.investmentAmount = investmentAmount;
    }
}
