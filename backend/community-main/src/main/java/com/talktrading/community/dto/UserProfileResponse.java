package com.talktrading.community.dto;

import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserProfileResponse {

    private Long id;
    private Long userId;
    private String username;
    private String displayName;
    private String bio;
    private String profileImage;
    private Long followerCount;
    private Long followingCount;
    private Long postCount;
    private Boolean isFollowing;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
