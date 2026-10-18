package com.talktrading.community.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.talktrading.community.dto.*;
import com.talktrading.community.enums.CommunityRole;
import com.talktrading.community.enums.PostType;
import com.talktrading.community.repository.CommunityMemberRepository;
import com.talktrading.community.repository.CommunityRepository;
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
class CommunityControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private CommunityRepository communityRepository;

    @Autowired
    private CommunityMemberRepository communityMemberRepository;

    @Autowired
    private PostRepository postRepository;

    @BeforeEach
    void setUp() {
        postRepository.deleteAll();
        communityMemberRepository.deleteAll();
        communityRepository.deleteAll();
    }

    @Test
    void createAndGetCommunity_flow() throws Exception {
        CreateCommunityRequest createReq = CreateCommunityRequest.builder()
                .name("Forex Traders Club")
                .description("All about Forex trading")
                .build();

        String response = mockMvc.perform(post("/api/v1/communities")
                        .header(UserContextFilter.USER_ID_HEADER, "701")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.name", is("Forex Traders Club")))
                .andExpect(jsonPath("$.memberCount", is(1)))
                .andExpect(jsonPath("$.currentUserRole", is("OWNER")))
                .andReturn().getResponse().getContentAsString();

        Long communityId = objectMapper.readTree(response).get("id").asLong();

        // Get community
        mockMvc.perform(get("/api/v1/communities/" + communityId)
                        .header(UserContextFilter.USER_ID_HEADER, "701"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name", is("Forex Traders Club")))
                .andExpect(jsonPath("$.currentUserRole", is("OWNER")));
    }

    @Test
    void createCommunity_duplicateName_returnsConflict() throws Exception {
        CreateCommunityRequest req1 = CreateCommunityRequest.builder().name("Crypto Hub").build();
        mockMvc.perform(post("/api/v1/communities")
                        .header(UserContextFilter.USER_ID_HEADER, "701")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req1)))
                .andExpect(status().isCreated());

        CreateCommunityRequest req2 = CreateCommunityRequest.builder().name("crypto hub").build(); // Case-insensitive duplicate
        mockMvc.perform(post("/api/v1/communities")
                        .header(UserContextFilter.USER_ID_HEADER, "702")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req2)))
                .andExpect(status().isConflict());
    }

    @Test
    void joinLeaveAndMembers_flow() throws Exception {
        // Create community by User 701
        CreateCommunityRequest createReq = CreateCommunityRequest.builder().name("Options Trading").build();
        String response = mockMvc.perform(post("/api/v1/communities")
                        .header(UserContextFilter.USER_ID_HEADER, "701")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        Long communityId = objectMapper.readTree(response).get("id").asLong();

        // User 702 joins
        mockMvc.perform(post("/api/v1/communities/" + communityId + "/join")
                        .header(UserContextFilter.USER_ID_HEADER, "702"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role", is("MEMBER")));

        // Duplicate join -> conflict
        mockMvc.perform(post("/api/v1/communities/" + communityId + "/join")
                        .header(UserContextFilter.USER_ID_HEADER, "702"))
                .andExpect(status().isConflict());

        // Verify member count = 2
        mockMvc.perform(get("/api/v1/communities/" + communityId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.memberCount", is(2)));

        // User 702 leaves
        mockMvc.perform(delete("/api/v1/communities/" + communityId + "/join")
                        .header(UserContextFilter.USER_ID_HEADER, "702"))
                .andExpect(status().isNoContent());

        // Verify member count = 1
        mockMvc.perform(get("/api/v1/communities/" + communityId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.memberCount", is(1)));
    }

    @Test
    void ownerLeaving_returnsBadRequest() throws Exception {
        CreateCommunityRequest createReq = CreateCommunityRequest.builder().name("Futures Traders").build();
        String response = mockMvc.perform(post("/api/v1/communities")
                        .header(UserContextFilter.USER_ID_HEADER, "701")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        Long communityId = objectMapper.readTree(response).get("id").asLong();

        // Owner (701) attempts to leave without transferring ownership
        mockMvc.perform(delete("/api/v1/communities/" + communityId + "/join")
                        .header(UserContextFilter.USER_ID_HEADER, "701"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void communityPost_membershipRule() throws Exception {
        CreateCommunityRequest createReq = CreateCommunityRequest.builder().name("Algo Traders").build();
        String response = mockMvc.perform(post("/api/v1/communities")
                        .header(UserContextFilter.USER_ID_HEADER, "701")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        Long communityId = objectMapper.readTree(response).get("id").asLong();

        CreatePostRequest postReq = CreatePostRequest.builder()
                .postType(PostType.MARKET_ANALYSIS)
                .title("Python Backtest Results")
                .content("Strategy overview")
                .build();

        // Non-member (702) attempts to post -> 401 Unauthorized
        mockMvc.perform(post("/api/v1/communities/" + communityId + "/posts")
                        .header(UserContextFilter.USER_ID_HEADER, "702")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(postReq)))
                .andExpect(status().isUnauthorized());

        // Member/Owner (701) posts -> 201 Created
        mockMvc.perform(post("/api/v1/communities/" + communityId + "/posts")
                        .header(UserContextFilter.USER_ID_HEADER, "701")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(postReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.communityId", is(communityId.intValue())));
    }

    @Test
    void nonexistentCommunity_returnsNotFound() throws Exception {
        mockMvc.perform(get("/api/v1/communities/9999"))
                .andExpect(status().isNotFound());
    }
}
