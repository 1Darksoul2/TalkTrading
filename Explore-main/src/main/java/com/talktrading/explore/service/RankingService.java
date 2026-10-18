package com.talktrading.explore.service;

import com.talktrading.explore.client.dto.ExternalPostDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;

@Service
public class RankingService implements PostScorer {

    private static final Logger log = LoggerFactory.getLogger(RankingService.class);

    // Weights: 30% engagement, 25% recency, 20% likes, 15% comments, 10% views
    private final double weightEngagement;
    private final double weightRecency;
    private final double weightLikes;
    private final double weightComments;
    private final double weightViews;

    // Normalization baselines
    private final double baselineLikes;
    private final double baselineComments;
    private final double baselineViews;
    private final double recencyHalfLifeHours;

    public RankingService(
            @Value("${app.ranking.weights.engagement:0.30}") double weightEngagement,
            @Value("${app.ranking.weights.recency:0.25}") double weightRecency,
            @Value("${app.ranking.weights.likes:0.20}") double weightLikes,
            @Value("${app.ranking.weights.comments:0.15}") double weightComments,
            @Value("${app.ranking.weights.views:0.10}") double weightViews,
            @Value("${app.ranking.baseline.likes:500.0}") double baselineLikes,
            @Value("${app.ranking.baseline.comments:100.0}") double baselineComments,
            @Value("${app.ranking.baseline.views:5000.0}") double baselineViews,
            @Value("${app.ranking.baseline.recency-half-life-hours:24.0}") double recencyHalfLifeHours
    ) {
        this.weightEngagement = weightEngagement;
        this.weightRecency = weightRecency;
        this.weightLikes = weightLikes;
        this.weightComments = weightComments;
        this.weightViews = weightViews;
        this.baselineLikes = baselineLikes > 0 ? baselineLikes : 500.0;
        this.baselineComments = baselineComments > 0 ? baselineComments : 100.0;
        this.baselineViews = baselineViews > 0 ? baselineViews : 5000.0;
        this.recencyHalfLifeHours = recencyHalfLifeHours > 0 ? recencyHalfLifeHours : 24.0;
    }

    /**
     * Calculates the deterministic ranking score for an external post candidate.
     * Normalized components:
     * - engagement: 30%
     * - recency: 25%
     * - likes: 20%
     * - comments: 15%
     * - views: 10%
     */
    @Override
    public double calculateScore(ExternalPostDto post) {
        if (post == null) {
            return 0.0;
        }

        double normLikes = normalizeLikes(post.getLikeCount());
        double normComments = normalizeComments(post.getCommentCount());
        double normViews = normalizeViews(post.getViewCount());
        double normEngagement = normalizeEngagement(post.getLikeCount(), post.getCommentCount(),
                post.getShareCount(), post.getSaveCount(), post.getViewCount());
        double normRecency = normalizeRecency(post.getCreatedAt());

        double rawScore = (weightEngagement * normEngagement)
                + (weightRecency * normRecency)
                + (weightLikes * normLikes)
                + (weightComments * normComments)
                + (weightViews * normViews);

        // Clamp between 0.0 and 1.0 and round to 4 decimal places
        double clampedScore = Math.max(0.0, Math.min(1.0, rawScore));
        return BigDecimal.valueOf(clampedScore)
                .setScale(4, RoundingMode.HALF_UP)
                .doubleValue();
    }

    public double normalizeLikes(int likes) {
        if (likes <= 0) return 0.0;
        return Math.min(1.0, (double) likes / baselineLikes);
    }

    public double normalizeComments(int comments) {
        if (comments <= 0) return 0.0;
        return Math.min(1.0, (double) comments / baselineComments);
    }

    public double normalizeViews(int views) {
        if (views <= 0) return 0.0;
        return Math.min(1.0, (double) views / baselineViews);
    }

    /**
     * Engagement rate calculation:
     * (likes + 2*comments + 3*shares + saves) / max(views, 10)
     * Normalized against a 10% high-engagement baseline.
     */
    public double normalizeEngagement(int likes, int comments, int shares, int saves, int views) {
        int effectiveViews = Math.max(views, 10);
        double totalInteractions = likes + (comments * 2.0) + (shares * 3.0) + saves;
        double engagementRate = totalInteractions / effectiveViews;

        // Baseline benchmark: 0.10 (10% interaction rate corresponds to 1.0)
        double normalized = engagementRate / 0.10;
        return Math.min(1.0, Math.max(0.0, normalized));
    }

    /**
     * Exponential decay based on post age:
     * decay = 0.5 ^ (age_in_hours / half_life)
     */
    public double normalizeRecency(Instant createdAt) {
        if (createdAt == null) {
            return 0.5; // Neutral fallback
        }
        Instant now = Instant.now();
        if (createdAt.isAfter(now)) {
            return 1.0;
        }

        double ageHours = Math.max(0.0, Duration.between(createdAt, now).toSeconds() / 3600.0);
        double decay = Math.pow(0.5, ageHours / recencyHalfLifeHours);
        return Math.min(1.0, Math.max(0.0, decay));
    }

    /**
     * Sorts posts in descending order of their calculated scores.
     */
    public List<ExternalPostDto> rankPosts(List<ExternalPostDto> posts) {
        if (posts == null || posts.isEmpty()) {
            return List.of();
        }

        return posts.stream()
                .sorted(Comparator.comparingDouble(this::calculateScore).reversed())
                .toList();
    }
}
