package com.talktrading.explore.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.talktrading.explore.config.SecurityUtils;
import com.talktrading.explore.dto.ExplorePostDto;
import com.talktrading.explore.dto.ExploreResponse;
import com.talktrading.explore.dto.UserInteractionRequest;
import com.talktrading.explore.entity.InteractionType;
import com.talktrading.explore.exception.GlobalExceptionHandler;
import com.talktrading.explore.exception.InvalidParameterException;
import com.talktrading.explore.service.ExploreService;
import com.talktrading.explore.service.RecommendationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ExploreController.class)
@Import(GlobalExceptionHandler.class)
class ExploreControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private ExploreService exploreService;

    @MockitoBean
    private RecommendationService recommendationService;

    @MockitoBean
    private SecurityUtils securityUtils;

    private ExplorePostDto createSamplePostDto() {
        return new ExplorePostDto(
                "101",
                "201",
                "Top Trade Setup",
                "https://cdn.talktrading.com/media/101.jpg",
                "https://cdn.talktrading.com/media/101_thumb.jpg",
                500,
                40,
                5000,
                List.of("crypto", "bitcoin"),
                0.925
        );
    }

    @Test
    @DisplayName("GET /api/v1/explore returns 200 OK with paginated feed")
    void getExplore_Success() throws Exception {
        ExploreResponse response = new ExploreResponse(List.of(createSamplePostDto()), 0, 20, false);
        when(securityUtils.resolveUserId(any(), any())).thenReturn(Optional.of(42L));
        when(exploreService.getExploreFeed(eq(42L), eq(0), eq(20), eq("crypto"), isNull())).thenReturn(response);

        mockMvc.perform(get("/api/v1/explore")
                        .param("userId", "42")
                        .param("page", "0")
                        .param("size", "20")
                        .param("category", "crypto")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content[0].postId").value("101"))
                .andExpect(jsonPath("$.content[0].title").value("Top Trade Setup"))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.hasNext").value(false));
    }

    @Test
    @DisplayName("GET /api/v1/explore/trending returns 200 OK")
    void getTrending_Success() throws Exception {
        ExploreResponse response = new ExploreResponse(List.of(createSamplePostDto()), 0, 10, true);
        when(exploreService.getTrending(0, 10)).thenReturn(response);

        mockMvc.perform(get("/api/v1/explore/trending")
                        .param("page", "0")
                        .param("size", "10")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].postId").value("101"))
                .andExpect(jsonPath("$.hasNext").value(true));
    }

    @Test
    @DisplayName("GET /api/v1/explore/popular returns 200 OK")
    void getPopular_Success() throws Exception {
        ExploreResponse response = new ExploreResponse(List.of(createSamplePostDto()), 0, 10, false);
        when(exploreService.getPopular(0, 10)).thenReturn(response);

        mockMvc.perform(get("/api/v1/explore/popular")
                        .param("page", "0")
                        .param("size", "10")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].postId").value("101"));
    }

    @Test
    @DisplayName("GET /api/v1/explore/recent returns 200 OK")
    void getRecent_Success() throws Exception {
        ExploreResponse response = new ExploreResponse(List.of(createSamplePostDto()), 0, 10, false);
        when(exploreService.getRecent(0, 10)).thenReturn(response);

        mockMvc.perform(get("/api/v1/explore/recent")
                        .param("page", "0")
                        .param("size", "10")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].postId").value("101"));
    }

    @Test
    @DisplayName("GET /api/v1/explore/hashtags/{hashtag} returns 200 OK")
    void getByHashtag_Success() throws Exception {
        ExploreResponse response = new ExploreResponse(List.of(createSamplePostDto()), 0, 10, false);
        when(exploreService.getByHashtag("bitcoin", 0, 10)).thenReturn(response);

        mockMvc.perform(get("/api/v1/explore/hashtags/bitcoin")
                        .param("page", "0")
                        .param("size", "10")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].postId").value("101"));
    }

    @Test
    @DisplayName("POST /api/v1/explore/interactions records interaction and returns 201 Created")
    void recordInteraction_Success() throws Exception {
        when(securityUtils.resolveUserId(any(), any())).thenReturn(Optional.of(42L));

        UserInteractionRequest requestDto = new UserInteractionRequest(101L, InteractionType.LIKE, "crypto");

        mockMvc.perform(post("/api/v1/explore/interactions")
                        .param("userId", "42")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(requestDto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("recorded"));

        verify(recommendationService).recordInteraction(42L, 101L, InteractionType.LIKE, "crypto");
    }

    @Test
    @DisplayName("GET /api/v1/explore returns 400 Bad Request on invalid pagination")
    void getExplore_InvalidPagination_ReturnsBadRequest() throws Exception {
        when(exploreService.getExploreFeed(any(), eq(-1), anyInt(), any(), any()))
                .thenThrow(new InvalidParameterException("Page index must be >= 0"));

        mockMvc.perform(get("/api/v1/explore")
                        .param("page", "-1")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message", containsString("Page index must be >= 0")));
    }

    @Test
    @DisplayName("POST /api/v1/explore/interactions returns 401 Unauthorized when userId cannot be resolved")
    void recordInteraction_Unauthorized() throws Exception {
        when(securityUtils.resolveUserId(any(), any())).thenReturn(Optional.empty());

        UserInteractionRequest requestDto = new UserInteractionRequest(101L, InteractionType.LIKE, "crypto");

        mockMvc.perform(post("/api/v1/explore/interactions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(requestDto)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value("unauthorized"));
    }
}
