package com.talktrading.community.service;

import com.talktrading.community.dto.CreatePostRequest;
import com.talktrading.community.dto.PageResponse;
import com.talktrading.community.dto.PostResponse;
import com.talktrading.community.dto.UpdatePostRequest;
import com.talktrading.community.enums.PostType;
import org.springframework.data.domain.Pageable;

public interface PostService {

    PostResponse createPost(Long authenticatedUserId, CreatePostRequest request);

    PostResponse getPostById(Long id);

    PostResponse updatePost(Long authenticatedUserId, Long id, UpdatePostRequest request);

    void deletePost(Long authenticatedUserId, Long id);

    PageResponse<PostResponse> getPosts(Long userId, PostType postType, Pageable pageable);
}
