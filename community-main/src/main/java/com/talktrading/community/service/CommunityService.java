package com.talktrading.community.service;

import com.talktrading.community.dto.*;
import com.talktrading.community.enums.CommunityRole;
import org.springframework.data.domain.Pageable;

public interface CommunityService {

    CommunityResponse createCommunity(Long authenticatedUserId, CreateCommunityRequest request);

    PageResponse<CommunityResponse> getCommunities(Long currentUserId, String search, Pageable pageable);

    CommunityResponse getCommunityById(Long currentUserId, Long communityId);

    CommunityResponse updateCommunity(Long authenticatedUserId, Long communityId, UpdateCommunityRequest request);

    void deleteCommunity(Long authenticatedUserId, Long communityId);

    CommunityMemberResponse joinCommunity(Long authenticatedUserId, Long communityId);

    void leaveCommunity(Long authenticatedUserId, Long communityId);

    void removeMember(Long authenticatedUserId, Long communityId, Long targetUserId);

    CommunityMemberResponse updateMemberRole(Long authenticatedUserId, Long communityId, Long targetUserId, CommunityRole newRole);

    PageResponse<CommunityMemberResponse> getCommunityMembers(Long communityId, Pageable pageable);

    PostResponse createCommunityPost(Long authenticatedUserId, Long communityId, CreatePostRequest request);
}
