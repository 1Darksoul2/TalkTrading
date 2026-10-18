package com.talktrading.community.service;

import com.talktrading.community.dto.GlobalSearchResponse;
import com.talktrading.community.entity.Community;
import com.talktrading.community.entity.Post;
import com.talktrading.community.entity.UserProfile;
import com.talktrading.community.enums.PostType;
import com.talktrading.community.mapper.CommunityMapper;
import com.talktrading.community.mapper.PostMapper;
import com.talktrading.community.mapper.PostMediaMapper;
import com.talktrading.community.mapper.UserProfileMapper;
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

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SearchServiceImplTest {

    @Mock
    private UserProfileRepository userProfileRepository;

    @Mock
    private CommunityRepository communityRepository;

    @Mock
    private CommunityMemberRepository communityMemberRepository;

    @Mock
    private PostRepository postRepository;

    @Mock
    private PostMediaRepository postMediaRepository;

    @Mock
    private LikeRepository likeRepository;

    @Mock
    private VoteRepository voteRepository;

    @Spy
    private UserProfileMapper userProfileMapper = new UserProfileMapper();

    @Spy
    private CommunityMapper communityMapper = new CommunityMapper();

    @Spy
    private PostMapper postMapper = new PostMapper();

    @Spy
    private PostMediaMapper postMediaMapper = new PostMediaMapper();

    @InjectMocks
    private SearchServiceImpl searchService;

    private UserProfile userProfile;
    private Community community;
    private Post post;

    @BeforeEach
    void setUp() {
        userProfile = UserProfile.builder().userId(101L).username("TraderPro").displayName("Trader Pro").build();
        community = Community.builder().id(1L).name("TradingHub").description("Best trading hub").build();
        post = Post.builder().id(10L).userId(101L).postType(PostType.TRADE_IDEA).title("NIFTY Analysis").symbol("NIFTY").build();
    }

    @Test
    void searchGlobal_success() {
        Pageable pageable = PageRequest.of(0, 10);
        when(userProfileRepository.findByUsernameContainingIgnoreCaseOrDisplayNameContainingIgnoreCase(eq("trade"), eq("trade"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(userProfile)));
        when(communityRepository.findByNameContainingIgnoreCaseOrDescriptionContainingIgnoreCase(eq("trade"), eq("trade"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(community)));
        when(postRepository.findByTitleContainingIgnoreCaseOrContentContainingIgnoreCaseOrSymbolContainingIgnoreCase(eq("trade"), eq("trade"), eq("trade"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(post)));

        GlobalSearchResponse res = searchService.searchGlobal(101L, "trade", pageable);

        assertNotNull(res);
        assertEquals(1, res.getUsers().size());
        assertEquals("TraderPro", res.getUsers().get(0).getUsername());
        assertEquals(1, res.getCommunities().size());
        assertEquals("TradingHub", res.getCommunities().get(0).getName());
        assertEquals(1, res.getPosts().size());
        assertEquals("NIFTY Analysis", res.getPosts().get(0).getTitle());
    }

    @Test
    void searchGlobal_emptyQuery_returnsEmptyLists() {
        Pageable pageable = PageRequest.of(0, 10);

        GlobalSearchResponse res = searchService.searchGlobal(101L, "   ", pageable);

        assertNotNull(res);
        assertTrue(res.getUsers().isEmpty());
        assertTrue(res.getCommunities().isEmpty());
        assertTrue(res.getPosts().isEmpty());
        verifyNoInteractions(userProfileRepository, communityRepository, postRepository);
    }
}
