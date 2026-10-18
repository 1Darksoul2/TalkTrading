package com.talktrading.community.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.talktrading.community.dto.CreatePostRequest;
import com.talktrading.community.enums.PostType;
import com.talktrading.community.repository.PostRepository;
import com.talktrading.community.security.UserContextFilter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class FeedControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PostRepository postRepository;

    @BeforeEach
    void setUp() throws Exception {
        postRepository.deleteAll();

        CreatePostRequest post1 = CreatePostRequest.builder()
                .postType(PostType.CHART)
                .title("Feed Post 1")
                .build();

        CreatePostRequest post2 = CreatePostRequest.builder()
                .postType(PostType.MARKET_OPINION)
                .title("Feed Post 2")
                .build();

        mockMvc.perform(post("/api/v1/posts")
                .header(UserContextFilter.USER_ID_HEADER, "1001")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(post1)));

        mockMvc.perform(post("/api/v1/posts")
                .header(UserContextFilter.USER_ID_HEADER, "1002")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(post2)));
    }

    @Test
    void getFeed_new_returnsPostsInDescendingOrder() throws Exception {
        mockMvc.perform(get("/api/v1/feed?sort=NEW&page=0&size=10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andExpect(jsonPath("$.content[0].title", is("Feed Post 2")));
    }

    @Test
    void getFeed_topAndHot_success() throws Exception {
        mockMvc.perform(get("/api/v1/feed?sort=TOP"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)));

        mockMvc.perform(get("/api/v1/feed?sort=HOT"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)));
    }

    @Test
    void getFeed_pageSizeCapEnforced() throws Exception {
        mockMvc.perform(get("/api/v1/feed?size=100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pageSize", is(50))); // Capped at MAX_PAGE_SIZE = 50
    }
}
