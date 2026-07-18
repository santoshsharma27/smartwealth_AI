package com.smartwealth.resource;

import com.smartwealth.dto.DocumentUploadResponse;
import com.smartwealth.dto.DocumentUploadResponse.DocumentMetadata;
import com.smartwealth.entity.Document;
import com.smartwealth.service.DocumentProcessingOrchestrator;
import com.smartwealth.service.DocumentUploadService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * REST resource for document upload and retrieval.
 * Handles multipart file uploads with validation.
 */
@Path("/api/sessions/{sessionId}/documents")
@Produces(MediaType.APPLICATION_JSON)
public class DocumentResource {

    @Inject
    DocumentUploadService documentUploadService;

    @Inject
    DocumentProcessingOrchestrator processingOrchestrator;

    /**
     * Upload documents for a session.
     * Accepts multipart/form-data with files and documentTypes.
     *
     * @param sessionId     the session ID
     * @param files         the uploaded file parts
     * @param documentTypes the document types list
     * @return 202 Accepted with document metadata
     */
    @POST
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public Response uploadDocuments(
            @PathParam("sessionId") UUID sessionId,
            @RestForm("files") List<FileUpload> files,
            @RestForm("documentTypes") List<String> documentTypes) {

        // Validate session exists
        documentUploadService.validateSessionExists(sessionId);

        // Validate upload parameters
        documentUploadService.validateUpload(files, documentTypes);

        // Store files and metadata (in its own transaction)
        List<Document> documents = documentUploadService.storeDocuments(sessionId, files, documentTypes);

        // Build response — return immediately with 202
        List<DocumentMetadata> metadata = documents.stream()
                .map(doc -> new DocumentMetadata(
                        doc.id,
                        doc.fileName,
                        doc.documentType,
                        doc.status,
                        doc.uploadedAt))
                .collect(java.util.stream.Collectors.toList());

        DocumentUploadResponse response = new DocumentUploadResponse(metadata);

        // Trigger processing after response is built (best-effort)
        try {
            List<UUID> docIds = documents.stream().map(d -> d.id).collect(java.util.stream.Collectors.toList());
            processingOrchestrator.processDocumentsByIds(sessionId, docIds);
        } catch (Exception e) {
            // Processing failed but upload succeeded — documents can be reprocessed later
        }

        return Response.accepted(response).build();
    }

    /**
     * List all documents for a session.
     *
     * @param sessionId the session ID
     * @return list of documents
     */
    @GET
    public Response listDocuments(@PathParam("sessionId") UUID sessionId) {
        // Validate session exists
        documentUploadService.validateSessionExists(sessionId);

        List<Document> documents = Document.findBySessionId(sessionId);

        List<DocumentMetadata> metadata = documents.stream()
                .map(doc -> new DocumentMetadata(
                        doc.id,
                        doc.fileName,
                        doc.documentType,
                        doc.status,
                        doc.uploadedAt))
                .collect(Collectors.toList());

        return Response.ok(new DocumentUploadResponse(metadata)).build();
    }

    /**
     * Get the status of a specific document.
     *
     * @param sessionId  the session ID
     * @param documentId the document ID
     * @return document status
     */
    @GET
    @Path("/{documentId}/status")
    public Response getDocumentStatus(
            @PathParam("sessionId") UUID sessionId,
            @PathParam("documentId") UUID documentId) {

        // Validate session exists
        documentUploadService.validateSessionExists(sessionId);

        Document document = Document.findByIdAndSessionId(documentId, sessionId);
        if (document == null) {
            throw new WebApplicationException(
                    Response.status(Response.Status.NOT_FOUND)
                            .entity(new DocumentUploadService.ErrorResponse("Document not found"))
                            .build());
        }

        DocumentMetadata metadata = new DocumentMetadata(
                document.id,
                document.fileName,
                document.documentType,
                document.status,
                document.uploadedAt);

        return Response.ok(metadata).build();
    }
}
