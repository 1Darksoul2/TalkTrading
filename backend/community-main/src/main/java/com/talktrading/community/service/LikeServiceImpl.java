package com.talktrading.community.service;

import com.talktrading.community.dto.LikeResponse;
import com.talktrading.community.dto.PageResponse;
import com.talktrading.community.dto.UserProfileResponse;
import com.talktrading.community.entity.Like;
import com.talktrading.community.entity.Post;
import com.talktrading.community.exception.ResourceNotFoundException;
import com.talktrading.community.exception.UnauthorizedException;
import com.talktrading.community.mapper.UserProfileMapper;
import com.talktrading.community.repository.LikeRepository;
import com.talktrading.community.repository.PostRepository;
import com.talktrading.community.repository.UserProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class LikeServiceImpl implements LikeService {

    private final LikeRepository likeRepository;
    private final PostRepository postRepository;
    private final UserProfileRepository userProfileRepository;
    private final UserProfileMapper userProfileMapper;

    @Override
    @Transactional
    public LikeResponse likePost(Long authenticatedUserId, Long postId) {
        if (authenticatedUserId == null) {
            throw new UnauthorizedException("User ID is required to like a post");
        }

        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Post not found with ID: " + postId));

        if (likeRepository.existsByUserIdAndPostId(authenticatedUserId, postId)) {
            // Already liked: idempotent return
            long count = likeRepository.countByPostId(postId);
            return LikeResponse.builder().postId(postId).likeCount(count).hasLiked(true).build();
        }

        Like like = Like.builder().userId(authenticatedUserId).postId(postId).build();

        try {
            likeRepository.saveAndFlush(like);
            postRepository.incrementLikeCount(postId);
        } catch (DataIntegrityViolationException e) {
            // Handle concurrent duplicate request safely
        }

        long count = likeRepository.countByPostId(postId);
        return LikeResponse.builder().postId(postId).likeCount(count).hasLiked(true).build();
    }

    @Override
    @Transactional
    public LikeResponse unlikePost(Long authenticatedUserId, Long postId) {
        if (authenticatedUserId == null) {
            throw new UnauthorizedException("User ID is required to unlike a post");
        }

        if (!postRepository.existsById(postId)) {
            throw new ResourceNotFoundException("Post not found with ID: " + postId);
        }

        Optional<Like> existingLike = likeRepository.findByUserIdAndPostId(authenticatedUserId, postId);
        if (existingLike.isPresent()) {
            likeRepository.delete(existingLike.get());
            postRepository.decrementLikeCount(postId);
        }

        long count = likeRepository.countByPostId(postId);
        return LikeResponse.builder().postId(postId).likeCount(count).hasLiked(false).build();
    }

    @Override
    @Transactional(readOnly = true)
    public LikeResponse getLikeStatus(Long currentUserId, Long postId) {
        if (!postRepository.existsById(postId)) {
            throw new ResourceNotFoundException("Post not found with ID: " + postId);
        }

        long count = likeRepository.countByPostId(postId);
        boolean hasLiked = currentUserId != null && likeRepository.existsByUserIdAndPostId(currentUserId, postId);
        return LikeResponse.builder().postId(postId).likeCount(count).hasLiked(hasLiked).build();
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<UserProfileResponse> getLikesForPost(Long postId, Pageable pageable) {
        if (!postRepository.existsById(postId)) {
            throw new ResourceNotFoundException("Post not found with ID: " + postId);
        }

        Page<Like> likePage = likeRepository.findByPostId(postId, pageable);
        Page<UserProfileResponse> profilePage = likePage.map(like -> {
            return userProfileRepository.findByUserId(like.getUserId())
                    .map(userProfileMapper::toResponse)
                    .orElse(null);
        });

        return PageResponse.fromPage(profilePage);
    }
}
