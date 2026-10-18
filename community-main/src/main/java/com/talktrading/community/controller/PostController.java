package com.talktrading.community.controller;

import com.talktrading.community.dto.CreatePostRequest;
import com.talktrading.community.dto.PageResponse;
import com.talktrading.community.dto.PostResponse;
import com.talktrading.community.dto.UpdatePostRequest;
import com.talktrading.community.enums.PostType;
import com.talktrading.community.security.UserContext;
import com.talktrading.community.service.PostService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

@RestController
@RequestMapping("/api/v1/posts")
@RequiredArgsConstructor
@Tag(name = "Posts", description = "Endpoints for managing posts and trade ideas (CHART, MARKET_ANALYSIS, TRADE_IDEA, MARKET_OPINION, EDUCATIONAL, SCREENSHOT, VIDEO)")
public class PostController {

    private final PostService postService;

    @PostMapping
    @Operation(summary = "Create post", description = "Creates a new post or trade idea for the authenticated user. For TRADE_IDEA, enforces price validations (BUY: stopLoss < entryPrice < targetPrice; SELL: targetPrice < entryPrice < stopLoss).")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Post successfully created"),
            @ApiResponse(responseCode = "400", description = "Invalid request payload or trade price validation failure"),
            @ApiResponse(responseCode = "401", description = "Unauthenticated user"),
            @ApiResponse(responseCode = "404", description = "Community not found (if communityId provided)")
    })
    public ResponseEntity<PostResponse> createPost(@Valid @RequestBody CreatePostRequest request) {
        Long authenticatedUserId = UserContext.getUserId();
        PostResponse response = postService.createPost(authenticatedUserId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get post by ID", description = "Retrieves post details by post ID")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Post details successfully retrieved"),
            @ApiResponse(responseCode = "404", description = "Post not found")
    })
    public ResponseEntity<PostResponse> getPostById(@PathVariable("id") Long id) {
        PostResponse response = postService.getPostById(id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update post", description = "Updates an existing post owned by the authenticated user")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Post successfully updated"),
            @ApiResponse(responseCode = "400", description = "Invalid request payload or trade price validation failure"),
            @ApiResponse(responseCode = "401", description = "Unauthorized: user does not own this post"),
            @ApiResponse(responseCode = "404", description = "Post not found")
    })
    public ResponseEntity<PostResponse> updatePost(@PathVariable("id") Long id,
                                                   @Valid @RequestBody UpdatePostRequest request) {
        Long authenticatedUserId = UserContext.getUserId();
        PostResponse response = postService.updatePost(authenticatedUserId, id, request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete post", description = "Deletes an existing post owned by the authenticated user")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Post successfully deleted"),
            @ApiResponse(responseCode = "401", description = "Unauthorized: user does not own this post"),
            @ApiResponse(responseCode = "404", description = "Post not found")
    })
    public ResponseEntity<Void> deletePost(@PathVariable("id") Long id) {
        Long authenticatedUserId = UserContext.getUserId();
        postService.deletePost(authenticatedUserId, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    @Operation(summary = "Get posts", description = "Retrieves a paginated list of posts with optional filtering by user ID or post type")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Posts list successfully retrieved")
    })
    public ResponseEntity<PageResponse<PostResponse>> getPosts(
            @RequestParam(value = "userId", required = false) Long userId,
            @RequestParam(value = "postType", required = false) PostType postType,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        PageResponse<PostResponse> response = postService.getPosts(userId, postType, pageable);
        return ResponseEntity.ok(response);
    }
}
