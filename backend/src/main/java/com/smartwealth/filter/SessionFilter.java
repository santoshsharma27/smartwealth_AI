package com.smartwealth.filter;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.PreMatching;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import java.util.UUID;

/**
 * JAX-RS filter that validates the X-Session-Id header on all /api/* requests,
 * except for POST /api/sessions which creates a new session.
 */
@Provider
@PreMatching
public class SessionFilter implements ContainerRequestFilter {

    private static final String SESSION_HEADER = "X-Session-Id";

    @Override
    public void filter(ContainerRequestContext requestContext) {
        String path = requestContext.getUriInfo().getPath();
        String method = requestContext.getMethod();

        // Only filter /api/* requests
        if (!path.startsWith("api/") && !path.startsWith("/api/")) {
            return;
        }

        // Allow POST /api/sessions without header (creates a new session)
        String normalizedPath = path.startsWith("/") ? path.substring(1) : path;
        if ("POST".equalsIgnoreCase(method) && "api/sessions".equals(normalizedPath)) {
            return;
        }

        // Validate X-Session-Id header
        String sessionId = requestContext.getHeaderString(SESSION_HEADER);
        if (sessionId == null || sessionId.isBlank()) {
            requestContext.abortWith(
                    Response.status(Response.Status.BAD_REQUEST)
                            .type(MediaType.APPLICATION_JSON)
                            .entity("{\"message\":\"X-Session-Id header is required\"}")
                            .build());
            return;
        }

        try {
            UUID.fromString(sessionId);
        } catch (IllegalArgumentException e) {
            requestContext.abortWith(
                    Response.status(Response.Status.BAD_REQUEST)
                            .type(MediaType.APPLICATION_JSON)
                            .entity("{\"message\":\"X-Session-Id header must be a valid UUID\"}")
                            .build());
        }
    }
}
