package com.talktrading.community.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.talktrading.community.dto.CreatePostRequest;
import com.talktrading.community.dto.UpdatePostRequest;
import com.talktrading.community.enums.PostType;
import com.talktrading.community.enums.TradeDirection;
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

import java.math.BigDecimal;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class PostControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PostRepository postRepository;

    @BeforeEach
    void setUp() {
        postRepository.deleteAll();
    }

    @Test
    void createPost_nonTradeIdea_success() throws Exception {
        CreatePostRequest req = CreatePostRequest.builder()
                .postType(PostType.CHART)
                .title("BTC Daily Chart Analysis")
                .content("Symmetrical triangle breakout")
                .build();

        mockMvc.perform(post("/api/v1/posts")
                        .header(UserContextFilter.USER_ID_HEADER, "501")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.userId", is(501)))
                .andExpect(jsonPath("$.postType", is("CHART")))
                .andExpect(jsonPath("$.title", is("BTC Daily Chart Analysis")));
    }

    @Test
    void createPost_tradeIdea_validBuy_success() throws Exception {
        CreatePostRequest req = CreatePostRequest.builder()
                .postType(PostType.TRADE_IDEA)
                .title("BTC Long Idea")
                .content("Long entry setup")
                .symbol("BTC/USD")
                .entryPrice(new BigDecimal("60000"))
                .targetPrice(new BigDecimal("65000"))
                .stopLoss(new BigDecimal("58000"))
                .timeframe("1D")
                .tradeDirection(TradeDirection.BUY)
                .build();

        mockMvc.perform(post("/api/v1/posts")
                        .header(UserContextFilter.USER_ID_HEADER, "501")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.postType", is("TRADE_IDEA")))
                .andExpect(jsonPath("$.tradeDirection", is("BUY")))
                .andExpect(jsonPath("$.entryPrice", is(60000)))
                .andExpect(jsonPath("$.targetPrice", is(65000)))
                .andExpect(jsonPath("$.stopLoss", is(58000)));
    }

    @Test
    void createPost_tradeIdea_validSell_success() throws Exception {
        CreatePostRequest req = CreatePostRequest.builder()
                .postType(PostType.TRADE_IDEA)
                .title("BTC Short Idea")
                .content("Short entry setup")
                .symbol("BTC/USD")
                .entryPrice(new BigDecimal("60000"))
                .targetPrice(new BigDecimal("55000"))
                .stopLoss(new BigDecimal("62000"))
                .timeframe("4H")
                .tradeDirection(TradeDirection.SELL)
                .build();

        mockMvc.perform(post("/api/v1/posts")
                        .header(UserContextFilter.USER_ID_HEADER, "501")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tradeDirection", is("SELL")))
                .andExpect(jsonPath("$.entryPrice", is(60000)))
                .andExpect(jsonPath("$.targetPrice", is(55000)))
                .andExpect(jsonPath("$.stopLoss", is(62000)));
    }

    @Test
    void createPost_tradeIdea_invalidBuy_returnsBadRequest() throws Exception {
        CreatePostRequest req = CreatePostRequest.builder()
                .postType(PostType.TRADE_IDEA)
                .title("Invalid BTC Long")
                .symbol("BTC/USD")
                .entryPrice(new BigDecimal("60000"))
                .targetPrice(new BigDecimal("65000"))
                .stopLoss(new BigDecimal("61000")) // Invalid: stopLoss > entryPrice
                .tradeDirection(TradeDirection.BUY)
                .build();

        mockMvc.perform(post("/api/v1/posts")
                        .header(UserContextFilter.USER_ID_HEADER, "501")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createPost_tradeIdea_invalidSell_returnsBadRequest() throws Exception {
        CreatePostRequest req = CreatePostRequest.builder()
                .postType(PostType.TRADE_IDEA)
                .title("Invalid BTC Short")
                .symbol("BTC/USD")
                .entryPrice(new BigDecimal("60000"))
                .targetPrice(new BigDecimal("65000")) // Invalid: targetPrice > entryPrice for SELL
                .stopLoss(new BigDecimal("62000"))
                .tradeDirection(TradeDirection.SELL)
                .build();

        mockMvc.perform(post("/api/v1/posts")
                        .header(UserContextFilter.USER_ID_HEADER, "501")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updatePost_byOwner_success() throws Exception {
        // Create initial post
        CreatePostRequest createReq = CreatePostRequest.builder()
                .postType(PostType.MARKET_OPINION)
                .title("Initial Opinion")
                .content("Original content")
                .build();

        String response = mockMvc.perform(post("/api/v1/posts")
                        .header(UserContextFilter.USER_ID_HEADER, "501")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        Long postId = objectMapper.readTree(response).get("id").asLong();

        // Update by owner (501)
        UpdatePostRequest updateReq = UpdatePostRequest.builder()
                .title("Updated Opinion")
                .content("Revised content")
                .build();

        mockMvc.perform(put("/api/v1/posts/" + postId)
                        .header(UserContextFilter.USER_ID_HEADER, "501")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title", is("Updated Opinion")))
                .andExpect(jsonPath("$.content", is("Revised content")));
    }

    @Test
    void updatePost_byNonOwner_returnsUnauthorized() throws Exception {
        CreatePostRequest createReq = CreatePostRequest.builder()
                .postType(PostType.EDUCATIONAL)
                .title("Owner Post")
                .content("Content")
                .build();

        String response = mockMvc.perform(post("/api/v1/posts")
                        .header(UserContextFilter.USER_ID_HEADER, "501")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        Long postId = objectMapper.readTree(response).get("id").asLong();

        // Update by non-owner (999)
        UpdatePostRequest updateReq = UpdatePostRequest.builder()
                .title("Hacked Title")
                .build();

        mockMvc.perform(put("/api/v1/posts/" + postId)
                        .header(UserContextFilter.USER_ID_HEADER, "999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deletePost_byOwner_success() throws Exception {
        CreatePostRequest createReq = CreatePostRequest.builder()
                .postType(PostType.SCREENSHOT)
                .title("Chart Screenshot")
                .build();

        String response = mockMvc.perform(post("/api/v1/posts")
                        .header(UserContextFilter.USER_ID_HEADER, "501")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        Long postId = objectMapper.readTree(response).get("id").asLong();

        // Delete by owner
        mockMvc.perform(delete("/api/v1/posts/" + postId)
                        .header(UserContextFilter.USER_ID_HEADER, "501"))
                .andExpect(status().isNoContent());

        // Verify GET post returns 404 Not Found
        mockMvc.perform(get("/api/v1/posts/" + postId))
                .andExpect(status().isNotFound());
    }

    @Test
    void deletePost_byNonOwner_returnsUnauthorized() throws Exception {
        CreatePostRequest createReq = CreatePostRequest.builder()
                .postType(PostType.VIDEO)
                .title("Video Analysis")
                .build();

        String response = mockMvc.perform(post("/api/v1/posts")
                        .header(UserContextFilter.USER_ID_HEADER, "501")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        Long postId = objectMapper.readTree(response).get("id").asLong();

        // Attempt delete by non-owner (999)
        mockMvc.perform(delete("/api/v1/posts/" + postId)
                        .header(UserContextFilter.USER_ID_HEADER, "999"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getPosts_filteringAndPagination() throws Exception {
        // Create 2 posts
        CreatePostRequest p1 = CreatePostRequest.builder().postType(PostType.CHART).title("Chart 1").build();
        CreatePostRequest p2 = CreatePostRequest.builder().postType(PostType.MARKET_ANALYSIS).title("Analysis 1").build();

        mockMvc.perform(post("/api/v1/posts").header(UserContextFilter.USER_ID_HEADER, "501").contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(p1))).andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/posts").header(UserContextFilter.USER_ID_HEADER, "501").contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(p2))).andExpect(status().isCreated());

        // Filter by userId=501 and postType=CHART
        mockMvc.perform(get("/api/v1/posts?userId=501&postType=CHART"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements", is(1)))
                .andExpect(jsonPath("$.content[0].title", is("Chart 1")));
    }
}
