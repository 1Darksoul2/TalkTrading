package com.talktrading.explore.service;

import com.talktrading.explore.client.PostServiceClient;
import com.talktrading.explore.client.dto.ExternalPostDto;
import com.talktrading.explore.dto.ExplorePostDto;
import com.talktrading.explore.dto.ExploreResponse;
import com.talktrading.explore.exception.InvalidParameterException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class ExploreService {

    private static final Logger log = LoggerFactory.getLogger(ExploreService.class);
    private static final int MAX_PAGE_SIZE = 50;

    private final PostServiceClient postServiceClient;
    private final RankingService rankingService;
    private final RecommendationService recommendationService;
    private final RedisTemplate<String, Object> redisTemplate;

    // Mutex map to prevent cache stampede on concurrent misses for the same key.
    // NOTE: This lock is JVM-local. In multi-replica deployments behind a load balancer, each pod coordinates
    // its own local request threads, preventing internal stampedes to downstream Post Service without distributed
    // locking overhead. For multi-node distributed stampede protection, a Redis distributed lock (e.g. Redisson
    // or SETNX) can be layered when horizontal scaling requires it.
    private final ConcurrentHashMap<String, Object> keyLocks = new ConcurrentHashMap<>();

    @Value("${app.cache.ttl.trending-minutes:5}")
    private long trendingTtlMinutes;

    @Value("${app.cache.ttl.popular-minutes:15}")
    private long popularTtlMinutes;

    @Value("${app.cache.ttl.recent-minutes:2}")
    private long recentTtlMinutes;

    @Value("${app.cache.ttl.user-minutes:5}")
    private long userTtlMinutes;

    @Value("${app.cache.ttl.hashtag-minutes:10}")
    private long hashtagTtlMinutes;

    public ExploreService(PostServiceClient postServiceClient,
                          RankingService rankingService,
                          RecommendationService recommendationService,
                          RedisTemplate<String, Object> redisTemplate) {
        this.postServiceClient = postServiceClient;
        this.rankingService = rankingService;
        this.recommendationService = recommendationService;
        this.redisTemplate = redisTemplate;
    }

    public void validatePagination(int page, int size) {
        if (page < 0) {
            throw new InvalidParameterException("Invalid page index: " + page + ". Page index must be >= 0.");
        }
        if (size < 1) {
            throw new InvalidParameterException("Invalid page size: " + size + ". Page size must be >= 1.");
        }
        if (size > MAX_PAGE_SIZE) {
            throw new InvalidParameterException("Invalid page size: " + size + ". Maximum permitted page size is " + MAX_PAGE_SIZE + ".");
        }
    }

    /**
     * Deduplicates candidate posts by unique post ID, preserving first-seen ordering.
     */
    private List<ExternalPostDto> deduplicatePosts(List<ExternalPostDto> posts) {
        if (posts == null || posts.isEmpty()) {
            return Collections.emptyList();
        }
        Map<Long, ExternalPostDto> unique = new LinkedHashMap<>();
        for (ExternalPostDto post : posts) {
            if (post != null && post.getId() != null) {
                unique.putIfAbsent(post.getId(), post);
            }
        }
        return new ArrayList<>(unique.values());
    }

    /**
     * Main endpoint: GET /api/v1/explore
     * Generates discoverable and personalized content from Post Service.
     */
    public ExploreResponse getExploreFeed(Long userId, int page, int size, String category, String hashtag) {
        validatePagination(page, size);

        String userSegment = userId != null ? "user:" + userId : "anon";
        String catSegment = (category != null && !category.isBlank()) ? ":cat:" + category.toLowerCase().trim() : "";
        String hashSegment = (hashtag != null && !hashtag.isBlank()) ? ":tag:" + hashtag.toLowerCase().replace("#", "").trim() : "";
        String cacheKey = String.format("explore:%s%s%s:page:%d:size:%d", userSegment, catSegment, hashSegment, page, size);

        return getOrCompute(cacheKey, Duration.ofMinutes(userTtlMinutes), () -> {
            List<ExternalPostDto> rawCandidates;
            if (hashtag != null && !hashtag.isBlank()) {
                rawCandidates = postServiceClient.fetchHashtagPosts(hashtag, 1, 100);
            } else {
                rawCandidates = postServiceClient.fetchCandidatePosts(1, 100);
            }

            // Deduplicate candidate posts by post ID
            List<ExternalPostDto> candidates = deduplicatePosts(rawCandidates);

            // Filter by requested category before ranking and pagination
            boolean hasCategoryFilter = (category != null && !category.isBlank());
            String catLower = hasCategoryFilter ? category.toLowerCase().trim() : null;

            List<ExternalPostDto> categoryFiltered = candidates.stream()
                    .filter(p -> {
                        if (!hasCategoryFilter) return true;
                        List<String> tags = p.getHashtags();
                        return (tags != null && tags.contains(catLower)) ||
                                (p.getCaption() != null && p.getCaption().toLowerCase().contains(catLower));
                    })
                    .toList();

            // Exclude recently seen posts if userId is provided
            Set<Long> seenPostIds = recommendationService.getRecentlySeenPostIds(userId);
            List<ExternalPostDto> unseen = categoryFiltered.stream()
                    .filter(p -> p.getId() != null && !seenPostIds.contains(p.getId()))
                    .toList();

            // Fall back to categoryFiltered only if seen-filtering emptied the pool (so user still sees category content)
            List<ExternalPostDto> pool = (unseen.isEmpty() && !categoryFiltered.isEmpty()) ? categoryFiltered : unseen;

            // Score with ranking and personalization
            List<ExplorePostDto> scored = pool.stream()
                    .map(post -> {
                        double baseScore = rankingService.calculateScore(post);
                        double boost = recommendationService.calculatePersonalizationBoost(userId, post, category);
                        double finalScore = Math.min(1.0, Math.round(baseScore * boost * 10000.0) / 10000.0);
                        return mapToDto(post, finalScore);
                    })
                    .sorted(Comparator.comparingDouble(ExplorePostDto::getScore).reversed())
                    .toList();

            return paginateList(scored, page, size);
        });
    }

    /**
     * GET /api/v1/explore/trending
     * Top trending posts based on fast engagement and recency.
     */
    public ExploreResponse getTrending(int page, int size) {
        validatePagination(page, size);
        String cacheKey = String.format("explore:trending:page:%d:size:%d", page, size);

        return getOrCompute(cacheKey, Duration.ofMinutes(trendingTtlMinutes), () -> {
            List<ExternalPostDto> candidates = deduplicatePosts(postServiceClient.fetchCandidatePosts(1, 100));
            List<ExplorePostDto> scored = candidates.stream()
                    .map(post -> {
                        double score = rankingService.calculateScore(post);
                        return mapToDto(post, score);
                    })
                    .sorted(Comparator.comparingDouble(ExplorePostDto::getScore).reversed())
                    .toList();

            return paginateList(scored, page, size);
        });
    }

    /**
     * GET /api/v1/explore/popular
     * High all-time engagement and like volume.
     */
    public ExploreResponse getPopular(int page, int size) {
        validatePagination(page, size);
        String cacheKey = String.format("explore:popular:page:%d:size:%d", page, size);

        return getOrCompute(cacheKey, Duration.ofMinutes(popularTtlMinutes), () -> {
            List<ExternalPostDto> candidates = deduplicatePosts(postServiceClient.fetchCandidatePosts(1, 100));
            List<ExplorePostDto> scored = candidates.stream()
                    .map(post -> {
                        // Popular emphasizes likes and total interactions more than recency
                        double normLikes = rankingService.normalizeLikes(post.getLikeCount());
                        double normComments = rankingService.normalizeComments(post.getCommentCount());
                        double normViews = rankingService.normalizeViews(post.getViewCount());
                        double normEngagement = rankingService.normalizeEngagement(
                                post.getLikeCount(), post.getCommentCount(), post.getShareCount(), post.getSaveCount(), post.getViewCount()
                        );
                        double popScore = Math.min(1.0, (0.40 * normLikes) + (0.30 * normEngagement) + (0.20 * normComments) + (0.10 * normViews));
                        return mapToDto(post, Math.round(popScore * 10000.0) / 10000.0);
                    })
                    .sorted(Comparator.comparingDouble(ExplorePostDto::getScore).reversed())
                    .toList();

            return paginateList(scored, page, size);
        });
    }

    /**
     * GET /api/v1/explore/recent
     * Most recent posts sorted by creation date with slight engagement tie-breaker.
     */
    public ExploreResponse getRecent(int page, int size) {
        validatePagination(page, size);
        String cacheKey = String.format("explore:recent:page:%d:size:%d", page, size);

        return getOrCompute(cacheKey, Duration.ofMinutes(recentTtlMinutes), () -> {
            List<ExternalPostDto> candidates = deduplicatePosts(postServiceClient.fetchCandidatePosts(1, 100));
            List<ExplorePostDto> scored = candidates.stream()
                    .sorted(Comparator.comparing(ExternalPostDto::getCreatedAt).reversed())
                    .map(post -> {
                        double recencyScore = rankingService.normalizeRecency(post.getCreatedAt());
                        return mapToDto(post, Math.round(recencyScore * 10000.0) / 10000.0);
                    })
                    .toList();

            return paginateList(scored, page, size);
        });
    }

    /**
     * GET /api/v1/explore/hashtags/{hashtag}
     * Posts matching a specific hashtag.
     */
    public ExploreResponse getByHashtag(String hashtag, int page, int size) {
        validatePagination(page, size);
        if (hashtag == null || hashtag.isBlank()) {
            throw new InvalidParameterException("Hashtag path parameter must not be blank.");
        }

        String cleanTag = hashtag.replace("#", "").toLowerCase().trim();
        String cacheKey = String.format("explore:hashtag:%s:page:%d:size:%d", cleanTag, page, size);

        return getOrCompute(cacheKey, Duration.ofMinutes(hashtagTtlMinutes), () -> {
            List<ExternalPostDto> candidates = deduplicatePosts(postServiceClient.fetchHashtagPosts(cleanTag, 1, 100));
            List<ExplorePostDto> scored = candidates.stream()
                    .map(post -> {
                        double score = rankingService.calculateScore(post);
                        return mapToDto(post, score);
                    })
                    .sorted(Comparator.comparingDouble(ExplorePostDto::getScore).reversed())
                    .toList();

            return paginateList(scored, page, size);
        });
    }

    /**
     * Cache-aside execution with stampede protection (mutex locking) and structured hit/miss logging.
     */
    @SuppressWarnings("unchecked")
    private ExploreResponse getOrCompute(String cacheKey, Duration ttl, java.util.function.Supplier<ExploreResponse> supplier) {
        try {
            Object cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached instanceof ExploreResponse exploreResponse) {
                log.info("CACHE HIT [key={}]", cacheKey);
                return exploreResponse;
            } else if (cached instanceof Map<?, ?> map) {
                // In case Jackson deserializes to Map in some Redis configurations
                log.info("CACHE HIT (mapped) [key={}]", cacheKey);
            }
        } catch (Exception ex) {
            log.warn("Redis read failed for key {}: {}", cacheKey, ex.getMessage());
        }

        // Cache miss: lock on the key to prevent concurrent stampede to downstream Post Service
        Object lock = keyLocks.computeIfAbsent(cacheKey, k -> new Object());
        synchronized (lock) {
            try {
                // Double check after acquiring lock
                try {
                    Object cached = redisTemplate.opsForValue().get(cacheKey);
                    if (cached instanceof ExploreResponse exploreResponse) {
                        log.info("CACHE HIT (after lock) [key={}]", cacheKey);
                        return exploreResponse;
                    }
                } catch (Exception ignored) {
                }

                log.info("CACHE MISS [key={}] - computing result from downstream Post Service", cacheKey);
                ExploreResponse result = supplier.get();

                try {
                    // Only cache non-empty responses to prevent downstream outages or empty candidate responses from poisoning the cache
                    if (result != null && result.getContent() != null && !result.getContent().isEmpty()) {
                        redisTemplate.opsForValue().set(cacheKey, result, ttl);
                        log.debug("CACHED RESULT [key={}] with TTL {}s", cacheKey, ttl.toSeconds());
                    }
                } catch (Exception ex) {
                    log.warn("Redis write failed for key {}: {}", cacheKey, ex.getMessage());
                }

                return result;
            } finally {
                keyLocks.remove(cacheKey);
            }
        }
    }

    private ExploreResponse paginateList(List<ExplorePostDto> allItems, int page, int size) {
        if (allItems == null || allItems.isEmpty()) {
            return new ExploreResponse(Collections.emptyList(), page, size, false);
        }

        int fromIndex = page * size;
        if (fromIndex >= allItems.size()) {
            return new ExploreResponse(Collections.emptyList(), page, size, false);
        }

        int toIndex = Math.min(fromIndex + size, allItems.size());
        List<ExplorePostDto> pageContent = allItems.subList(fromIndex, toIndex);
        boolean hasNext = toIndex < allItems.size();

        return new ExploreResponse(pageContent, page, size, hasNext);
    }

    private ExplorePostDto mapToDto(ExternalPostDto post, double score) {
        return new ExplorePostDto(
                String.valueOf(post.getId()),
                String.valueOf(post.getAuthorId()),
                post.getTitle(),
                post.getPrimaryMediaUrl(),
                post.getPrimaryThumbnailUrl(),
                post.getLikeCount(),
                post.getCommentCount(),
                post.getViewCount(),
                post.getHashtags(),
                score
        );
    }
}
