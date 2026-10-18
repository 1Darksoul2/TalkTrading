package com.talktrading.community.service;

import com.talktrading.community.dto.LikeResponse;
import com.talktrading.community.dto.PageResponse;
import com.talktrading.community.dto.UserProfileResponse;
import org.springframework.data.domain.Pageable;

public interface LikeService {

    LikeResponse likePost(Long authenticatedUserId, Long postId);

    LikeResponse unlikePost(Long authenticatedUserId, Long postId);

    LikeResponse getLikeStatus(Long currentUserId, Long postId);

    PageResponse<UserProfileResponse> getLikesForPost(Long postId, Pageable pageable);
}
