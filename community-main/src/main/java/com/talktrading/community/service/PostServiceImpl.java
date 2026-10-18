package com.talktrading.community.service;

import com.talktrading.community.dto.CreatePostRequest;
import com.talktrading.community.dto.PageResponse;
import com.talktrading.community.dto.PostResponse;
import com.talktrading.community.dto.UpdatePostRequest;
import com.talktrading.community.entity.Post;
import com.talktrading.community.enums.PostType;
import com.talktrading.community.exception.ResourceNotFoundException;
import com.talktrading.community.exception.UnauthorizedException;
import com.talktrading.community.mapper.PostMapper;
import com.talktrading.community.repository.PostRepository;
import com.talktrading.community.repository.UserProfileRepository;
import com.talktrading.community.util.TradeValidationUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.talktrading.community.dto.PostMediaResponse;
import com.talktrading.community.entity.PostMedia;
import com.talktrading.community.mapper.PostMediaMapper;
import com.talktrading.community.repository.PostMediaRepository;
import com.talktrading.community.storage.MediaStorageService;
import java.util.List;
import java.util.stream.Collectors;

import com.talktrading.community.entity.Vote;
import com.talktrading.community.enums.VoteType;
import com.talktrading.community.repository.LikeRepository;
import com.talktrading.community.repository.VoteRepository;
import com.talktrading.community.security.UserContext;

@Service
@RequiredArgsConstructor
public class PostServiceImpl implements PostService {

    private final PostRepository postRepository;
    private final UserProfileRepository userProfileRepository;
    private final PostMediaRepository postMediaRepository;
    private final LikeRepository likeRepository;
    private final VoteRepository voteRepository;
    private final MediaStorageService mediaStorageService;
    private final PostMapper postMapper;
    private final PostMediaMapper postMediaMapper;

    @Override
    @Transactional
    public PostResponse createPost(Long authenticatedUserId, CreatePostRequest request) {
        if (authenticatedUserId == null) {
            throw new UnauthorizedException("User ID is required to create a post");
        }

        if (request.getPostType() == PostType.TRADE_IDEA) {
            TradeValidationUtil.validateTradeSetup(
                    request.getTradeDirection(),
                    request.getEntryPrice(),
                    request.getTargetPrice(),
                    request.getStopLoss()
            );
        }

        Post post = Post.builder()
                .userId(authenticatedUserId)
                .communityId(request.getCommunityId())
                .postType(request.getPostType())
                .title(request.getTitle())
                .content(request.getContent())
                .symbol(request.getSymbol())
                .entryPrice(request.getEntryPrice())
                .targetPrice(request.getTargetPrice())
                .stopLoss(request.getStopLoss())
                .timeframe(request.getTimeframe())
                .tradeDirection(request.getTradeDirection())
                .likeCount(0L)
                .commentCount(0L)
                .upvoteCount(0L)
                .downvoteCount(0L)
                .score(0L)
                .build();

        Post savedPost = postRepository.save(post);

        // Increment user's postCount
        userProfileRepository.incrementPostCount(authenticatedUserId);

        return postMapper.toResponse(savedPost);
    }

    @Override
    @Transactional(readOnly = true)
    public PostResponse getPostById(Long id) {
        Post post = postRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Post not found with ID: " + id));
        return buildPostResponseWithEngagement(post);
    }

    @Override
    @Transactional
    public PostResponse updatePost(Long authenticatedUserId, Long id, UpdatePostRequest request) {
        if (authenticatedUserId == null) {
            throw new UnauthorizedException("User ID is required to update a post");
        }

        Post post = postRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Post not found with ID: " + id));

        if (!post.getUserId().equals(authenticatedUserId)) {
            throw new UnauthorizedException("You are not authorized to update this post");
        }

        if (request.getTitle() != null && !request.getTitle().isBlank()) {
            post.setTitle(request.getTitle());
        }
        if (request.getContent() != null) {
            post.setContent(request.getContent());
        }
        if (request.getSymbol() != null) {
            post.setSymbol(request.getSymbol());
        }
        if (request.getEntryPrice() != null) {
            post.setEntryPrice(request.getEntryPrice());
        }
        if (request.getTargetPrice() != null) {
            post.setTargetPrice(request.getTargetPrice());
        }
        if (request.getStopLoss() != null) {
            post.setStopLoss(request.getStopLoss());
        }
        if (request.getTimeframe() != null) {
            post.setTimeframe(request.getTimeframe());
        }
        if (request.getTradeDirection() != null) {
            post.setTradeDirection(request.getTradeDirection());
        }

        if (post.getPostType() == PostType.TRADE_IDEA) {
            TradeValidationUtil.validateTradeSetup(
                    post.getTradeDirection(),
                    post.getEntryPrice(),
                    post.getTargetPrice(),
                    post.getStopLoss()
            );
        }

        Post updatedPost = postRepository.save(post);
        return buildPostResponseWithEngagement(updatedPost);
    }

    @Override
    @Transactional
    public void deletePost(Long authenticatedUserId, Long id) {
        if (authenticatedUserId == null) {
            throw new UnauthorizedException("User ID is required to delete a post");
        }

        Post post = postRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Post not found with ID: " + id));

        if (!post.getUserId().equals(authenticatedUserId)) {
            throw new UnauthorizedException("You are not authorized to delete this post");
        }

        // Clean up attached media files and DB records
        List<PostMedia> postMediaList = postMediaRepository.findByPostId(id);
        for (PostMedia media : postMediaList) {
            mediaStorageService.deleteFile(media.getMediaUrl());
        }
        postMediaRepository.deleteByPostId(id);

        postRepository.delete(post);

        // Decrement user's postCount
        userProfileRepository.decrementPostCount(authenticatedUserId);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<PostResponse> getPosts(Long userId, PostType postType, Pageable pageable) {
        Page<Post> page;
        if (userId != null && postType != null) {
            page = postRepository.findByUserIdAndPostType(userId, postType, pageable);
        } else if (userId != null) {
            page = postRepository.findByUserId(userId, pageable);
        } else if (postType != null) {
            page = postRepository.findByPostType(postType, pageable);
        } else {
            page = postRepository.findAll(pageable);
        }

        Page<PostResponse> responsePage = page.map(this::buildPostResponseWithEngagement);
        return PageResponse.fromPage(responsePage);
    }

    private PostResponse buildPostResponseWithEngagement(Post post) {
        List<PostMediaResponse> media = getMediaForPost(post.getId());
        Long currentUserId = UserContext.getUserId();
        Boolean hasLiked = (currentUserId != null && likeRepository != null)
                ? likeRepository.existsByUserIdAndPostId(currentUserId, post.getId())
                : null;
        VoteType currentUserVote = (currentUserId != null && voteRepository != null)
                ? voteRepository.findByUserIdAndPostId(currentUserId, post.getId()).map(Vote::getVoteType).orElse(null)
                : null;
        return postMapper.toResponse(post, media, hasLiked, currentUserVote);
    }

    private List<PostMediaResponse> getMediaForPost(Long postId) {
        return postMediaRepository.findByPostId(postId).stream()
                .map(postMediaMapper::toResponse)
                .collect(Collectors.toList());
    }
}
