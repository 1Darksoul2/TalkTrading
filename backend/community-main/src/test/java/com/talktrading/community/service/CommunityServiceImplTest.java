package com.talktrading.community.service;

import com.talktrading.community.dto.*;
import com.talktrading.community.entity.Community;
import com.talktrading.community.entity.CommunityMember;
import com.talktrading.community.enums.CommunityRole;
import com.talktrading.community.enums.PostType;
import com.talktrading.community.exception.BadRequestException;
import com.talktrading.community.exception.ConflictException;
import com.talktrading.community.exception.ResourceNotFoundException;
import com.talktrading.community.exception.UnauthorizedException;
import com.talktrading.community.mapper.CommunityMapper;
import com.talktrading.community.mapper.CommunityMemberMapper;
import com.talktrading.community.repository.CommunityMemberRepository;
import com.talktrading.community.repository.CommunityRepository;
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

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CommunityServiceImplTest {

    @Mock
    private CommunityRepository communityRepository;

    @Mock
    private CommunityMemberRepository communityMemberRepository;

    @Mock
    private UserProfileRepository userProfileRepository;

    @Mock
    private PostService postService;

    @Spy
    private CommunityMapper communityMapper = new CommunityMapper();

    @Spy
    private CommunityMemberMapper communityMemberMapper = new CommunityMemberMapper();

    @InjectMocks
    private CommunityServiceImpl communityService;

    private Community cryptoCommunity;
    private CommunityMember ownerMember;
    private CommunityMember regularMember;

    @BeforeEach
    void setUp() {
        cryptoCommunity = Community.builder()
                .id(1L)
                .name("Crypto Traders")
                .description("Crypto discussions")
                .createdBy(101L)
                .memberCount(1L)
                .build();

        ownerMember = CommunityMember.builder()
                .id(10L)
                .communityId(1L)
                .userId(101L)
                .role(CommunityRole.OWNER)
                .build();

        regularMember = CommunityMember.builder()
                .id(11L)
                .communityId(1L)
                .userId(102L)
                .role(CommunityRole.MEMBER)
                .build();
    }

    @Test
    void createCommunity_success() {
        CreateCommunityRequest req = CreateCommunityRequest.builder()
                .name("Crypto Traders")
                .description("Crypto discussions")
                .build();

        when(communityRepository.existsByNameIgnoreCase("Crypto Traders")).thenReturn(false);
        when(communityRepository.saveAndFlush(any(Community.class))).thenReturn(cryptoCommunity);

        CommunityResponse res = communityService.createCommunity(101L, req);

        assertNotNull(res);
        assertEquals("Crypto Traders", res.getName());
        assertEquals(CommunityRole.OWNER, res.getCurrentUserRole());
        verify(communityMemberRepository, times(1)).save(any(CommunityMember.class));
    }

    @Test
    void createCommunity_duplicateName_throwsConflictException() {
        CreateCommunityRequest req = CreateCommunityRequest.builder().name("Crypto Traders").build();
        when(communityRepository.existsByNameIgnoreCase("Crypto Traders")).thenReturn(true);

        assertThrows(ConflictException.class, () -> communityService.createCommunity(101L, req));
    }

    @Test
    void getCommunityById_success() {
        when(communityRepository.findById(1L)).thenReturn(Optional.of(cryptoCommunity));
        when(communityMemberRepository.findByCommunityIdAndUserId(1L, 101L)).thenReturn(Optional.of(ownerMember));

        CommunityResponse res = communityService.getCommunityById(101L, 1L);

        assertNotNull(res);
        assertEquals(1L, res.getId());
        assertEquals(CommunityRole.OWNER, res.getCurrentUserRole());
    }

    @Test
    void getCommunityById_nonexistent_throwsResourceNotFoundException() {
        when(communityRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> communityService.getCommunityById(101L, 999L));
    }

    @Test
    void joinCommunity_success() {
        when(communityRepository.findById(1L)).thenReturn(Optional.of(cryptoCommunity));
        when(communityMemberRepository.existsByCommunityIdAndUserId(1L, 102L)).thenReturn(false);
        when(communityMemberRepository.saveAndFlush(any(CommunityMember.class))).thenReturn(regularMember);

        CommunityMemberResponse res = communityService.joinCommunity(102L, 1L);

        assertNotNull(res);
        assertEquals(102L, res.getUserId());
        assertEquals(CommunityRole.MEMBER, res.getRole());
        verify(communityRepository, times(1)).incrementMemberCount(1L);
    }

    @Test
    void joinCommunity_duplicateJoin_throwsConflictException() {
        when(communityRepository.findById(1L)).thenReturn(Optional.of(cryptoCommunity));
        when(communityMemberRepository.existsByCommunityIdAndUserId(1L, 102L)).thenReturn(true);

        assertThrows(ConflictException.class, () -> communityService.joinCommunity(102L, 1L));
    }

    @Test
    void leaveCommunity_success() {
        when(communityRepository.existsById(1L)).thenReturn(true);
        when(communityMemberRepository.findByCommunityIdAndUserId(1L, 102L)).thenReturn(Optional.of(regularMember));

        communityService.leaveCommunity(102L, 1L);

        verify(communityMemberRepository, times(1)).delete(regularMember);
        verify(communityRepository, times(1)).decrementMemberCount(1L);
    }

    @Test
    void leaveCommunity_ownerAttempt_throwsBadRequestException() {
        when(communityRepository.existsById(1L)).thenReturn(true);
        when(communityMemberRepository.findByCommunityIdAndUserId(1L, 101L)).thenReturn(Optional.of(ownerMember));

        assertThrows(BadRequestException.class, () -> communityService.leaveCommunity(101L, 1L));
    }

    @Test
    void updateMemberRole_ownerAssignsModerator_success() {
        when(communityRepository.existsById(1L)).thenReturn(true);
        when(communityMemberRepository.findByCommunityIdAndUserId(1L, 101L)).thenReturn(Optional.of(ownerMember));
        when(communityMemberRepository.findByCommunityIdAndUserId(1L, 102L)).thenReturn(Optional.of(regularMember));
        when(communityMemberRepository.save(any(CommunityMember.class))).thenReturn(regularMember);

        CommunityMemberResponse res = communityService.updateMemberRole(101L, 1L, 102L, CommunityRole.MODERATOR);

        assertNotNull(res);
        verify(communityMemberRepository, times(1)).save(regularMember);
    }

    @Test
    void updateMemberRole_nonOwnerAttempt_throwsUnauthorizedException() {
        when(communityRepository.existsById(1L)).thenReturn(true);
        when(communityMemberRepository.findByCommunityIdAndUserId(1L, 102L)).thenReturn(Optional.of(regularMember));

        assertThrows(UnauthorizedException.class, () -> communityService.updateMemberRole(102L, 1L, 101L, CommunityRole.MODERATOR));
    }

    @Test
    void createCommunityPost_member_success() {
        CreatePostRequest postReq = CreatePostRequest.builder().postType(PostType.CHART).title("Chart").build();
        PostResponse expectedResponse = PostResponse.builder().id(100L).title("Chart").build();

        when(communityRepository.existsById(1L)).thenReturn(true);
        when(communityMemberRepository.existsByCommunityIdAndUserId(1L, 102L)).thenReturn(true);
        when(postService.createPost(eq(102L), any(CreatePostRequest.class))).thenReturn(expectedResponse);

        PostResponse res = communityService.createCommunityPost(102L, 1L, postReq);

        assertNotNull(res);
        assertEquals(100L, res.getId());
    }

    @Test
    void createCommunityPost_nonMember_throwsUnauthorizedException() {
        CreatePostRequest postReq = CreatePostRequest.builder().postType(PostType.CHART).title("Chart").build();

        when(communityRepository.existsById(1L)).thenReturn(true);
        when(communityMemberRepository.existsByCommunityIdAndUserId(1L, 999L)).thenReturn(false);

        assertThrows(UnauthorizedException.class, () -> communityService.createCommunityPost(999L, 1L, postReq));
        verify(postService, never()).createPost(any(), any());
    }
}
