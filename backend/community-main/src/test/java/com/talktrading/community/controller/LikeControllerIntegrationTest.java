package com.talktrading.community.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.talktrading.community.dto.CreatePostRequest;
import com.talktrading.community.enums.PostType;
import com.talktrading.community.repository.LikeRepository;
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
class LikeControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private LikeRepository likeRepository;

    private Long postId;

    @BeforeEach
    void setUp() throws Exception {
        likeRepository.deleteAll();
        postRepository.deleteAll();

        CreatePostRequest postReq = CreatePostRequest.builder()
                .postType(PostType.CHART)
                .title("Like Test Post")
                .build();

        String response = mockMvc.perform(post("/api/v1/posts")
                        .header(UserContextFilter.USER_ID_HEADER, "901")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(postReq)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        postId = objectMapper.readTree(response).get("id").asLong();
    }

    @Test
    void likeAndUnlike_flow() throws Exception {
        // User 902 likes
        mockMvc.perform(post("/api/v1/posts/" + postId + "/like")
                        .header(UserContextFilter.USER_ID_HEADER, "902"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.likeCount", is(1)))
                .andExpect(jsonPath("$.hasLiked", is(true)));

        // Duplicate like -> idempotent
        mockMvc.perform(post("/api/v1/posts/" + postId + "/like")
                        .header(UserContextFilter.USER_ID_HEADER, "902"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.likeCount", is(1)));

        // Verify post response hasLiked flag
        mockMvc.perform(get("/api/v1/posts/" + postId)
                        .header(UserContextFilter.USER_ID_HEADER, "902"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.likeCount", is(1)))
                .andExpect(jsonPath("$.hasLiked", is(true)));

        // User 902 unlikes
        mockMvc.perform(delete("/api/v1/posts/" + postId + "/like")
                        .header(UserContextFilter.USER_ID_HEADER, "902"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.likeCount", is(0)))
                .andExpect(jsonPath("$.hasLiked", is(false)));
    }
}
