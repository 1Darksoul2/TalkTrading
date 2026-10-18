package com.talktrading.community.service;

import com.talktrading.community.dto.CreateProfileRequest;
import com.talktrading.community.dto.PageResponse;
import com.talktrading.community.dto.UpdateProfileRequest;
import com.talktrading.community.dto.UserProfileResponse;
import com.talktrading.community.entity.Follow;
import com.talktrading.community.entity.UserProfile;
import com.talktrading.community.exception.BadRequestException;
import com.talktrading.community.exception.ConflictException;
import com.talktrading.community.exception.ResourceNotFoundException;
import com.talktrading.community.exception.UnauthorizedException;
import com.talktrading.community.mapper.UserProfileMapper;
import com.talktrading.community.repository.FollowRepository;
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
class UserProfileServiceImplTest {

    @Mock
    private UserProfileRepository userProfileRepository;

    @Mock
    private FollowRepository followRepository;

    @Spy
    private UserProfileMapper userProfileMapper = new UserProfileMapper();

    @InjectMocks
    private UserProfileServiceImpl userProfileService;

    private UserProfile user1;
    private UserProfile user2;

    @BeforeEach
    void setUp() {
        user1 = UserProfile.builder()
                .id(1L)
                .userId(101L)
                .username("trader_bob")
                .displayName("Bob Trader")
                .bio("Crypto & FX Trader")
                .followerCount(0L)
                .followingCount(0L)
                .build();

        user2 = UserProfile.builder()
                .id(2L)
                .userId(102L)
                .username("alice_trades")
                .displayName("Alice Stocks")
                .bio("Equity analyst")
                .followerCount(0L)
                .followingCount(0L)
                .build();
    }

    @Test
    void createProfile_success() {
        CreateProfileRequest req = CreateProfileRequest.builder()
                .username("trader_bob")
                .displayName("Bob Trader")
                .bio("Crypto & FX Trader")
                .build();

        when(userProfileRepository.existsByUserId(101L)).thenReturn(false);
        when(userProfileRepository.existsByUsernameIgnoreCase("trader_bob")).thenReturn(false);
        when(userProfileRepository.saveAndFlush(any(UserProfile.class))).thenReturn(user1);

        UserProfileResponse res = userProfileService.createProfile(101L, req);

        assertNotNull(res);
        assertEquals("trader_bob", res.getUsername());
        assertEquals("Bob Trader", res.getDisplayName());
    }

    @Test
    void createProfile_mismatchedUserId_throwsUnauthorizedException() {
        CreateProfileRequest req = CreateProfileRequest.builder()
                .userId(999L) // mismatch with authenticated 101L
                .username("trader_bob")
                .displayName("Bob Trader")
                .build();

        assertThrows(UnauthorizedException.class, () -> userProfileService.createProfile(101L, req));
    }

    @Test
    void createProfile_alreadyExists_throwsConflictException() {
        CreateProfileRequest req = CreateProfileRequest.builder().username("trader_bob").displayName("Bob").build();
        when(userProfileRepository.existsByUserId(101L)).thenReturn(true);

        assertThrows(ConflictException.class, () -> userProfileService.createProfile(101L, req));
    }

    @Test
    void createProfile_usernameTakenIgnoreCase_throwsConflictException() {
        CreateProfileRequest req = CreateProfileRequest.builder().username("Trader_Bob").displayName("Bob").build();
        when(userProfileRepository.existsByUserId(101L)).thenReturn(false);
        when(userProfileRepository.existsByUsernameIgnoreCase("Trader_Bob")).thenReturn(true);

        assertThrows(ConflictException.class, () -> userProfileService.createProfile(101L, req));
    }

    @Test
    void getProfileByUserId_success() {
        when(userProfileRepository.findByUserId(101L)).thenReturn(Optional.of(user1));

        UserProfileResponse res = userProfileService.getProfileByUserId(101L, null);
        assertNotNull(res);
        assertEquals(101L, res.getUserId());
    }

    @Test
    void getProfileByUserId_notFound_throwsException() {
        when(userProfileRepository.findByUserId(999L)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> userProfileService.getProfileByUserId(999L, null));
    }

    @Test
    void updateProfile_unauthorized_throwsException() {
        UpdateProfileRequest req = UpdateProfileRequest.builder().displayName("New Name").build();
        assertThrows(UnauthorizedException.class, () -> userProfileService.updateProfile(101L, 102L, req));
    }

    @Test
    void followUser_selfFollow_throwsBadRequestException() {
        assertThrows(BadRequestException.class, () -> userProfileService.followUser(101L, 101L));
    }

    @Test
    void followUser_success() {
        when(userProfileRepository.existsByUserId(102L)).thenReturn(true);
        when(userProfileRepository.existsByUserId(101L)).thenReturn(true);
        when(followRepository.existsByFollowerIdAndFollowingId(101L, 102L)).thenReturn(false);

        userProfileService.followUser(101L, 102L);

        verify(followRepository, times(1)).saveAndFlush(any(Follow.class));
        verify(userProfileRepository, times(1)).incrementFollowerCount(102L);
        verify(userProfileRepository, times(1)).incrementFollowingCount(101L);
    }

    @Test
    void followUser_duplicate_throwsConflictException() {
        when(userProfileRepository.existsByUserId(102L)).thenReturn(true);
        when(userProfileRepository.existsByUserId(101L)).thenReturn(true);
        when(followRepository.existsByFollowerIdAndFollowingId(101L, 102L)).thenReturn(true);

        assertThrows(ConflictException.class, () -> userProfileService.followUser(101L, 102L));
    }

    @Test
    void unfollowUser_success() {
        Follow follow = Follow.builder().id(10L).followerId(101L).followingId(102L).build();
        when(followRepository.findByFollowerIdAndFollowingId(101L, 102L)).thenReturn(Optional.of(follow));

        userProfileService.unfollowUser(101L, 102L);

        verify(followRepository, times(1)).delete(follow);
        verify(followRepository, times(1)).flush();
        verify(userProfileRepository, times(1)).decrementFollowerCount(102L);
        verify(userProfileRepository, times(1)).decrementFollowingCount(101L);
    }

    @Test
    void getFollowers_success() {
        Pageable pageable = PageRequest.of(0, 10);
        Follow follow = Follow.builder().followerId(102L).followingId(101L).build();

        when(userProfileRepository.existsByUserId(101L)).thenReturn(true);
        when(followRepository.findByFollowingId(101L, pageable)).thenReturn(new PageImpl<>(List.of(follow)));
        when(userProfileRepository.findByUserId(102L)).thenReturn(Optional.of(user2));

        PageResponse<UserProfileResponse> followers = userProfileService.getFollowers(101L, null, pageable);
        assertNotNull(followers);
        assertEquals(1, followers.getContent().size());
        assertEquals("alice_trades", followers.getContent().get(0).getUsername());
    }
}
