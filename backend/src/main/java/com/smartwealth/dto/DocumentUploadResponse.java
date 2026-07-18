package com.smartwealth.dto;

import java.sql.Timestamp;
import java.util.List;
import java.util.UUID;

/**
 * DTO for document upload response.
 * Returns metadata about uploaded documents.
 */
public class DocumentUploadResponse {

    public List<DocumentMetadata> documents;

    public DocumentUploadResponse() {
    }

    public DocumentUploadResponse(List<DocumentMetadata> documents) {
        this.documents = documents;
    }

    public static class DocumentMetadata {
        public UUID id;
        public String fileName;
        public String documentType;
        public String status;
        public Timestamp uploadedAt;

        public DocumentMetadata() {
        }

        public DocumentMetadata(UUID id, String fileName, String documentType, String status, Timestamp uploadedAt) {
            this.id = id;
            this.fileName = fileName;
            this.documentType = documentType;
            this.status = status;
            this.uploadedAt = uploadedAt;
        }
    }
}
