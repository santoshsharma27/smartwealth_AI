package com.smartwealth.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Entity representing an AI-generated financial recommendation for a session.
 */
@Entity
@Table(name = "recommendations")
public class Recommendation extends PanacheEntityBase {

    @Id
    @Column(name = "id", updatable = false, nullable = false)
    public UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    @NotNull
    public Session session;

    @NotNull
    @Min(1)
    @Column(name = "display_order", nullable = false)
    public int displayOrder;

    @NotNull
    @Size(min = 1, max = 50)
    @Column(name = "category", nullable = false, length = 50)
    public String category;

    @NotNull
    @Size(min = 1)
    @Column(name = "text", nullable = false, columnDefinition = "TEXT")
    public String text;

    @NotNull
    @Size(min = 1, max = 255)
    @Column(name = "data_point_reference", nullable = false, length = 255)
    public String dataPointReference;

    @NotNull
    @Column(name = "generated_at", nullable = false)
    public Timestamp generatedAt;

    @PrePersist
    public void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        if (generatedAt == null) {
            generatedAt = Timestamp.from(Instant.now());
        }
    }

    /**
     * Find all recommendations for a session, ordered by display_order.
     */
    public static List<Recommendation> findBySessionId(UUID sessionId) {
        return list("session.id = ?1 order by displayOrder asc", sessionId);
    }

    /**
     * Delete all recommendations for a session (before regenerating).
     */
    public static long deleteBySessionId(UUID sessionId) {
        return delete("session.id", sessionId);
    }
}
