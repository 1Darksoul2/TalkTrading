package com.talktrading.community.service;

import com.talktrading.community.dto.PageResponse;
import com.talktrading.community.dto.PostResponse;
import com.talktrading.community.entity.CommunityMember;
import com.talktrading.community.entity.Follow;
import com.talktrading.community.entity.Post;
import com.talktrading.community.enums.FeedSort;
import com.talktrading.community.enums.PostType;
import com.talktrading.community.exception.ResourceNotFoundException;
import com.talktrading.community.exception.UnauthorizedException;
import com.talktrading.community.mapper.PostMapper;
import com.talktrading.community.mapper.PostMediaMapper;
import com.talktrading.community.repository.*;
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

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FeedServiceImplTest {

    @Mock
    private PostRepository postRepository;

    @Mock
    private FollowRepository followRepository;

    @Mock
    private CommunityMemberRepository communityMemberRepository;

    @Mock
    private CommunityRepository communityRepository;

    @Mock
    private UserProfileRepository userProfileRepository;

    @Mock
    private PostMediaRepository postMediaRepository;

    @Mock
    private LikeRepository likeRepository;

    @Mock
    private VoteRepository voteRepository;

    @Spy
    private PostMapper postMapper = new PostMapper();

    @Spy
    private PostMediaMapper postMediaMapper = new PostMediaMapper();

    @InjectMocks
    private FeedServiceImpl feedService;

    private Post post1;
    private Post post2;

    @BeforeEach
    void setUp() {
        post1 = Post.builder()
                .id(1L)
                .userId(101L)
                .postType(PostType.CHART)
                .title("Post 1")
                .likeCount(5L)
                .commentCount(2L)
                .score(10L)
                .createdAt(LocalDateTime.now().minusHours(1))
                .build();

        post2 = Post.builder()
                .id(2L)
                .userId(102L)
                .postType(PostType.MARKET_ANALYSIS)
                .title("Post 2")
                .likeCount(100L)
                .commentCount(50L)
                .score(200L)
                .createdAt(LocalDateTime.now().minusHours(24))
                .build();
    }

    @Test
    void getFeed_new_success() {
        Pageable pageable = PageRequest.of(0, 10);
        when(postRepository.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(post1, post2)));

        PageResponse<PostResponse> res = feedService.getFeed(101L, FeedSort.NEW, pageable);

        assertNotNull(res);
        assertEquals(2, res.getContent().size());
    }

    @Test
    void getFeed_top_success() {
        Pageable pageable = PageRequest.of(0, 10);
        when(postRepository.findTopPosts(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(post2, post1)));

        PageResponse<PostResponse> res = feedService.getFeed(101L, FeedSort.TOP, pageable);

        assertNotNull(res);
        assertEquals(2L, res.getContent().get(0).getId());
    }

    @Test
    void getFeed_hot_success() {
        Pageable pageable = PageRequest.of(0, 10);
        when(postRepository.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(post1, post2)));

        PageResponse<PostResponse> res = feedService.getFeed(101L, FeedSort.HOT, pageable);

        assertNotNull(res);
        assertEquals(2, res.getContent().size());
    }

    @Test
    void getFollowingFeed_success() {
        Pageable pageable = PageRequest.of(0, 10);
        Follow follow = Follow.builder().followerId(101L).followingId(102L).build();
        CommunityMember member = CommunityMember.builder().userId(101L).communityId(5L).build();

        when(followRepository.findByFollowerId(101L)).thenReturn(List.of(follow));
        when(communityMemberRepository.findByUserId(101L)).thenReturn(List.of(member));
        when(postRepository.findByUserIdInOrCommunityIdIn(eq(List.of(102L)), eq(List.of(5L)), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(post2)));

        PageResponse<PostResponse> res = feedService.getFollowingFeed(101L, FeedSort.NEW, pageable);

        assertNotNull(res);
        assertEquals(1, res.getContent().size());
        assertEquals(2L, res.getContent().get(0).getId());
    }

    @Test
    void getFollowingFeed_unauthenticated_throwsUnauthorizedException() {
        Pageable pageable = PageRequest.of(0, 10);
        assertThrows(UnauthorizedException.class, () -> feedService.getFollowingFeed(null, FeedSort.NEW, pageable));
    }

    @Test
    void getCommunityPosts_nonexistent_throwsResourceNotFoundException() {
        Pageable pageable = PageRequest.of(0, 10);
        when(communityRepository.existsById(999L)).thenReturn(false);

        assertThrows(ResourceNotFoundException.class, () -> feedService.getCommunityPosts(999L, pageable));
    }

    @Test
    void getUserPosts_nonexistent_throwsResourceNotFoundException() {
        Pageable pageable = PageRequest.of(0, 10);
        when(userProfileRepository.existsByUserId(999L)).thenReturn(false);

        assertThrows(ResourceNotFoundException.class, () -> feedService.getUserPosts(999L, pageable));
    }
}
