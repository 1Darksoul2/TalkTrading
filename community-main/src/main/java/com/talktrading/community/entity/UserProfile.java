package com.talktrading.community.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_profiles", uniqueConstraints = {
    @UniqueConstraint(name = "uk_user_profiles_user_id", columnNames = {"user_id"}),
    @UniqueConstraint(name = "uk_user_profiles_username", columnNames = {"username"})
}, indexes = {
    @Index(name = "idx_up_user_id", columnList = "user_id"),
    @Index(name = "idx_up_username", columnList = "username")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false, length = 100)
    private String displayName;

    @Column(length = 500)
    private String bio;

    @Column(length = 255)
    private String profileImage;

    @Builder.Default
    @Column(nullable = false)
    private Long followerCount = 0L;

    @Builder.Default
    @Column(nullable = false)
    private Long followingCount = 0L;

    @Builder.Default
    @Column(nullable = false)
    private Long postCount = 0L;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
