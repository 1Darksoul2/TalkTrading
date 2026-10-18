package com.talktrading.community.mapper;

import com.talktrading.community.dto.UserProfileResponse;
import com.talktrading.community.entity.UserProfile;
import org.springframework.stereotype.Component;

@Component
public class UserProfileMapper {

    public UserProfileResponse toResponse(UserProfile profile) {
        if (profile == null) {
            return null;
        }
        return UserProfileResponse.builder()
                .id(profile.getId())
                .userId(profile.getUserId())
                .username(profile.getUsername())
                .displayName(profile.getDisplayName())
                .bio(profile.getBio())
                .profileImage(profile.getProfileImage())
                .followerCount(profile.getFollowerCount() != null ? profile.getFollowerCount() : 0L)
                .followingCount(profile.getFollowingCount() != null ? profile.getFollowingCount() : 0L)
                .postCount(profile.getPostCount() != null ? profile.getPostCount() : 0L)
                .createdAt(profile.getCreatedAt())
                .updatedAt(profile.getUpdatedAt())
                .build();
    }

    public UserProfileResponse toResponse(UserProfile profile, Boolean isFollowing) {
        UserProfileResponse response = toResponse(profile);
        if (response != null) {
            response.setIsFollowing(isFollowing);
        }
        return response;
    }
}
