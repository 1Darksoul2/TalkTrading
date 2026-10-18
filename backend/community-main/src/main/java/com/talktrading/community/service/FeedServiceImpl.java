package com.talktrading.community.service;

import com.talktrading.community.dto.PageResponse;
import com.talktrading.community.dto.PostMediaResponse;
import com.talktrading.community.dto.PostResponse;
import com.talktrading.community.entity.CommunityMember;
import com.talktrading.community.entity.Follow;
import com.talktrading.community.entity.Post;
import com.talktrading.community.entity.Vote;
import com.talktrading.community.enums.FeedSort;
import com.talktrading.community.enums.VoteType;
import com.talktrading.community.exception.ResourceNotFoundException;
import com.talktrading.community.exception.UnauthorizedException;
import com.talktrading.community.mapper.PostMapper;
import com.talktrading.community.mapper.PostMediaMapper;
import com.talktrading.community.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FeedServiceImpl implements FeedService {

    private final PostRepository postRepository;
    private final FollowRepository followRepository;
    private final CommunityMemberRepository communityMemberRepository;
    private final CommunityRepository communityRepository;
    private final UserProfileRepository userProfileRepository;
    private final PostMediaRepository postMediaRepository;
    private final LikeRepository likeRepository;
    private final VoteRepository voteRepository;
    private final PostMapper postMapper;
    private final PostMediaMapper postMediaMapper;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<PostResponse> getFeed(Long currentUserId, FeedSort sort, Pageable pageable) {
        FeedSort feedSort = sort != null ? sort : FeedSort.NEW;
        Page<Post> postPage = fetchPostsBySort(feedSort, pageable, null, null);
        Page<PostResponse> responsePage = postPage.map(post -> buildPostResponse(post, currentUserId));
        return PageResponse.fromPage(responsePage);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<PostResponse> getFollowingFeed(Long authenticatedUserId, FeedSort sort, Pageable pageable) {
        if (authenticatedUserId == null) {
            throw new UnauthorizedException("User ID is required to fetch personalized following feed");
        }

        // Get followed user IDs
        List<Long> followedUserIds = followRepository.findByFollowerId(authenticatedUserId).stream()
                .map(Follow::getFollowingId)
                .collect(Collectors.toList());

        // Get joined community IDs
        List<Long> joinedCommunityIds = communityMemberRepository.findByUserId(authenticatedUserId).stream()
                .map(CommunityMember::getCommunityId)
                .collect(Collectors.toList());

        if (followedUserIds.isEmpty() && joinedCommunityIds.isEmpty()) {
            return PageResponse.fromPage(new PageImpl<>(Collections.emptyList(), pageable, 0));
        }

        FeedSort feedSort = sort != null ? sort : FeedSort.NEW;
        Page<Post> postPage = fetchPostsBySort(feedSort, pageable, followedUserIds, joinedCommunityIds);
        Page<PostResponse> responsePage = postPage.map(post -> buildPostResponse(post, authenticatedUserId));
        return PageResponse.fromPage(responsePage);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<PostResponse> getCommunityPosts(Long communityId, Pageable pageable) {
        if (!communityRepository.existsById(communityId)) {
            throw new ResourceNotFoundException("Community not found with ID: " + communityId);
        }

        Pageable sortedPageable = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by("createdAt").descending());
        Page<Post> postPage = postRepository.findByCommunityId(communityId, sortedPageable);
        Page<PostResponse> responsePage = postPage.map(post -> buildPostResponse(post, null));
        return PageResponse.fromPage(responsePage);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<PostResponse> getUserPosts(Long userId, Pageable pageable) {
        if (!userProfileRepository.existsByUserId(userId)) {
            throw new ResourceNotFoundException("User not found with ID: " + userId);
        }

        Pageable sortedPageable = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by("createdAt").descending());
        Page<Post> postPage = postRepository.findByUserId(userId, sortedPageable);
        Page<PostResponse> responsePage = postPage.map(post -> buildPostResponse(post, null));
        return PageResponse.fromPage(responsePage);
    }

    /**
     * Deterministic sorting logic:
     * - NEW: Ordered strictly by createdAt DESC.
     * - TOP: Ordered by Weighted Engagement Score: (likeCount * 2.0) + (commentCount * 3.0) + (score * 1.5).
     * - HOT: Ordered by Time-Decay Score: Weighted Engagement Score / ((hoursOld + 2.0) ^ 1.5).
     */
    private Page<Post> fetchPostsBySort(FeedSort sort, Pageable pageable, List<Long> userIds, List<Long> communityIds) {
        boolean isFilter = (userIds != null && !userIds.isEmpty()) || (communityIds != null && !communityIds.isEmpty());
        List<Long> uIds = userIds != null ? userIds : Collections.emptyList();
        List<Long> cIds = communityIds != null ? communityIds : Collections.emptyList();

        if (sort == FeedSort.NEW) {
            Pageable newPageable = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by("createdAt").descending());
            if (isFilter) {
                return postRepository.findByUserIdInOrCommunityIdIn(uIds, cIds, newPageable);
            } else {
                return postRepository.findAll(newPageable);
            }
        } else if (sort == FeedSort.TOP) {
            if (isFilter) {
                Pageable newPageable = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by("createdAt").descending());
                List<Post> candidates = postRepository.findByUserIdInOrCommunityIdIn(uIds, cIds, newPageable).getContent();
                List<Post> sorted = candidates.stream()
                        .sorted(Comparator.comparingDouble(this::calculateTopScore).reversed())
                        .collect(Collectors.toList());
                return paginateList(sorted, pageable);
            } else {
                return postRepository.findTopPosts(pageable);
            }
        } else { // HOT
            List<Post> candidates;
            if (isFilter) {
                Pageable fetchPageable = PageRequest.of(0, 200, Sort.by("createdAt").descending());
                candidates = postRepository.findByUserIdInOrCommunityIdIn(uIds, cIds, fetchPageable).getContent();
            } else {
                Pageable fetchPageable = PageRequest.of(0, 200, Sort.by("createdAt").descending());
                candidates = postRepository.findAll(fetchPageable).getContent();
            }

            LocalDateTime now = LocalDateTime.now();
            List<Post> hotSorted = candidates.stream()
                    .sorted(Comparator.comparingDouble((Post p) -> calculateHotScore(p, now)).reversed())
                    .collect(Collectors.toList());

            return paginateList(hotSorted, pageable);
        }
    }

    private double calculateTopScore(Post post) {
        long likes = post.getLikeCount() != null ? post.getLikeCount() : 0L;
        long comments = post.getCommentCount() != null ? post.getCommentCount() : 0L;
        long voteScore = post.getScore() != null ? post.getScore() : 0L;
        return (likes * 2.0) + (comments * 3.0) + (voteScore * 1.5);
    }

    private double calculateHotScore(Post post, LocalDateTime now) {
        double weightedEngagement = calculateTopScore(post);
        long minutesOld = post.getCreatedAt() != null ? ChronoUnit.MINUTES.between(post.getCreatedAt(), now) : 0L;
        double hoursOld = Math.max(0, minutesOld / 60.0);
        return weightedEngagement / Math.pow(hoursOld + 2.0, 1.5);
    }

    private Page<Post> paginateList(List<Post> list, Pageable pageable) {
        int start = (int) pageable.getOffset();
        if (start >= list.size()) {
            return new PageImpl<>(Collections.emptyList(), pageable, list.size());
        }
        int end = Math.min(start + pageable.getPageSize(), list.size());
        return new PageImpl<>(list.subList(start, end), pageable, list.size());
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
