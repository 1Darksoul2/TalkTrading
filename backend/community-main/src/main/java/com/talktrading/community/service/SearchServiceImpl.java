package com.talktrading.community.service;

import com.talktrading.community.dto.*;
import com.talktrading.community.entity.Community;
import com.talktrading.community.entity.CommunityMember;
import com.talktrading.community.entity.Post;
import com.talktrading.community.entity.UserProfile;
import com.talktrading.community.entity.Vote;
import com.talktrading.community.enums.CommunityRole;
import com.talktrading.community.enums.VoteType;
import com.talktrading.community.mapper.CommunityMapper;
import com.talktrading.community.mapper.PostMapper;
import com.talktrading.community.mapper.PostMediaMapper;
import com.talktrading.community.mapper.UserProfileMapper;
import com.talktrading.community.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SearchServiceImpl implements SearchService {

    private final UserProfileRepository userProfileRepository;
    private final CommunityRepository communityRepository;
    private final CommunityMemberRepository communityMemberRepository;
    private final PostRepository postRepository;
    private final PostMediaRepository postMediaRepository;
    private final LikeRepository likeRepository;
    private final VoteRepository voteRepository;

    private final UserProfileMapper userProfileMapper;
    private final CommunityMapper communityMapper;
    private final PostMapper postMapper;
    private final PostMediaMapper postMediaMapper;

    @Override
    @Transactional(readOnly = true)
    public GlobalSearchResponse searchGlobal(Long currentUserId, String query, Pageable pageable) {
        if (query == null || query.trim().isEmpty()) {
            return GlobalSearchResponse.builder().build();
        }

        String q = query.trim();

        // 1. Search Users by username or displayName
        Pageable userPageable = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by("username").ascending());
        Page<UserProfile> userPage = userProfileRepository.findByUsernameContainingIgnoreCaseOrDisplayNameContainingIgnoreCase(q, q, userPageable);
        List<UserProfileResponse> userResponses = userPage.getContent().stream()
                .map(userProfileMapper::toResponse)
                .collect(Collectors.toList());

        // 2. Search Communities by name or description
        Pageable communityPageable = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by("memberCount").descending().and(Sort.by("name").ascending()));
        Page<Community> communityPage = communityRepository.findByNameContainingIgnoreCaseOrDescriptionContainingIgnoreCase(q, q, communityPageable);
        List<CommunityResponse> communityResponses = communityPage.getContent().stream()
                .map(community -> {
                    CommunityRole role = null;
                    if (currentUserId != null) {
                        role = communityMemberRepository.findByCommunityIdAndUserId(community.getId(), currentUserId)
                                .map(CommunityMember::getRole)
                                .orElse(null);
                    }
                    return communityMapper.toResponse(community, role);
                })
                .collect(Collectors.toList());

        // 3. Search Posts by title, content, or symbol
        Pageable postPageable = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by("createdAt").descending());
        Page<Post> postPage = postRepository.findByTitleContainingIgnoreCaseOrContentContainingIgnoreCaseOrSymbolContainingIgnoreCase(q, q, q, postPageable);
        List<PostResponse> postResponses = postPage.getContent().stream()
                .map(post -> buildPostResponse(post, currentUserId))
                .collect(Collectors.toList());

        return GlobalSearchResponse.builder()
                .users(userResponses)
                .communities(communityResponses)
                .posts(postResponses)
                .build();
    }

    private PostResponse buildPostResponse(Post post, Long currentUserId) {
        List<PostMediaResponse> media = postMediaRepository.findByPostId(post.getId()).stream()
                .map(postMediaMapper::toResponse)
                .collect(Collectors.toList());

        Boolean hasLiked = currentUserId != null
                ? likeRepository.existsByUserIdAndPostId(currentUserId, post.getId())
                : null;

        VoteType currentUserVote = currentUserId != null
                ? voteRepository.findByUserIdAndPostId(currentUserId, post.getId()).map(Vote::getVoteType).orElse(null)
                : null;

        return postMapper.toResponse(post, media, hasLiked, currentUserVote);
    }
}
