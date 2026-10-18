package com.talktrading.community.service;

import com.talktrading.community.dto.CreateProfileRequest;
import com.talktrading.community.dto.PageResponse;
import com.talktrading.community.dto.UpdateProfileRequest;
import com.talktrading.community.dto.UserProfileResponse;
import org.springframework.data.domain.Pageable;

public interface UserProfileService {
    UserProfileResponse createProfile(Long authenticatedUserId, CreateProfileRequest request);
    UserProfileResponse getProfileByUserId(Long userId, Long currentUserId);
    UserProfileResponse updateProfile(Long authenticatedUserId, Long targetUserId, UpdateProfileRequest request);
    void followUser(Long followerId, Long followingUserId);
    void unfollowUser(Long followerId, Long followingUserId);
    PageResponse<UserProfileResponse> getFollowers(Long userId, Long currentUserId, Pageable pageable);
    PageResponse<UserProfileResponse> getFollowing(Long userId, Long currentUserId, Pageable pageable);
}
