package com.talktrading.community.service;

import com.talktrading.community.dto.CommentResponse;
import com.talktrading.community.dto.CreateCommentRequest;
import com.talktrading.community.dto.PageResponse;
import com.talktrading.community.dto.UpdateCommentRequest;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface CommentService {

    CommentResponse createComment(Long authenticatedUserId, Long postId, CreateCommentRequest request);

    PageResponse<CommentResponse> getCommentsForPost(Long postId, Pageable pageable);

    List<CommentResponse> getRepliesForComment(Long commentId);

    CommentResponse updateComment(Long authenticatedUserId, Long commentId, UpdateCommentRequest request);

    void deleteComment(Long authenticatedUserId, Long commentId);
}
