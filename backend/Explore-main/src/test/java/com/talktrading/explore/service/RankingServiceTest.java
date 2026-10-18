package com.talktrading.explore.service;

import com.talktrading.explore.client.dto.ExternalPostDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RankingServiceTest {

    private RankingService rankingService;

    @BeforeEach
    void setUp() {
        rankingService = new RankingService(
                0.30, // engagement
                0.25, // recency
                0.20, // likes
                0.15, // comments
                0.10, // views
                500.0, // baseline likes
                100.0, // baseline comments
                5000.0, // baseline views
                24.0   // recency half life hours
        );
    }

    @Test
    @DisplayName("calculateScore should return 0.0 for null post")
    void calculateScore_NullPost_ReturnsZero() {
        double score = rankingService.calculateScore(null);
        assertThat(score).isEqualTo(0.0);
    }

    @Test
    @DisplayName("calculateScore should return value between 0.0 and 1.0 for valid post")
    void calculateScore_ValidPost_ReturnsBoundedScore() {
        ExternalPostDto post = new ExternalPostDto();
        post.setId(1L);
        post.setLikeCount(250);
        post.setCommentCount(50);
        post.setShareCount(20);
        post.setSaveCount(10);
        post.setViewCount(2500);
        post.setCreatedAt(Instant.now().minus(6, ChronoUnit.HOURS));

        double score = rankingService.calculateScore(post);

        assertThat(score).isGreaterThan(0.0).isLessThanOrEqualTo(1.0);
    }

    @Test
    @DisplayName("normalizeLikes should scale linearly up to baseline and cap at 1.0")
    void normalizeLikes_CapAtOne() {
        assertThat(rankingService.normalizeLikes(0)).isEqualTo(0.0);
        assertThat(rankingService.normalizeLikes(-10)).isEqualTo(0.0);
        assertThat(rankingService.normalizeLikes(250)).isEqualTo(0.5);
        assertThat(rankingService.normalizeLikes(500)).isEqualTo(1.0);
        assertThat(rankingService.normalizeLikes(1000)).isEqualTo(1.0); // capped
    }

    @Test
    @DisplayName("normalizeComments should scale linearly up to baseline and cap at 1.0")
    void normalizeComments_CapAtOne() {
        assertThat(rankingService.normalizeComments(0)).isEqualTo(0.0);
        assertThat(rankingService.normalizeComments(50)).isEqualTo(0.5);
        assertThat(rankingService.normalizeComments(100)).isEqualTo(1.0);
        assertThat(rankingService.normalizeComments(200)).isEqualTo(1.0);
    }

    @Test
    @DisplayName("normalizeViews should scale linearly up to baseline and cap at 1.0")
    void normalizeViews_CapAtOne() {
        assertThat(rankingService.normalizeViews(0)).isEqualTo(0.0);
        assertThat(rankingService.normalizeViews(2500)).isEqualTo(0.5);
        assertThat(rankingService.normalizeViews(5000)).isEqualTo(1.0);
        assertThat(rankingService.normalizeViews(10000)).isEqualTo(1.0);
    }

    @Test
    @DisplayName("normalizeEngagement calculates rate and bounds between 0.0 and 1.0")
    void normalizeEngagement_CalculatesCorrectly() {
        // views = 100, likes = 5, comments = 2, shares = 1, saves = 1
        // total interactions = 5 + (2*2) + (1*3) + 1 = 13
        // rate = 13 / 100 = 0.13
        // normalized = 0.13 / 0.10 = 1.3 -> capped at 1.0
        double norm1 = rankingService.normalizeEngagement(5, 2, 1, 1, 100);
        assertThat(norm1).isEqualTo(1.0);

        // low engagement
        // views = 1000, likes = 1, comments = 0, shares = 0, saves = 0
        // rate = 1 / 1000 = 0.001
        // normalized = 0.001 / 0.10 = 0.01
        double norm2 = rankingService.normalizeEngagement(1, 0, 0, 0, 1000);
        assertThat(norm2).isCloseTo(0.01, org.assertj.core.data.Offset.offset(0.001));

        // effectiveViews minimum bound of 10 when views = 0
        double normZeroViews = rankingService.normalizeEngagement(1, 0, 0, 0, 0);
        // rate = 1 / 10 = 0.10 -> normalized = 1.0
        assertThat(normZeroViews).isEqualTo(1.0);
    }

    @Test
    @DisplayName("normalizeRecency decays exponentially with half-life")
    void normalizeRecency_DecaysWithHalfLife() {
        Instant now = Instant.now();

        // 0 hours old: decay = 1.0
        double recent = rankingService.normalizeRecency(now);
        assertThat(recent).isCloseTo(1.0, org.assertj.core.data.Offset.offset(0.01));

        // 24 hours old (1 half-life): decay ~ 0.5
        double oneHalfLife = rankingService.normalizeRecency(now.minus(24, ChronoUnit.HOURS));
        assertThat(oneHalfLife).isCloseTo(0.5, org.assertj.core.data.Offset.offset(0.05));

        // 48 hours old (2 half-lives): decay ~ 0.25
        double twoHalfLives = rankingService.normalizeRecency(now.minus(48, ChronoUnit.HOURS));
        assertThat(twoHalfLives).isCloseTo(0.25, org.assertj.core.data.Offset.offset(0.05));

        // Future post clamped to 1.0
        double future = rankingService.normalizeRecency(now.plus(1, ChronoUnit.HOURS));
        assertThat(future).isEqualTo(1.0);

        // Null createdAt fallback
        double nullDate = rankingService.normalizeRecency(null);
        assertThat(nullDate).isEqualTo(0.5);
    }

    @Test
    @DisplayName("rankPosts should order posts descending by score")
    void rankPosts_OrdersDescending() {
        ExternalPostDto highPost = new ExternalPostDto();
        highPost.setId(1L);
        highPost.setLikeCount(500);
        highPost.setCommentCount(100);
        highPost.setShareCount(50);
        highPost.setViewCount(5000);
        highPost.setCreatedAt(Instant.now());

        ExternalPostDto lowPost = new ExternalPostDto();
        lowPost.setId(2L);
        lowPost.setLikeCount(5);
        lowPost.setCommentCount(1);
        lowPost.setShareCount(0);
        lowPost.setViewCount(100);
        lowPost.setCreatedAt(Instant.now().minus(7, ChronoUnit.DAYS));

        List<ExternalPostDto> ranked = rankingService.rankPosts(List.of(lowPost, highPost));

        assertThat(ranked).hasSize(2);
        assertThat(ranked.get(0).getId()).isEqualTo(1L);
        assertThat(ranked.get(1).getId()).isEqualTo(2L);
    }

    @Test
    @DisplayName("rankPosts handles empty and null lists safely")
    void rankPosts_EmptyList() {
        assertThat(rankingService.rankPosts(null)).isEmpty();
        assertThat(rankingService.rankPosts(List.of())).isEmpty();
    }
}
