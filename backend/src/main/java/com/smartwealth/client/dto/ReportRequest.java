package com.smartwealth.client.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Request DTO for report generation endpoint POST /ai/report.
 * Matches the AI service's Pydantic ReportRequest model.
 */
public class ReportRequest {

    @JsonProperty("monthlyIncome")
    public Double monthlyIncome;

    @JsonProperty("totalExpenses")
    public Double totalExpenses;

    @JsonProperty("monthlySavings")
    public Double monthlySavings;

    @JsonProperty("expensesByCategory")
    public Map<String, Double> expensesByCategory;

    @JsonProperty("healthScore")
    public HealthScoreData healthScore;

    public List<String> recommendations = new ArrayList<>();

    public List<GoalSummary> goals = new ArrayList<>();

    @JsonProperty("actionItems")
    public List<ActionItem> actionItems = new ArrayList<>();

    public ReportRequest() {
    }

    public static class HealthScoreData {
        @JsonProperty("totalScore")
        public int totalScore;
        @JsonProperty("statusLabel")
        public String statusLabel;
        public Map<String, ScoreComponent> components;
    }

    public static class ScoreComponent {
        public int score;
        @JsonProperty("maxScore")
        public int maxScore;
    }

    public static class GoalSummary {
        @JsonProperty("goalName")
        public String goalName;
        @JsonProperty("targetAmount")
        public double targetAmount;
        @JsonProperty("durationMonths")
        public int durationMonths;
        @JsonProperty("requiredMonthlySavings")
        public double requiredMonthlySavings;
        @JsonProperty("feasibilityStatus")
        public String feasibilityStatus;
    }

    public static class ActionItem {
        public int priority;
        public String text;

        public ActionItem(int priority, String text) {
            this.priority = priority;
            this.text = text;
        }
    }
}
