package com.smartwealth.client;

import com.smartwealth.client.dto.CategorizeRequest;
import com.smartwealth.client.dto.CategorizeResponse;
import com.smartwealth.client.dto.ChatRequest;
import com.smartwealth.client.dto.ChatResponse;
import com.smartwealth.client.dto.DetectPatternsRequest;
import com.smartwealth.client.dto.DetectPatternsResponse;
import com.smartwealth.client.dto.ParseRequest;
import com.smartwealth.client.dto.ParseResponse;
import com.smartwealth.client.dto.RecommendRequest;
import com.smartwealth.client.dto.RecommendResponse;
import com.smartwealth.client.dto.ReportRequest;
import com.smartwealth.client.dto.ScoreRequest;
import com.smartwealth.client.dto.ScoreResponse;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

/**
 * Quarkus REST Client interface for the Python AI service.
 * Maps to the AI service endpoints under /ai path.
 */
@RegisterRestClient(configKey = "ai-service")
@Path("/ai")
public interface AiServiceClient {

    @POST
    @Path("/parse")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    ParseResponse parseDocument(ParseRequest request);

    @POST
    @Path("/categorize")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    CategorizeResponse categorizeTransactions(CategorizeRequest request);

    @POST
    @Path("/score")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    ScoreResponse calculateScore(ScoreRequest request);

    @POST
    @Path("/recommend")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    RecommendResponse generateRecommendations(RecommendRequest request);

    @POST
    @Path("/chat")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    ChatResponse processChat(ChatRequest request);

    @POST
    @Path("/detect-patterns")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    DetectPatternsResponse detectPatterns(DetectPatternsRequest request);

    @POST
    @Path("/report")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_OCTET_STREAM)
    byte[] generateReport(ReportRequest request);
}
