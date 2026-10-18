package com.talktrading.community.service;

import com.talktrading.community.dto.PageResponse;
import com.talktrading.community.dto.PostResponse;
import com.talktrading.community.enums.FeedSort;
import org.springframework.data.domain.Pageable;

public interface FeedService {

    PageResponse<PostResponse> getFeed(Long currentUserId, FeedSort sort, Pageable pageable);

    PageResponse<PostResponse> getFollowingFeed(Long authenticatedUserId, FeedSort sort, Pageable pageable);

    PageResponse<PostResponse> getCommunityPosts(Long communityId, Pageable pageable);

    PageResponse<PostResponse> getUserPosts(Long userId, Pageable pageable);
}
