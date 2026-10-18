package com.talktrading.explore.client;

import com.talktrading.explore.client.dto.ExternalPostDto;
import com.talktrading.explore.client.dto.HashtagPostsResponseDto;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Component
public class PostServiceClient {

    private static final Logger log = LoggerFactory.getLogger(PostServiceClient.class);
    private static final String POST_SERVICE_CB = "postService";

    private final RestClient restClient;

    public PostServiceClient(RestClient postServiceRestClient) {
        this.restClient = postServiceRestClient;
    }

    /**
     * Fetches candidate public posts from Post Service.
     */
    @CircuitBreaker(name = POST_SERVICE_CB, fallbackMethod = "fetchCandidatePostsFallback")
    @Retry(name = POST_SERVICE_CB)
    public List<ExternalPostDto> fetchCandidatePosts(int page, int limit) {
        Instant start = Instant.now();
        log.debug("Calling Post Service /api/v1/posts (page={}, limit={})", page, limit);

        try {
            List<ExternalPostDto> posts = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/api/v1/posts")
                            .queryParam("page", page)
                            .queryParam("limit", limit)
                            // This project's Post Service validates visibility against a
                            // lowercase enum ("public"); "PUBLIC" is rejected with HTTP 422.
                            .queryParam("visibility", "public")
                            .build())
                    .retrieve()
                    .body(new ParameterizedTypeReference<List<ExternalPostDto>>() {});

            long latencyMs = Duration.between(start, Instant.now()).toMillis();
            log.info("Post Service /api/v1/posts completed successfully in {} ms, fetched {} posts",
                    latencyMs, posts != null ? posts.size() : 0);

            return posts != null ? posts : Collections.emptyList();
        } catch (Exception ex) {
            long latencyMs = Duration.between(start, Instant.now()).toMillis();
            log.warn("Post Service /api/v1/posts call failed after {} ms: {}", latencyMs, ex.getMessage());
            throw ex;
        }
    }

    /**
     * Fetches public posts tagged with a specific hashtag from Post Service.
     */
    @CircuitBreaker(name = POST_SERVICE_CB, fallbackMethod = "fetchHashtagPostsFallback")
    @Retry(name = POST_SERVICE_CB)
    public List<ExternalPostDto> fetchHashtagPosts(String hashtag, int page, int limit) {
        Instant start = Instant.now();
        String cleanTag = hashtag.replace("#", "").trim();
        log.debug("Calling Post Service /api/v1/hashtags/{}/posts (page={}, limit={})", cleanTag, page, limit);

        try {
            HashtagPostsResponseDto response = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/api/v1/hashtags/{hashtag}/posts")
                            .queryParam("page", page)
                            .queryParam("limit", limit)
                            .build(cleanTag))
                    .retrieve()
                    .body(HashtagPostsResponseDto.class);

            long latencyMs = Duration.between(start, Instant.now()).toMillis();
            log.info("Post Service hashtag '{}' completed in {} ms, fetched {} posts",
                    cleanTag, latencyMs, (response != null && response.getPosts() != null) ? response.getPosts().size() : 0);

            return (response != null && response.getPosts() != null) ? response.getPosts() : Collections.emptyList();
        } catch (Exception ex) {
            long latencyMs = Duration.between(start, Instant.now()).toMillis();
            log.warn("Post Service hashtag '{}' call failed after {} ms: {}", cleanTag, latencyMs, ex.getMessage());
            throw ex;
        }
    }

    /**
     * Fallback for candidate posts if Post Service is degraded or unreachable.
     * Returns an empty list to avoid returning fabricated posts.
     */
    public List<ExternalPostDto> fetchCandidatePostsFallback(int page, int limit, Throwable t) {
        log.warn("Triggered Post Service fallback for candidate posts (page={}, limit={}) due to: {}. Returning empty candidate list.",
                page, limit, t.getMessage());
        return Collections.emptyList();
    }

    /**
     * Fallback for hashtag posts if Post Service is degraded or unreachable.
     */
    public List<ExternalPostDto> fetchHashtagPostsFallback(String hashtag, int page, int limit, Throwable t) {
        log.warn("Triggered Post Service fallback for hashtag '{}' (page={}, limit={}) due to: {}. Returning empty list.",
                hashtag, page, limit, t.getMessage());
        return Collections.emptyList();
    }
}
