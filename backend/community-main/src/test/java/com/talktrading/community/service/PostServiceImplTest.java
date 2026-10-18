package com.talktrading.community.service;

import com.talktrading.community.dto.CreatePostRequest;
import com.talktrading.community.dto.PageResponse;
import com.talktrading.community.dto.PostResponse;
import com.talktrading.community.dto.UpdatePostRequest;
import com.talktrading.community.entity.Post;
import com.talktrading.community.enums.PostType;
import com.talktrading.community.enums.TradeDirection;
import com.talktrading.community.exception.BadRequestException;
import com.talktrading.community.exception.ResourceNotFoundException;
import com.talktrading.community.exception.UnauthorizedException;
import com.talktrading.community.mapper.PostMapper;
import com.talktrading.community.repository.PostRepository;
import com.talktrading.community.repository.UserProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PostServiceImplTest {

    @Mock
    private PostRepository postRepository;

    @Mock
    private UserProfileRepository userProfileRepository;

    @Mock
    private com.talktrading.community.repository.PostMediaRepository postMediaRepository;

    @Mock
    private com.talktrading.community.repository.LikeRepository likeRepository;

    @Mock
    private com.talktrading.community.repository.VoteRepository voteRepository;

    @Mock
    private com.talktrading.community.storage.MediaStorageService mediaStorageService;

    @Spy
    private PostMapper postMapper = new PostMapper();

    @Spy
    private com.talktrading.community.mapper.PostMediaMapper postMediaMapper = new com.talktrading.community.mapper.PostMediaMapper();

    @InjectMocks
    private PostServiceImpl postService;

    private Post chartPost;
    private Post tradeIdeaPost;

    @BeforeEach
    void setUp() {
        chartPost = Post.builder()
                .id(1L)
                .userId(101L)
                .postType(PostType.CHART)
                .title("BTC Technical Analysis")
                .content("Looking bullish on 4H")
                .likeCount(0L)
                .commentCount(0L)
                .upvoteCount(0L)
                .downvoteCount(0L)
                .score(0L)
                .build();

        tradeIdeaPost = Post.builder()
                .id(2L)
                .userId(101L)
                .postType(PostType.TRADE_IDEA)
                .title("ETH Long Setup")
                .content("Breakout retest")
                .symbol("ETH/USD")
                .entryPrice(new BigDecimal("3000"))
                .targetPrice(new BigDecimal("3500"))
                .stopLoss(new BigDecimal("2800"))
                .timeframe("4H")
                .tradeDirection(TradeDirection.BUY)
                .likeCount(0L)
                .commentCount(0L)
                .upvoteCount(0L)
                .downvoteCount(0L)
                .score(0L)
                .build();
    }

    @Test
    void createPost_success_nonTradeIdea() {
        CreatePostRequest req = CreatePostRequest.builder()
                .postType(PostType.CHART)
                .title("BTC Technical Analysis")
                .content("Looking bullish on 4H")
                .build();

        when(postRepository.save(any(Post.class))).thenReturn(chartPost);

        PostResponse res = postService.createPost(101L, req);

        assertNotNull(res);
        assertEquals(PostType.CHART, res.getPostType());
        assertEquals("BTC Technical Analysis", res.getTitle());
        verify(userProfileRepository, times(1)).incrementPostCount(101L);
    }

    @Test
    void createPost_success_tradeIdea_buy() {
        CreatePostRequest req = CreatePostRequest.builder()
                .postType(PostType.TRADE_IDEA)
                .title("ETH Long Setup")
                .content("Breakout retest")
                .symbol("ETH/USD")
                .entryPrice(new BigDecimal("3000"))
                .targetPrice(new BigDecimal("3500"))
                .stopLoss(new BigDecimal("2800"))
                .timeframe("4H")
                .tradeDirection(TradeDirection.BUY)
                .build();

        when(postRepository.save(any(Post.class))).thenReturn(tradeIdeaPost);

        PostResponse res = postService.createPost(101L, req);

        assertNotNull(res);
        assertEquals(PostType.TRADE_IDEA, res.getPostType());
        assertEquals(TradeDirection.BUY, res.getTradeDirection());
        assertEquals(new BigDecimal("3000"), res.getEntryPrice());
        verify(userProfileRepository, times(1)).incrementPostCount(101L);
    }

    @Test
    void createPost_invalidTradeIdea_throwsBadRequestException() {
        // Invalid BUY: stopLoss > entryPrice
        CreatePostRequest req = CreatePostRequest.builder()
                .postType(PostType.TRADE_IDEA)
                .title("Invalid Long Setup")
                .symbol("ETH/USD")
                .entryPrice(new BigDecimal("3000"))
                .targetPrice(new BigDecimal("3500"))
                .stopLoss(new BigDecimal("3100"))
                .tradeDirection(TradeDirection.BUY)
                .build();

        assertThrows(BadRequestException.class, () -> postService.createPost(101L, req));
        verify(postRepository, never()).save(any(Post.class));
    }

    @Test
    void createPost_unauthenticated_throwsUnauthorizedException() {
        CreatePostRequest req = CreatePostRequest.builder()
                .postType(PostType.MARKET_OPINION)
                .title("Market Thoughts")
                .build();

        assertThrows(UnauthorizedException.class, () -> postService.createPost(null, req));
    }

    @Test
    void getPostById_success() {
        when(postRepository.findById(1L)).thenReturn(Optional.of(chartPost));

        PostResponse res = postService.getPostById(1L);

        assertNotNull(res);
        assertEquals(1L, res.getId());
        assertEquals("BTC Technical Analysis", res.getTitle());
    }

    @Test
    void getPostById_notFound_throwsResourceNotFoundException() {
        when(postRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> postService.getPostById(999L));
    }

    @Test
    void updatePost_success_owner() {
        UpdatePostRequest req = UpdatePostRequest.builder()
                .title("Updated Title")
                .content("Updated Content")
                .build();

        when(postRepository.findById(1L)).thenReturn(Optional.of(chartPost));
        when(postRepository.save(any(Post.class))).thenReturn(chartPost);

        PostResponse res = postService.updatePost(101L, 1L, req);

        assertNotNull(res);
        verify(postRepository, times(1)).save(chartPost);
    }

    @Test
    void updatePost_unauthorized_nonOwner() {
        UpdatePostRequest req = UpdatePostRequest.builder().title("Hacked Title").build();

        when(postRepository.findById(1L)).thenReturn(Optional.of(chartPost));

        assertThrows(UnauthorizedException.class, () -> postService.updatePost(999L, 1L, req));
        verify(postRepository, never()).save(any(Post.class));
    }

    @Test
    void deletePost_success_owner() {
        when(postRepository.findById(1L)).thenReturn(Optional.of(chartPost));

        postService.deletePost(101L, 1L);

        verify(postRepository, times(1)).delete(chartPost);
        verify(userProfileRepository, times(1)).decrementPostCount(101L);
    }

    @Test
    void deletePost_unauthorized_nonOwner() {
        when(postRepository.findById(1L)).thenReturn(Optional.of(chartPost));

        assertThrows(UnauthorizedException.class, () -> postService.deletePost(999L, 1L));
        verify(postRepository, never()).delete(any(Post.class));
    }

    @Test
    void getPosts_paginated() {
        Pageable pageable = PageRequest.of(0, 10);
        when(postRepository.findByUserIdAndPostType(101L, PostType.CHART, pageable))
                .thenReturn(new PageImpl<>(List.of(chartPost)));

        PageResponse<PostResponse> res = postService.getPosts(101L, PostType.CHART, pageable);

        assertNotNull(res);
        assertEquals(1, res.getContent().size());
        assertEquals("BTC Technical Analysis", res.getContent().get(0).getTitle());
    }
}
