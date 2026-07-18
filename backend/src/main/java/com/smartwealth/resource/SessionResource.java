package com.smartwealth.resource;

import com.smartwealth.entity.Session;
import com.smartwealth.service.DemoDataService;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

/**
 * REST resource for session management.
 * Handles session creation, retrieval, and demo mode toggling.
 */
@Path("/api/sessions")
@Produces(MediaType.APPLICATION_JSON)
public class SessionResource {

    @Inject
    DemoDataService demoDataService;

    @POST
    @Transactional
    public Response createSession() {
        Session session = new Session();
        session.isDemoActive = false;
        session.persist();
        return Response.status(Response.Status.CREATED).entity(session).build();
    }

    @GET
    @Path("/{id}")
    public Response getSession(@PathParam("id") UUID id) {
        Session session = Session.findById(id);
        if (session == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(new ErrorResponse("Session not found"))
                    .build();
        }
        return Response.ok(session).build();
    }

    @POST
    @Path("/{id}/demo")
    @Transactional
    public Response activateDemo(@PathParam("id") UUID id) {
        Session session = Session.findById(id);
        if (session == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(new ErrorResponse("Session not found"))
                    .build();
        }
        if (session.isDemoActive) {
            return Response.ok(session).build();
        }
        demoDataService.loadDemoData(session);
        return Response.ok(session).build();
    }

    @DELETE
    @Path("/{id}/demo")
    @Transactional
    public Response deactivateDemo(@PathParam("id") UUID id) {
        Session session = Session.findById(id);
        if (session == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(new ErrorResponse("Session not found"))
                    .build();
        }
        if (!session.isDemoActive) {
            return Response.ok(session).build();
        }
        demoDataService.clearDemoData(session);
        return Response.ok(session).build();
    }

    /**
     * Simple error response record for consistent error messaging.
     */
    public record ErrorResponse(String message) {}
}
