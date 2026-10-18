package com.talktrading.explore.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "user_interests", uniqueConstraints = {
    @UniqueConstraint(name = "uq_user_topic", columnNames = {"user_id", "topic"})
})
public class UserInterest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "topic", nullable = false, length = 100)
    private String topic;

    @Column(name = "weight", nullable = false)
    private Double weight = 1.0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public UserInterest() {
    }

    public UserInterest(Long userId, String topic, Double weight) {
        this.userId = userId;
        this.topic = topic != null ? topic.toLowerCase().trim() : null;
        this.weight = weight != null ? weight : 1.0;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getTopic() {
        return topic;
    }

    public void setTopic(String topic) {
        this.topic = topic != null ? topic.toLowerCase().trim() : null;
    }

    public Double getWeight() {
        return weight;
    }

    public void setWeight(Double weight) {
        this.weight = weight;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
