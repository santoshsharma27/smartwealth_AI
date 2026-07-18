package com.smartwealth.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Entity representing a chatbot question-answer pair within a session.
 * Unique constraint on (session_id, sequence_number).
 */
@Entity
@Table(name = "chat_messages", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"session_id", "sequence_number"})
})
public class ChatMessage extends PanacheEntityBase {

    @Id
    @Column(name = "id", updatable = false, nullable = false)
    public UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    @NotNull
    public Session session;

    @NotNull
    @Min(1)
    @Column(name = "sequence_number", nullable = false)
    public int sequenceNumber;

    @NotNull
    @Size(min = 1, max = 500)
    @Column(name = "question", nullable = false, length = 500)
    public String question;

    @NotNull
    @Size(min = 1)
    @Column(name = "answer", nullable = false, columnDefinition = "TEXT")
    public String answer;

    @NotNull
    @Column(name = "created_at", nullable = false)
    public Timestamp createdAt;

    @PrePersist
    public void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        if (createdAt == null) {
            createdAt = Timestamp.from(Instant.now());
        }
    }

    /**
     * Find all chat messages for a session, ordered by sequence number.
     */
    public static List<ChatMessage> findBySessionId(UUID sessionId) {
        return list("session.id = ?1 order by sequenceNumber asc", sessionId);
    }

    /**
     * Get the current max sequence number for a session.
     */
    public static int getMaxSequenceNumber(UUID sessionId) {
        ChatMessage latest = find("session.id = ?1 order by sequenceNumber desc", sessionId).firstResult();
        return latest != null ? latest.sequenceNumber : 0;
    }

    /**
     * Count messages for a session.
     */
    public static long countBySessionId(UUID sessionId) {
        return count("session.id", sessionId);
    }

    /**
     * Delete the oldest message in a session (lowest sequence number).
     */
    public static long deleteOldestBySessionId(UUID sessionId) {
        ChatMessage oldest = find("session.id = ?1 order by sequenceNumber asc", sessionId).firstResult();
        if (oldest != null) {
            oldest.delete();
            return 1;
        }
        return 0;
    }

    /**
     * Delete all chat messages for a session.
     */
    public static long deleteBySessionId(UUID sessionId) {
        return delete("session.id", sessionId);
    }
}
