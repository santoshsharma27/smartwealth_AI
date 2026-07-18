package com.smartwealth.client.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

/**
 * Response DTO for health score calculation endpoint POST /ai/score.
 */
public class ScoreResponse {

    @JsonProperty("totalScore")
    public int totalScore;

    public Map<String, ScoreComponentDetail> components;

    public static class ScoreComponentDetail {
        public int score;
        public double ratio;
    }
}
