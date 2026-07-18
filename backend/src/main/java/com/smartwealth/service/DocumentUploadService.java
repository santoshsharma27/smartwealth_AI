package com.smartwealth.service;

import com.smartwealth.entity.Document;
import com.smartwealth.entity.Session;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Service responsible for validating and storing uploaded documents.
 * Validates file format, size, and count constraints per the requirements.
 */
@ApplicationScoped
public class DocumentUploadService {

    private static final int MAX_FILE_SIZE = 15_728_640; // 15 MB
    private static final int MIN_FILE_SIZE = 1; // 1 byte
    private static final int MAX_DOCUMENT_COUNT = 5;
    private static final int MIN_DOCUMENT_COUNT = 1;

    private static final Set<String> SALARY_SLIP_FORMATS = Set.of("pdf");
    private static final Set<String> BANK_STATEMENT_FORMATS = Set.of("pdf", "csv");
    private static final Set<String> VALID_DOCUMENT_TYPES = Set.of("salary_slip", "bank_statement");

    @ConfigProperty(name = "smartwealth.upload.directory", defaultValue = "./uploads")
    String uploadDirectory;

    /**
     * Validates the upload request parameters.
     *
     * @param files         the uploaded files
     * @param documentTypes the document types for each file
     */
    public void validateUpload(List<FileUpload> files, List<String> documentTypes) {
        int fileCount = (files == null) ? 0 : files.size();

        if (fileCount < MIN_DOCUMENT_COUNT) {
            throw new WebApplicationException(
                    Response.status(Response.Status.BAD_REQUEST)
                            .entity(new ErrorResponse("At least 1 document is required"))
                            .build());
        }

        if (fileCount > MAX_DOCUMENT_COUNT) {
            throw new WebApplicationException(
                    Response.status(Response.Status.BAD_REQUEST)
                            .entity(new ErrorResponse("Document count must be between " + MIN_DOCUMENT_COUNT + " and " + MAX_DOCUMENT_COUNT))
                            .build());
        }

        int docTypeCount = (documentTypes == null) ? 0 : documentTypes.size();
        if (docTypeCount != fileCount) {
            throw new WebApplicationException(
                    Response.status(Response.Status.BAD_REQUEST)
                            .entity(new ErrorResponse("Each file must have a corresponding document type"))
                            .build());
        }

        for (int i = 0; i < files.size(); i++) {
            FileUpload file = files.get(i);
            String docType = documentTypes.get(i);
            validateSingleFile(file, docType, i);
        }
    }

    private void validateSingleFile(FileUpload file, String documentType, int index) {
        // Validate document type
        if (!VALID_DOCUMENT_TYPES.contains(documentType)) {
            throw new WebApplicationException(
                    Response.status(Response.Status.BAD_REQUEST)
                            .entity(new ErrorResponse("Invalid document type '" + documentType + "' for file at index " + index + ". Accepted types: salary_slip, bank_statement"))
                            .build());
        }

        // Get file extension
        String fileName = file.fileName();
        String fileFormat = extractFileFormat(fileName);

        // Validate file format based on document type
        if ("salary_slip".equals(documentType)) {
            if (!SALARY_SLIP_FORMATS.contains(fileFormat)) {
                throw new WebApplicationException(
                        Response.status(Response.Status.BAD_REQUEST)
                                .entity(new ErrorResponse("Invalid format for salary slip: '" + fileFormat + "'. Accepted formats: PDF"))
                                .build());
            }
        } else if ("bank_statement".equals(documentType)) {
            if (!BANK_STATEMENT_FORMATS.contains(fileFormat)) {
                throw new WebApplicationException(
                        Response.status(Response.Status.BAD_REQUEST)
                                .entity(new ErrorResponse("Invalid format for bank statement: '" + fileFormat + "'. Accepted formats: PDF, CSV"))
                                .build());
            }
        }

        // Validate file size
        long fileSize;
        try {
            fileSize = Files.size(file.filePath());
        } catch (IOException e) {
            throw new WebApplicationException(
                    Response.status(Response.Status.BAD_REQUEST)
                            .entity(new ErrorResponse("Unable to read file at index " + index))
                            .build());
        }

        if (fileSize < MIN_FILE_SIZE) {
            throw new WebApplicationException(
                    Response.status(Response.Status.BAD_REQUEST)
                            .entity(new ErrorResponse("File '" + fileName + "' is empty. Minimum file size is 1 byte"))
                            .build());
        }

        if (fileSize > MAX_FILE_SIZE) {
            throw new WebApplicationException(
                    Response.status(Response.Status.BAD_REQUEST)
                            .entity(new ErrorResponse("File '" + fileName + "' exceeds the maximum allowed file size of 15 MB"))
                            .build());
        }
    }

    /**
     * Stores files to the local filesystem and saves metadata to the database.
     *
     * @param sessionId     the session ID
     * @param files         the uploaded files
     * @param documentTypes the document types for each file
     * @return list of created Document entities
     */
    @Transactional
    public List<Document> storeDocuments(UUID sessionId, List<FileUpload> files, List<String> documentTypes) {
        List<Document> documents = new ArrayList<>();

        Path uploadDir = Path.of(uploadDirectory, sessionId.toString());
        try {
            Files.createDirectories(uploadDir);
        } catch (IOException e) {
            throw new WebApplicationException(
                    Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                            .entity(new ErrorResponse("Failed to create upload directory"))
                            .build());
        }

        Session session = Session.findById(sessionId);

        for (int i = 0; i < files.size(); i++) {
            FileUpload file = files.get(i);
            String docType = documentTypes.get(i);
            String fileName = file.fileName();
            String fileFormat = extractFileFormat(fileName);

            // Generate unique filename for storage
            UUID docId = UUID.randomUUID();
            String storedFileName = docId + "." + fileFormat;
            Path targetPath = uploadDir.resolve(storedFileName);

            // Copy file to storage location
            try {
                Files.copy(file.filePath(), targetPath, StandardCopyOption.REPLACE_EXISTING);
            } catch (IOException e) {
                throw new WebApplicationException(
                        Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                                .entity(new ErrorResponse("Failed to store file: " + fileName))
                                .build());
            }

            // Get file size
            long fileSize;
            try {
                fileSize = Files.size(file.filePath());
            } catch (IOException e) {
                fileSize = 0;
            }

            // Create document entity
            Document document = new Document();
            document.id = docId;
            document.session = session;
            document.fileName = fileName;
            document.fileFormat = fileFormat;
            document.documentType = docType;
            document.storagePath = targetPath.toString();
            document.status = "uploaded";
            document.fileSizeBytes = (int) fileSize;

            document.persist();
            documents.add(document);
        }

        return documents;
    }

    /**
     * Validates that a session exists.
     *
     * @param sessionId the session ID to check
     * @return the Session entity
     */
    public Session validateSessionExists(UUID sessionId) {
        Session session = Session.findById(sessionId);
        if (session == null) {
            throw new WebApplicationException(
                    Response.status(Response.Status.NOT_FOUND)
                            .entity(new ErrorResponse("Session not found: " + sessionId))
                            .build());
        }
        return session;
    }

    private String extractFileFormat(String fileName) {
        if (fileName == null || !fileName.contains(".")) {
            return "";
        }
        return fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
    }

    /**
     * Simple error response DTO.
     */
    public record ErrorResponse(String error) {
    }
}
