package com.talktrading.explore.service;

import com.talktrading.explore.client.PostServiceClient;
import com.talktrading.explore.client.dto.ExternalPostDto;
import com.talktrading.explore.dto.ExplorePostDto;
import com.talktrading.explore.dto.ExploreResponse;
import com.talktrading.explore.exception.InvalidParameterException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExploreServiceTest {

    @Mock
    private PostServiceClient postServiceClient;

    @Mock
    private RankingService rankingService;

    @Mock
    private RecommendationService recommendationService;

    @Mock
    private RedisTemplate<String, Object> redisTemplate;

    @Mock
    private ValueOperations<String, Object> valueOperations;

    @InjectMocks
    private ExploreService exploreService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(exploreService, "trendingTtlMinutes", 5L);
        ReflectionTestUtils.setField(exploreService, "popularTtlMinutes", 15L);
        ReflectionTestUtils.setField(exploreService, "recentTtlMinutes", 2L);
        ReflectionTestUtils.setField(exploreService, "userTtlMinutes", 5L);
        ReflectionTestUtils.setField(exploreService, "hashtagTtlMinutes", 10L);

        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
    }

    private ExternalPostDto createSamplePost(Long id, String title, int likes, Instant createdAt) {
        ExternalPostDto post = new ExternalPostDto();
        post.setId(id);
        post.setAuthorId(10L);
        post.setTitle(title);
        post.setCaption("Caption for " + title + " #crypto");
        post.setLikeCount(likes);
        post.setCommentCount(10);
        post.setShareCount(5);
        post.setViewCount(1000);
        post.setHashtags(List.of("crypto"));
        post.setCreatedAt(createdAt);
        return post;
    }

    @Test
    @DisplayName("validatePagination throws InvalidParameterException on negative page")
    void validatePagination_NegativePage_ThrowsException() {
        assertThatThrownBy(() -> exploreService.validatePagination(-1, 20))
                .isInstanceOf(InvalidParameterException.class)
                .hasMessageContaining("Page index must be >= 0");
    }

    @Test
    @DisplayName("validatePagination throws InvalidParameterException on zero or negative size")
    void validatePagination_ZeroSize_ThrowsException() {
        assertThatThrownBy(() -> exploreService.validatePagination(0, 0))
                .isInstanceOf(InvalidParameterException.class)
                .hasMessageContaining("Page size must be >= 1");
    }

    @Test
    @DisplayName("validatePagination throws InvalidParameterException when size exceeds max limit")
    void validatePagination_ExcessiveSize_ThrowsException() {
        assertThatThrownBy(() -> exploreService.validatePagination(0, 51))
                .isInstanceOf(InvalidParameterException.class)
                .hasMessageContaining("Maximum permitted page size is 50");
    }

    @Test
    @DisplayName("getExploreFeed returns cached response when present in Redis")
    void getExploreFeed_CacheHit_ReturnsCached() {
        ExploreResponse cached = new ExploreResponse(Collections.emptyList(), 0, 20, false);
        when(valueOperations.get(anyString())).thenReturn(cached);

        ExploreResponse response = exploreService.getExploreFeed(1L, 0, 20, null, null);

        assertThat(response).isSameAs(cached);
        verifyNoInteractions(postServiceClient);
    }

    @Test
    @DisplayName("getExploreFeed fetches, scores, filters, paginates, and caches on cache miss")
    void getExploreFeed_CacheMiss_ComputesAndCaches() {
        when(valueOperations.get(anyString())).thenReturn(null);

        ExternalPostDto post1 = createSamplePost(1L, "Bitcoin Breakthrough", 100, Instant.now());
        ExternalPostDto post2 = createSamplePost(2L, "Ethereum Merge", 50, Instant.now());
        ExternalPostDto seenPost = createSamplePost(3L, "Seen Post", 200, Instant.now());

        when(postServiceClient.fetchCandidatePosts(1, 100)).thenReturn(List.of(post1, post2, seenPost));
        when(recommendationService.getRecentlySeenPostIds(42L)).thenReturn(Set.of(3L));
        when(rankingService.calculateScore(post1)).thenReturn(0.85);
        when(rankingService.calculateScore(post2)).thenReturn(0.60);
        when(recommendationService.calculatePersonalizationBoost(eq(42L), any(), any())).thenReturn(1.0);

        ExploreResponse response = exploreService.getExploreFeed(42L, 0, 10, "crypto", null);

        assertThat(response.getContent()).hasSize(2);
        assertThat(response.getContent().get(0).getPostId()).isEqualTo("1");
        assertThat(response.getContent().get(1).getPostId()).isEqualTo("2");
        assertThat(response.getPage()).isEqualTo(0);
        assertThat(response.getSize()).isEqualTo(10);
        assertThat(response.isHasNext()).isFalse();

        // Verify cache write
        verify(valueOperations).set(anyString(), any(ExploreResponse.class), any(Duration.class));
    }

    @Test
    @DisplayName("getTrending retrieves, scores, and paginates trending posts")
    void getTrending_ComputesCorrectly() {
        when(valueOperations.get(anyString())).thenReturn(null);

        ExternalPostDto post1 = createSamplePost(1L, "Trending Trade 1", 100, Instant.now());
        ExternalPostDto post2 = createSamplePost(2L, "Trending Trade 2", 300, Instant.now());

        when(postServiceClient.fetchCandidatePosts(1, 100)).thenReturn(List.of(post1, post2));
        when(rankingService.calculateScore(post1)).thenReturn(0.50);
        when(rankingService.calculateScore(post2)).thenReturn(0.90);

        ExploreResponse response = exploreService.getTrending(0, 10);

        assertThat(response.getContent()).hasSize(2);
        // post2 with score 0.90 should be first
        assertThat(response.getContent().get(0).getPostId()).isEqualTo("2");
        assertThat(response.getContent().get(1).getPostId()).isEqualTo("1");
    }

    @Test
    @DisplayName("getPopular scores based on likes, comments, and engagement rates")
    void getPopular_ComputesCorrectly() {
        when(valueOperations.get(anyString())).thenReturn(null);

        ExternalPostDto post = createSamplePost(10L, "All-Time Great", 1000, Instant.now());
        when(postServiceClient.fetchCandidatePosts(1, 100)).thenReturn(List.of(post));
        when(rankingService.normalizeLikes(anyInt())).thenReturn(1.0);
        when(rankingService.normalizeComments(anyInt())).thenReturn(0.5);
        when(rankingService.normalizeViews(anyInt())).thenReturn(0.8);
        when(rankingService.normalizeEngagement(anyInt(), anyInt(), anyInt(), anyInt(), anyInt())).thenReturn(0.9);

        ExploreResponse response = exploreService.getPopular(0, 10);

        assertThat(response.getContent()).hasSize(1);
        assertThat(response.getContent().get(0).getPostId()).isEqualTo("10");
        assertThat(response.getContent().get(0).getScore()).isGreaterThan(0.0);
    }

    @Test
    @DisplayName("getRecent sorts chronologically descending by createdAt")
    void getRecent_SortsChronologically() {
        when(valueOperations.get(anyString())).thenReturn(null);

        Instant now = Instant.now();
        ExternalPostDto older = createSamplePost(1L, "Older", 50, now.minusSeconds(3600));
        ExternalPostDto newer = createSamplePost(2L, "Newer", 50, now);

        when(postServiceClient.fetchCandidatePosts(1, 100)).thenReturn(List.of(older, newer));
        when(rankingService.normalizeRecency(any())).thenReturn(0.95);

        ExploreResponse response = exploreService.getRecent(0, 10);

        assertThat(response.getContent()).hasSize(2);
        assertThat(response.getContent().get(0).getPostId()).isEqualTo("2");
        assertThat(response.getContent().get(1).getPostId()).isEqualTo("1");
    }

    @Test
    @DisplayName("getByHashtag fetches posts for hashtag and validates blank tag")
    void getByHashtag_ValidatesAndFetches() {
        assertThatThrownBy(() -> exploreService.getByHashtag("", 0, 10))
                .isInstanceOf(InvalidParameterException.class)
                .hasMessageContaining("Hashtag path parameter must not be blank");

        when(valueOperations.get(anyString())).thenReturn(null);
        ExternalPostDto post = createSamplePost(1L, "Hashtag Match", 50, Instant.now());
        when(postServiceClient.fetchHashtagPosts("bitcoin", 1, 100)).thenReturn(List.of(post));
        when(rankingService.calculateScore(post)).thenReturn(0.75);

        ExploreResponse response = exploreService.getByHashtag("#bitcoin", 0, 10);

        assertThat(response.getContent()).hasSize(1);
        assertThat(response.getContent().get(0).getPostId()).isEqualTo("1");
    }

    @Test
    @DisplayName("getExploreFeed removes duplicate candidate posts with the same ID")
    void getExploreFeed_DeduplicatesCandidatePostsById() {
        when(valueOperations.get(anyString())).thenReturn(null);

        ExternalPostDto post1 = createSamplePost(10L, "Duplicate 1", 50, Instant.now());
        ExternalPostDto post1Duplicate = createSamplePost(10L, "Duplicate 1 (again)", 50, Instant.now());
        ExternalPostDto post2 = createSamplePost(20L, "Unique Post", 60, Instant.now());

        when(postServiceClient.fetchCandidatePosts(1, 100)).thenReturn(List.of(post1, post1Duplicate, post2));
        when(rankingService.calculateScore(any())).thenReturn(0.80);
        when(recommendationService.calculatePersonalizationBoost(any(), any(), any())).thenReturn(1.0);

        ExploreResponse response = exploreService.getExploreFeed(null, 0, 10, null, null);

        assertThat(response.getContent()).hasSize(2);
        assertThat(response.getContent().stream().map(ExplorePostDto::getPostId).toList())
                .containsExactly("10", "20");
    }

    @Test
    @DisplayName("getExploreFeed strictly respects category filter and does not return unrelated posts when no match")
    void getExploreFeed_CategoryFilter_DoesNotReturnUnrelatedCategories() {
        when(valueOperations.get(anyString())).thenReturn(null);

        ExternalPostDto cryptoPost = createSamplePost(1L, "Crypto Trade", 50, Instant.now());
        // Default sample post has tag "crypto"
        when(postServiceClient.fetchCandidatePosts(1, 100)).thenReturn(List.of(cryptoPost));

        // User requests category "forex" which does not match
        ExploreResponse response = exploreService.getExploreFeed(null, 0, 10, "forex", null);

        assertThat(response.getContent()).isEmpty();
    }

    @Test
    @DisplayName("getExploreFeed does not cache empty responses when candidate fetch returns empty")
    void getExploreFeed_EmptyCandidates_DoesNotPoisonCache() {
        when(valueOperations.get(anyString())).thenReturn(null);
        when(postServiceClient.fetchCandidatePosts(1, 100)).thenReturn(Collections.emptyList());

        ExploreResponse response = exploreService.getExploreFeed(null, 0, 10, null, null);

        assertThat(response.getContent()).isEmpty();
        verify(valueOperations, never()).set(anyString(), any(), any(Duration.class));
    }
}
