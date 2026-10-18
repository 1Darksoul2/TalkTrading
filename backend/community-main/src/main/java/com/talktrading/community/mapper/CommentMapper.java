package com.talktrading.community.mapper;

import com.talktrading.community.dto.CommentResponse;
import com.talktrading.community.entity.Comment;
import com.talktrading.community.entity.UserProfile;
import org.springframework.stereotype.Component;

import java.util.ArrayList;

@Component
public class CommentMapper {

    public CommentResponse toResponse(Comment comment) {
        return toResponse(comment, null);
    }

    public CommentResponse toResponse(Comment comment, UserProfile userProfile) {
        if (comment == null) {
            return null;
        }

        return CommentResponse.builder()
                .id(comment.getId())
                .postId(comment.getPostId())
                .userId(comment.getUserId())
                .username(userProfile != null ? userProfile.getUsername() : null)
                .displayName(userProfile != null ? userProfile.getDisplayName() : null)
                .profileImage(userProfile != null ? userProfile.getProfileImage() : null)
                .parentCommentId(comment.getParentCommentId())
                .content(comment.getContent())
                .createdAt(comment.getCreatedAt())
                .updatedAt(comment.getUpdatedAt())
                .replies(new ArrayList<>())
                .build();
    }
}
