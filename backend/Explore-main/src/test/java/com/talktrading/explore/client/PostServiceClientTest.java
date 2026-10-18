package com.talktrading.explore.client;

import com.talktrading.explore.client.dto.ExternalPostDto;
import com.talktrading.explore.client.dto.HashtagPostsResponseDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Answers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PostServiceClientTest {

    @Mock(answer = Answers.RETURNS_DEEP_STUBS)
    private RestClient restClient;

    private PostServiceClient postServiceClient;

    @BeforeEach
    void setUp() {
        postServiceClient = new PostServiceClient(restClient);
    }

    @Test
    @DisplayName("fetchCandidatePosts successfully returns posts from RestClient")
    void fetchCandidatePosts_Success() {
        ExternalPostDto post = new ExternalPostDto();
        post.setId(100L);
        post.setTitle("Market Update");

        when(restClient.get()
                .uri(any(Function.class))
                .retrieve()
                .body(any(ParameterizedTypeReference.class)))
                .thenReturn(List.of(post));

        List<ExternalPostDto> posts = postServiceClient.fetchCandidatePosts(1, 20);

        assertThat(posts).hasSize(1);
        assertThat(posts.get(0).getId()).isEqualTo(100L);
    }

    @Test
    @DisplayName("fetchHashtagPosts successfully returns posts from RestClient")
    void fetchHashtagPosts_Success() {
        ExternalPostDto post = new ExternalPostDto();
        post.setId(200L);
        post.setTitle("Crypto Trend");

        HashtagPostsResponseDto responseDto = new HashtagPostsResponseDto();
        responseDto.setHashtag("crypto");
        responseDto.setPosts(List.of(post));

        when(restClient.get()
                .uri(any(Function.class))
                .retrieve()
                .body(HashtagPostsResponseDto.class))
                .thenReturn(responseDto);

        List<ExternalPostDto> posts = postServiceClient.fetchHashtagPosts("crypto", 1, 20);

        assertThat(posts).hasSize(1);
        assertThat(posts.get(0).getId()).isEqualTo(200L);
    }

    @Test
    @DisplayName("fetchCandidatePostsFallback returns empty list on circuit breaker trigger to avoid fabricating posts")
    void fetchCandidatePostsFallback_ReturnsEmptyList() {
        List<ExternalPostDto> fallbackPosts = postServiceClient.fetchCandidatePostsFallback(
                1, 20, new RuntimeException("Post Service Down")
        );

        assertThat(fallbackPosts).isEmpty();
    }

    @Test
    @DisplayName("fetchHashtagPostsFallback returns empty list on failure")
    void fetchHashtagPostsFallback_ReturnsEmptyList() {
        List<ExternalPostDto> fallbackPosts = postServiceClient.fetchHashtagPostsFallback(
                "bitcoin", 1, 20, new RuntimeException("Timeout")
        );

        assertThat(fallbackPosts).isEmpty();
    }
}
