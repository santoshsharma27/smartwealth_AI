package com.smartwealth.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Document entity mapping to the "documents" table.
 * Stores metadata about uploaded salary slips and bank statements.
 */
@Entity
@Table(name = "documents")
public class Document extends PanacheEntityBase {

    @Id
    @Column(name = "id", updatable = false, nullable = false)
    public UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    @NotNull
    public Session session;

    @NotNull
    @Size(max = 255)
    @Column(name = "file_name", nullable = false, length = 255)
    public String fileName;

    @NotNull
    @Size(max = 10)
    @Column(name = "file_format", nullable = false, length = 10)
    public String fileFormat;

    @NotNull
    @Size(max = 20)
    @Column(name = "document_type", nullable = false, length = 20)
    public String documentType;

    @NotNull
    @Size(max = 512)
    @Column(name = "storage_path", nullable = false, length = 512)
    public String storagePath;

    @NotNull
    @Size(max = 20)
    @Column(name = "status", nullable = false, length = 20)
    public String status = "uploaded";

    @Min(1)
    @Max(15728640)
    @Column(name = "file_size_bytes", nullable = false)
    public int fileSizeBytes;

    @NotNull
    @Column(name = "uploaded_at", nullable = false, updatable = false)
    public Timestamp uploadedAt;

    @Column(name = "processed_at")
    public Timestamp processedAt;

    @PrePersist
    public void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        if (uploadedAt == null) {
            uploadedAt = Timestamp.from(Instant.now());
        }
        if (status == null) {
            status = "uploaded";
        }
    }

    /**
     * Find all documents for a given session.
     */
    public static List<Document> findBySessionId(UUID sessionId) {
        return list("session.id", sessionId);
    }

    /**
     * Find a specific document by ID and session ID.
     */
    public static Document findByIdAndSessionId(UUID docId, UUID sessionId) {
        return find("id = ?1 and session.id = ?2", docId, sessionId).firstResult();
    }
}
