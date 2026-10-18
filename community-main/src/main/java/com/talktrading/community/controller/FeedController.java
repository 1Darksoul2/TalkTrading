package com.talktrading.community.controller;

import com.talktrading.community.dto.PageResponse;
import com.talktrading.community.dto.PostResponse;
import com.talktrading.community.enums.FeedSort;
import com.talktrading.community.security.UserContext;
import com.talktrading.community.service.FeedService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Feed Engine", description = "Endpoints for retrieving main feed, personalized following feed, community posts, and user posts")
public class FeedController {

    private static final int MAX_PAGE_SIZE = 50;

    private final FeedService feedService;

    @GetMapping("/feed")
    @Operation(summary = "Get main feed", description = "Retrieves global feed posts sorted by NEW, TOP, or HOT with pagination")
    public ResponseEntity<PageResponse<PostResponse>> getFeed(
            @RequestParam(value = "sort", defaultValue = "NEW") FeedSort sort,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        Long currentUserId = UserContext.getUserId();
        int cappedSize = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(Math.max(0, page), cappedSize);
        PageResponse<PostResponse> response = feedService.getFeed(currentUserId, sort, pageable);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/feed/following")
    @Operation(summary = "Get personalized following feed", description = "Retrieves feed posts from followed users and joined communities")
    public ResponseEntity<PageResponse<PostResponse>> getFollowingFeed(
            @RequestParam(value = "sort", defaultValue = "NEW") FeedSort sort,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        Long authenticatedUserId = UserContext.getUserId();
        int cappedSize = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(Math.max(0, page), cappedSize);
        PageResponse<PostResponse> response = feedService.getFollowingFeed(authenticatedUserId, sort, pageable);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/communities/{communityId}/posts")
    @Operation(summary = "Get community posts", description = "Retrieves a paginated list of posts for a specified community")
    public ResponseEntity<PageResponse<PostResponse>> getCommunityPosts(
            @PathVariable("communityId") Long communityId,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        int cappedSize = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(Math.max(0, page), cappedSize);
        PageResponse<PostResponse> response = feedService.getCommunityPosts(communityId, pageable);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/users/{userId}/posts")
    @Operation(summary = "Get user posts", description = "Retrieves a paginated list of posts authored by a specified user")
    public ResponseEntity<PageResponse<PostResponse>> getUserPosts(
            @PathVariable("userId") Long userId,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        int cappedSize = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(Math.max(0, page), cappedSize);
        PageResponse<PostResponse> response = feedService.getUserPosts(userId, pageable);
        return ResponseEntity.ok(response);
    }
}
