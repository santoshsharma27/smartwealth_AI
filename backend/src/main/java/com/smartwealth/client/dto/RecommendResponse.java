package com.smartwealth.client.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Response DTO for recommendation generation endpoint POST /ai/recommend.
 */
public class RecommendResponse {

    public List<Recommendation> recommendations;

    public static class Recommendation {
        public String category;
        public String text;

        @JsonProperty("dataPointReference")
        public String dataPointReference;
    }
}
