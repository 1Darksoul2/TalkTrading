package com.talktrading.community.entity;

import com.talktrading.community.enums.PostType;
import com.talktrading.community.enums.TradeDirection;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "posts", indexes = {
    @Index(name = "idx_posts_user_id", columnList = "user_id"),
    @Index(name = "idx_posts_community_id", columnList = "community_id"),
    @Index(name = "idx_posts_created_at", columnList = "created_at"),
    @Index(name = "idx_posts_symbol", columnList = "symbol")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Post {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "community_id")
    private Long communityId;

    @Enumerated(EnumType.STRING)
    @Column(name = "post_type", nullable = false)
    private PostType postType;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    // Trading-specific optional fields
    @Column(length = 20)
    private String symbol;

    @Column(precision = 19, scale = 4)
    private BigDecimal entryPrice;

    @Column(precision = 19, scale = 4)
    private BigDecimal targetPrice;

    @Column(precision = 19, scale = 4)
    private BigDecimal stopLoss;

    @Column(length = 20)
    private String timeframe;

    @Enumerated(EnumType.STRING)
    @Column(name = "trade_direction")
    private TradeDirection tradeDirection;

    // Metrics & Counts
    @Builder.Default
    @Column(name = "like_count", nullable = false)
    private Long likeCount = 0L;

    @Builder.Default
    @Column(name = "comment_count", nullable = false)
    private Long commentCount = 0L;

    @Builder.Default
    @Column(name = "upvote_count", nullable = false)
    private Long upvoteCount = 0L;

    @Builder.Default
    @Column(name = "downvote_count", nullable = false)
    private Long downvoteCount = 0L;

    @Builder.Default
    @Column(nullable = false)
    private Long score = 0L;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
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
