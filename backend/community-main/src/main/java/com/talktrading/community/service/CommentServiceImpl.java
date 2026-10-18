package com.talktrading.community.service;

import com.talktrading.community.dto.CommentResponse;
import com.talktrading.community.dto.CreateCommentRequest;
import com.talktrading.community.dto.PageResponse;
import com.talktrading.community.dto.UpdateCommentRequest;
import com.talktrading.community.entity.Comment;
import com.talktrading.community.entity.UserProfile;
import com.talktrading.community.exception.BadRequestException;
import com.talktrading.community.exception.ResourceNotFoundException;
import com.talktrading.community.exception.UnauthorizedException;
import com.talktrading.community.mapper.CommentMapper;
import com.talktrading.community.repository.CommentRepository;
import com.talktrading.community.repository.PostRepository;
import com.talktrading.community.repository.UserProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CommentServiceImpl implements CommentService {

    private final CommentRepository commentRepository;
    private final PostRepository postRepository;
    private final UserProfileRepository userProfileRepository;
    private final CommentMapper commentMapper;

    @Override
    @Transactional
    public CommentResponse createComment(Long authenticatedUserId, Long postId, CreateCommentRequest request) {
        if (authenticatedUserId == null) {
            throw new UnauthorizedException("User ID is required to create a comment");
        }

        if (!postRepository.existsById(postId)) {
            throw new ResourceNotFoundException("Post not found with ID: " + postId);
        }

        if (request.getParentCommentId() != null) {
            Comment parentComment = commentRepository.findById(request.getParentCommentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Parent comment not found with ID: " + request.getParentCommentId()));

            if (!parentComment.getPostId().equals(postId)) {
                throw new BadRequestException("Parent comment belongs to a different post");
            }
        }

        Comment comment = Comment.builder()
                .postId(postId)
                .userId(authenticatedUserId)
                .parentCommentId(request.getParentCommentId())
                .content(request.getContent())
                .build();

        Comment savedComment = commentRepository.save(comment);
        postRepository.incrementCommentCount(postId);

        UserProfile userProfile = userProfileRepository.findByUserId(authenticatedUserId).orElse(null);
        return commentMapper.toResponse(savedComment, userProfile);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<CommentResponse> getCommentsForPost(Long postId, Pageable pageable) {
        if (!postRepository.existsById(postId)) {
            throw new ResourceNotFoundException("Post not found with ID: " + postId);
        }

        // 1. Paginate root comments
        Page<Comment> rootPage = commentRepository.findByPostIdAndParentCommentIdIsNull(postId, pageable);

        // 2. Fetch all comments for post efficiently to build tree without N+1 queries
        List<Comment> allComments = commentRepository.findByPostIdOrderByCreatedAtAsc(postId);

        // Pre-fetch user profiles for commenters
        Set<Long> userIds = allComments.stream().map(Comment::getUserId).collect(Collectors.toSet());
        Map<Long, UserProfile> userProfileMap = userProfileRepository.findAll().stream()
                .filter(profile -> userIds.contains(profile.getUserId()))
                .collect(Collectors.toMap(UserProfile::getUserId, p -> p, (p1, p2) -> p1));

        // Group child comments by parent comment ID
        Map<Long, List<Comment>> childrenMap = new HashMap<>();
        for (Comment c : allComments) {
            if (c.getParentCommentId() != null) {
                childrenMap.computeIfAbsent(c.getParentCommentId(), k -> new ArrayList<>()).add(c);
            }
        }

        // 3. Build tree recursively for root comments in page
        Page<CommentResponse> responsePage = rootPage.map(root -> buildTree(root, childrenMap, userProfileMap));
        return PageResponse.fromPage(responsePage);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CommentResponse> getRepliesForComment(Long commentId) {
        Comment parent = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found with ID: " + commentId));

        List<Comment> replies = commentRepository.findByPostIdAndParentCommentId(parent.getPostId(), commentId);
        return replies.stream().map(reply -> {
            UserProfile profile = userProfileRepository.findByUserId(reply.getUserId()).orElse(null);
            return commentMapper.toResponse(reply, profile);
        }).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public CommentResponse updateComment(Long authenticatedUserId, Long commentId, UpdateCommentRequest request) {
        if (authenticatedUserId == null) {
            throw new UnauthorizedException("User ID is required to update a comment");
        }

        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found with ID: " + commentId));

        if (!comment.getUserId().equals(authenticatedUserId)) {
            throw new UnauthorizedException("You are not authorized to update this comment");
        }

        comment.setContent(request.getContent());
        Comment updated = commentRepository.save(comment);

        UserProfile profile = userProfileRepository.findByUserId(authenticatedUserId).orElse(null);
        return commentMapper.toResponse(updated, profile);
    }

    @Override
    @Transactional
    public void deleteComment(Long authenticatedUserId, Long commentId) {
        if (authenticatedUserId == null) {
            throw new UnauthorizedException("User ID is required to delete a comment");
        }

        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found with ID: " + commentId));

        if (!comment.getUserId().equals(authenticatedUserId)) {
            throw new UnauthorizedException("You are not authorized to delete this comment");
        }

        // Check if comment has child replies
        if (commentRepository.existsByParentCommentId(commentId)) {
            // Soft delete content to preserve reply tree structure
            comment.setContent("[deleted]");
            commentRepository.save(comment);
        } else {
            commentRepository.delete(comment);
        }

        postRepository.decrementCommentCount(comment.getPostId());
    }

    private CommentResponse buildTree(Comment comment, Map<Long, List<Comment>> childrenMap, Map<Long, UserProfile> userProfileMap) {
        UserProfile profile = userProfileMap.get(comment.getUserId());
        CommentResponse node = commentMapper.toResponse(comment, profile);

        List<Comment> children = childrenMap.getOrDefault(comment.getId(), Collections.emptyList());
        for (Comment child : children) {
            node.getReplies().add(buildTree(child, childrenMap, userProfileMap));
        }

        return node;
    }
}
