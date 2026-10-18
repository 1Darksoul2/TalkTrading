package com.talktrading.community.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.talktrading.community.dto.CreateProfileRequest;
import com.talktrading.community.dto.UpdateProfileRequest;
import com.talktrading.community.repository.FollowRepository;
import com.talktrading.community.repository.UserProfileRepository;
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
class UserProfileControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserProfileRepository userProfileRepository;

    @Autowired
    private FollowRepository followRepository;

    @BeforeEach
    void setUp() {
        followRepository.deleteAll();
        userProfileRepository.deleteAll();
    }

    @Test
    void createAndGetProfile_flow() throws Exception {
        CreateProfileRequest createReq = CreateProfileRequest.builder()
                .username("trader_joe")
                .displayName("Joe Trade")
                .bio("Crypto Daytrader")
                .build();

        mockMvc.perform(post("/api/v1/users")
                        .header(UserContextFilter.USER_ID_HEADER, "201")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId", is(201)))
                .andExpect(jsonPath("$.username", is("trader_joe")))
                .andExpect(jsonPath("$.displayName", is("Joe Trade")));

        mockMvc.perform(get("/api/v1/users/201"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId", is(201)))
                .andExpect(jsonPath("$.username", is("trader_joe")));
    }

    @Test
    void followAndUnfollow_flow() throws Exception {
        // Create Profile 1
        CreateProfileRequest user1Req = CreateProfileRequest.builder()
                .username("trader_1")
                .displayName("Trader One")
                .build();

        mockMvc.perform(post("/api/v1/users")
                        .header(UserContextFilter.USER_ID_HEADER, "1001")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(user1Req)))
                .andExpect(status().isCreated());

        // Create Profile 2
        CreateProfileRequest user2Req = CreateProfileRequest.builder()
                .username("trader_2")
                .displayName("Trader Two")
                .build();

        mockMvc.perform(post("/api/v1/users")
                        .header(UserContextFilter.USER_ID_HEADER, "1002")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(user2Req)))
                .andExpect(status().isCreated());

        // User 1001 follows User 1002
        mockMvc.perform(post("/api/v1/users/1002/follow")
                        .header(UserContextFilter.USER_ID_HEADER, "1001"))
                .andExpect(status().isOk());

        // Duplicate follow -> conflict
        mockMvc.perform(post("/api/v1/users/1002/follow")
                        .header(UserContextFilter.USER_ID_HEADER, "1001"))
                .andExpect(status().isConflict());

        // Check followers of User 1002
        mockMvc.perform(get("/api/v1/users/1002/followers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements", is(1)))
                .andExpect(jsonPath("$.content[0].userId", is(1001)));

        // Unfollow
        mockMvc.perform(delete("/api/v1/users/1002/follow")
                        .header(UserContextFilter.USER_ID_HEADER, "1001"))
                .andExpect(status().isNoContent());

        // Check followers again -> 0
        mockMvc.perform(get("/api/v1/users/1002/followers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements", is(0)));
    }

    @Test
    void createProfile_mismatchedUserId_returnsUnauthorized() throws Exception {
        CreateProfileRequest createReq = CreateProfileRequest.builder()
                .userId(999L) // client attempts to pass another user's ID
                .username("trader_joe")
                .displayName("Joe Trade")
                .build();

        mockMvc.perform(post("/api/v1/users")
                        .header(UserContextFilter.USER_ID_HEADER, "201")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createProfile_caseInsensitiveUsernameConflict_returnsConflict() throws Exception {
        CreateProfileRequest req1 = CreateProfileRequest.builder()
                .username("TraderBob")
                .displayName("Bob Trader")
                .build();

        mockMvc.perform(post("/api/v1/users")
                        .header(UserContextFilter.USER_ID_HEADER, "301")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req1)))
                .andExpect(status().isCreated());

        CreateProfileRequest req2 = CreateProfileRequest.builder()
                .username("traderbob") // same username different casing
                .displayName("Another Bob")
                .build();

        mockMvc.perform(post("/api/v1/users")
                        .header(UserContextFilter.USER_ID_HEADER, "302")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req2)))
                .andExpect(status().isConflict());
    }
}
