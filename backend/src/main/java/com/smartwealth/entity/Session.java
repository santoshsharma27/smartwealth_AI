package com.smartwealth.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

/**
 * Session entity representing a user session in SmartWealth AI.
 * Sessions are anonymous (no login) and track demo mode state.
 */
@Entity
@Table(name = "sessions")
public class Session extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(name = "id", updatable = false, nullable = false)
    public UUID id;

    @NotNull
    @Column(name = "created_at", nullable = false, updatable = false)
    public Timestamp createdAt;

    @NotNull
    @Column(name = "last_accessed_at", nullable = false)
    public Timestamp lastAccessedAt;

    @NotNull
    @Column(name = "is_demo_active", nullable = false)
    public boolean isDemoActive;

    @PrePersist
    public void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        Timestamp now = Timestamp.from(Instant.now());
        if (createdAt == null) {
            createdAt = now;
        }
        if (lastAccessedAt == null) {
            lastAccessedAt = now;
        }
    }

    /**
     * Find a session by its UUID.
     */
    public static Session findBySessionId(UUID sessionId) {
        return findById(sessionId);
    }
}
