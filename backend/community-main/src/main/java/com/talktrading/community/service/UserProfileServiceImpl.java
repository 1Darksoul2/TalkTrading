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
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class UserProfileServiceImpl implements UserProfileService {

    private final UserProfileRepository userProfileRepository;
    private final FollowRepository followRepository;
    private final UserProfileMapper userProfileMapper;

    @Override
    @Transactional
    public UserProfileResponse createProfile(Long authenticatedUserId, CreateProfileRequest request) {
        if (authenticatedUserId == null) {
            throw new UnauthorizedException("User ID is required for profile creation");
        }

        if (request != null && request.getUserId() != null && !request.getUserId().equals(authenticatedUserId)) {
            throw new UnauthorizedException("Cannot create a profile for another user's ID");
        }

        if (userProfileRepository.existsByUserId(authenticatedUserId)) {
            throw new ConflictException("Profile already exists for user ID: " + authenticatedUserId);
        }

        if (request != null && request.getUsername() != null && userProfileRepository.existsByUsernameIgnoreCase(request.getUsername())) {
            throw new ConflictException("Username '" + request.getUsername() + "' is already taken");
        }

        UserProfile profile = UserProfile.builder()
                .userId(authenticatedUserId)
                .username(request != null ? request.getUsername() : null)
                .displayName(request != null ? request.getDisplayName() : null)
                .bio(request != null ? request.getBio() : null)
                .profileImage(request != null ? request.getProfileImage() : null)
                .followerCount(0L)
                .followingCount(0L)
                .postCount(0L)
                .build();

        try {
            UserProfile savedProfile = userProfileRepository.saveAndFlush(profile);
            return userProfileMapper.toResponse(savedProfile, false);
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("Profile creation failed due to database constraint violation (duplicate user ID or username)");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public UserProfileResponse getProfileByUserId(Long userId, Long currentUserId) {
        UserProfile profile = userProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User profile not found for user ID: " + userId));

        Boolean isFollowing = null;
        if (currentUserId != null && !currentUserId.equals(userId)) {
            isFollowing = followRepository.existsByFollowerIdAndFollowingId(currentUserId, userId);
        }

        return userProfileMapper.toResponse(profile, isFollowing);
    }

    @Override
    @Transactional
    public UserProfileResponse updateProfile(Long authenticatedUserId, Long targetUserId, UpdateProfileRequest request) {
        if (authenticatedUserId == null || !authenticatedUserId.equals(targetUserId)) {
            throw new UnauthorizedException("You are not authorized to update this profile");
        }

        UserProfile profile = userProfileRepository.findByUserId(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User profile not found for user ID: " + targetUserId));

        if (request.getDisplayName() != null && !request.getDisplayName().isBlank()) {
            profile.setDisplayName(request.getDisplayName());
        }
        if (request.getBio() != null) {
            profile.setBio(request.getBio());
        }
        if (request.getProfileImage() != null) {
            profile.setProfileImage(request.getProfileImage());
        }

        UserProfile updatedProfile = userProfileRepository.save(profile);
        return userProfileMapper.toResponse(updatedProfile);
    }

    @Override
    @Transactional
    public void followUser(Long followerId, Long followingUserId) {
        if (followerId == null) {
            throw new UnauthorizedException("Authenticated user ID is required to follow");
        }

        if (followerId.equals(followingUserId)) {
            throw new BadRequestException("Users cannot follow themselves");
        }

        if (!userProfileRepository.existsByUserId(followingUserId)) {
            throw new ResourceNotFoundException("User profile to follow not found for ID: " + followingUserId);
        }

        if (!userProfileRepository.existsByUserId(followerId)) {
            throw new ResourceNotFoundException("Your profile must be created before following users");
        }

        if (followRepository.existsByFollowerIdAndFollowingId(followerId, followingUserId)) {
            throw new ConflictException("You are already following this user");
        }

        Follow follow = Follow.builder()
                .followerId(followerId)
                .followingId(followingUserId)
                .build();
        try {
            followRepository.saveAndFlush(follow);
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("You are already following this user");
        }

        // Update counts atomically
        userProfileRepository.incrementFollowerCount(followingUserId);
        userProfileRepository.incrementFollowingCount(followerId);
    }

    @Override
    @Transactional
    public void unfollowUser(Long followerId, Long followingUserId) {
        if (followerId == null) {
            throw new UnauthorizedException("Authenticated user ID is required to unfollow");
        }

        if (followerId.equals(followingUserId)) {
            throw new BadRequestException("Users cannot unfollow themselves");
        }

        Follow follow = followRepository.findByFollowerIdAndFollowingId(followerId, followingUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Follow relationship does not exist"));

        followRepository.delete(follow);
        followRepository.flush();

        // Update counts atomically
        userProfileRepository.decrementFollowerCount(followingUserId);
        userProfileRepository.decrementFollowingCount(followerId);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<UserProfileResponse> getFollowers(Long userId, Long currentUserId, Pageable pageable) {
        if (!userProfileRepository.existsByUserId(userId)) {
            throw new ResourceNotFoundException("User profile not found for user ID: " + userId);
        }

        Page<Follow> followPage = followRepository.findByFollowingId(userId, pageable);
        Page<UserProfileResponse> responsePage = followPage.map(follow -> {
            UserProfile followerProfile = userProfileRepository.findByUserId(follow.getFollowerId())
                    .orElse(null);
            if (followerProfile == null) return null;

            Boolean isFollowing = null;
            if (currentUserId != null && !currentUserId.equals(followerProfile.getUserId())) {
                isFollowing = followRepository.existsByFollowerIdAndFollowingId(currentUserId, followerProfile.getUserId());
            }
            return userProfileMapper.toResponse(followerProfile, isFollowing);
        }).map(Objects::requireNonNull);

        return PageResponse.fromPage(responsePage);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<UserProfileResponse> getFollowing(Long userId, Long currentUserId, Pageable pageable) {
        if (!userProfileRepository.existsByUserId(userId)) {
            throw new ResourceNotFoundException("User profile not found for user ID: " + userId);
        }

        Page<Follow> followPage = followRepository.findByFollowerId(userId, pageable);
        Page<UserProfileResponse> responsePage = followPage.map(follow -> {
            UserProfile followingProfile = userProfileRepository.findByUserId(follow.getFollowingId())
                    .orElse(null);
            if (followingProfile == null) return null;

            Boolean isFollowing = null;
            if (currentUserId != null && !currentUserId.equals(followingProfile.getUserId())) {
                isFollowing = followRepository.existsByFollowerIdAndFollowingId(currentUserId, followingProfile.getUserId());
            }
            return userProfileMapper.toResponse(followingProfile, isFollowing);
        }).map(Objects::requireNonNull);

        return PageResponse.fromPage(responsePage);
    }
}
