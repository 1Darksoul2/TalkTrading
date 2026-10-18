package com.talktrading.community.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.talktrading.community.dto.CreateCommunityRequest;
import com.talktrading.community.dto.CreatePostRequest;
import com.talktrading.community.dto.CreateProfileRequest;
import com.talktrading.community.enums.PostType;
import com.talktrading.community.repository.CommunityRepository;
import com.talktrading.community.repository.PostRepository;
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
class SearchControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserProfileRepository userProfileRepository;

    @Autowired
    private CommunityRepository communityRepository;

    @Autowired
    private PostRepository postRepository;

    @BeforeEach
    void setUp() throws Exception {
        postRepository.deleteAll();
        communityRepository.deleteAll();
        userProfileRepository.deleteAll();

        // Create User Profile
        CreateProfileRequest profileReq = CreateProfileRequest.builder()
                .username("TradingMaster")
                .displayName("Raj Trading")
                .build();
        mockMvc.perform(post("/api/v1/users")
                .header(UserContextFilter.USER_ID_HEADER, "1101")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(profileReq)));

        // Create Community
        CreateCommunityRequest communityReq = CreateCommunityRequest.builder()
                .name("NIFTY Traders")
                .description("NIFTY options discussions")
                .build();
        mockMvc.perform(post("/api/v1/communities")
                .header(UserContextFilter.USER_ID_HEADER, "1101")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(communityReq)));

        // Create Post with Symbol
        CreatePostRequest postReq = CreatePostRequest.builder()
                .postType(PostType.CHART)
                .title("NIFTY 50 Breakout Strategy")
                .content("Watching 22000 level closely")
                .symbol("NIFTY")
                .build();
        mockMvc.perform(post("/api/v1/posts")
                .header(UserContextFilter.USER_ID_HEADER, "1101")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(postReq)));
    }

    @Test
    void searchGlobal_matchesUsersCommunitiesAndPosts() throws Exception {
        mockMvc.perform(get("/api/v1/search?q=nifty"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.communities[0].name", is("NIFTY Traders")))
                .andExpect(jsonPath("$.posts[0].symbol", is("NIFTY")));

        mockMvc.perform(get("/api/v1/search?q=trading"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.users[0].username", is("TradingMaster")));
    }

    @Test
    void searchGlobal_emptyQuery_returnsEmptyResults() throws Exception {
        mockMvc.perform(get("/api/v1/search?q="))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.users", hasSize(0)))
                .andExpect(jsonPath("$.communities", hasSize(0)))
                .andExpect(jsonPath("$.posts", hasSize(0)));
    }
}
