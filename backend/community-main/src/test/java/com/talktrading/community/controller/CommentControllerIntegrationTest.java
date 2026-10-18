package com.talktrading.community.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.talktrading.community.dto.CreateCommentRequest;
import com.talktrading.community.dto.CreatePostRequest;
import com.talktrading.community.dto.UpdateCommentRequest;
import com.talktrading.community.enums.PostType;
import com.talktrading.community.repository.CommentRepository;
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
class CommentControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private CommentRepository commentRepository;

    private Long postId;

    @BeforeEach
    void setUp() throws Exception {
        commentRepository.deleteAll();
        postRepository.deleteAll();

        CreatePostRequest postReq = CreatePostRequest.builder()
                .postType(PostType.MARKET_ANALYSIS)
                .title("Comment Test Post")
                .build();

        String response = mockMvc.perform(post("/api/v1/posts")
                        .header(UserContextFilter.USER_ID_HEADER, "801")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(postReq)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        postId = objectMapper.readTree(response).get("id").asLong();
    }

    @Test
    void commentAndReply_flow() throws Exception {
        // 1. Create root comment by User 801
        CreateCommentRequest rootReq = CreateCommentRequest.builder().content("Root comment 1").build();
        String rootRes = mockMvc.perform(post("/api/v1/posts/" + postId + "/comments")
                        .header(UserContextFilter.USER_ID_HEADER, "801")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(rootReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.content", is("Root comment 1")))
                .andReturn().getResponse().getContentAsString();

        Long rootId = objectMapper.readTree(rootRes).get("id").asLong();

        // 2. Create reply to root comment by User 802
        CreateCommentRequest replyReq = CreateCommentRequest.builder().content("Reply 1").parentCommentId(rootId).build();
        String replyRes = mockMvc.perform(post("/api/v1/posts/" + postId + "/comments")
                        .header(UserContextFilter.USER_ID_HEADER, "802")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(replyReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.parentCommentId", is(rootId.intValue())))
                .andReturn().getResponse().getContentAsString();

        Long replyId = objectMapper.readTree(replyRes).get("id").asLong();

        // 3. Create nested reply to reply 1 by User 803
        CreateCommentRequest nestedReq = CreateCommentRequest.builder().content("Nested reply 2").parentCommentId(replyId).build();
        mockMvc.perform(post("/api/v1/posts/" + postId + "/comments")
                        .header(UserContextFilter.USER_ID_HEADER, "803")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(nestedReq)))
                .andExpect(status().isCreated());

        // 4. Fetch tree
        mockMvc.perform(get("/api/v1/posts/" + postId + "/comments"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].content", is("Root comment 1")))
                .andExpect(jsonPath("$.content[0].replies[0].content", is("Reply 1")))
                .andExpect(jsonPath("$.content[0].replies[0].replies[0].content", is("Nested reply 2")));
    }

    @Test
    void deleteCommentWithReplies_softDeletesContent() throws Exception {
        CreateCommentRequest rootReq = CreateCommentRequest.builder().content("Parent to be deleted").build();
        String rootRes = mockMvc.perform(post("/api/v1/posts/" + postId + "/comments")
                        .header(UserContextFilter.USER_ID_HEADER, "801")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(rootReq)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        Long rootId = objectMapper.readTree(rootRes).get("id").asLong();

        CreateCommentRequest replyReq = CreateCommentRequest.builder().content("Child reply").parentCommentId(rootId).build();
        mockMvc.perform(post("/api/v1/posts/" + postId + "/comments")
                        .header(UserContextFilter.USER_ID_HEADER, "802")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(replyReq)))
                .andExpect(status().isCreated());

        // Delete parent by owner 801
        mockMvc.perform(delete("/api/v1/comments/" + rootId)
                        .header(UserContextFilter.USER_ID_HEADER, "801"))
                .andExpect(status().isNoContent());

        // Fetch tree: parent content should now be [deleted] while child remains
        mockMvc.perform(get("/api/v1/posts/" + postId + "/comments"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].content", is("[deleted]")))
                .andExpect(jsonPath("$.content[0].replies[0].content", is("Child reply")));
    }
}
