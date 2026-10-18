package com.talktrading.community.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.talktrading.community.dto.CreatePostRequest;
import com.talktrading.community.dto.VoteRequest;
import com.talktrading.community.enums.PostType;
import com.talktrading.community.enums.VoteType;
import com.talktrading.community.repository.PostRepository;
import com.talktrading.community.repository.VoteRepository;
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
class VoteControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private VoteRepository voteRepository;

    private Long postId;

    @BeforeEach
    void setUp() throws Exception {
        voteRepository.deleteAll();
        postRepository.deleteAll();

        CreatePostRequest postReq = CreatePostRequest.builder()
                .postType(PostType.MARKET_ANALYSIS)
                .title("Vote Test Post")
                .build();

        String response = mockMvc.perform(post("/api/v1/posts")
                        .header(UserContextFilter.USER_ID_HEADER, "950")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(postReq)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        postId = objectMapper.readTree(response).get("id").asLong();
    }

    @Test
    void upvoteDownvoteSwitchAndRemove_flow() throws Exception {
        // 1. Upvote by User 951
        VoteRequest upvoteReq = VoteRequest.builder().voteType(VoteType.UPVOTE).build();
        mockMvc.perform(post("/api/v1/posts/" + postId + "/vote")
                        .header(UserContextFilter.USER_ID_HEADER, "951")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(upvoteReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.upvoteCount", is(1)))
                .andExpect(jsonPath("$.score", is(1)))
                .andExpect(jsonPath("$.currentUserVote", is("UPVOTE")));

        // 2. Switch vote to DOWNVOTE by User 951
        VoteRequest downvoteReq = VoteRequest.builder().voteType(VoteType.DOWNVOTE).build();
        mockMvc.perform(post("/api/v1/posts/" + postId + "/vote")
                        .header(UserContextFilter.USER_ID_HEADER, "951")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(downvoteReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.upvoteCount", is(0)))
                .andExpect(jsonPath("$.downvoteCount", is(1)))
                .andExpect(jsonPath("$.score", is(-1)))
                .andExpect(jsonPath("$.currentUserVote", is("DOWNVOTE")));

        // 3. Verify GET /posts/{postId} integration
        mockMvc.perform(get("/api/v1/posts/" + postId)
                        .header(UserContextFilter.USER_ID_HEADER, "951"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.score", is(-1)))
                .andExpect(jsonPath("$.currentUserVote", is("DOWNVOTE")));

        // 4. Remove vote by User 951
        mockMvc.perform(delete("/api/v1/posts/" + postId + "/vote")
                        .header(UserContextFilter.USER_ID_HEADER, "951"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.upvoteCount", is(0)))
                .andExpect(jsonPath("$.downvoteCount", is(0)))
                .andExpect(jsonPath("$.score", is(0)))
                .andExpect(jsonPath("$.currentUserVote", nullValue()));
    }
}
