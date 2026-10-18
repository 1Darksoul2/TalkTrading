package com.talktrading.community.controller;

import com.talktrading.community.dto.LikeResponse;
import com.talktrading.community.dto.PageResponse;
import com.talktrading.community.dto.UserProfileResponse;
import com.talktrading.community.security.UserContext;
import com.talktrading.community.service.LikeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

@RestController
@RequestMapping("/api/v1/posts/{postId}")
@RequiredArgsConstructor
@Tag(name = "Likes", description = "Endpoints for liking and unliking posts")
public class LikeController {

    private final LikeService likeService;

    @PostMapping("/like")
    @Operation(summary = "Like post", description = "Likes a post for the authenticated user")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Post successfully liked"),
            @ApiResponse(responseCode = "401", description = "Unauthenticated user"),
            @ApiResponse(responseCode = "404", description = "Post not found")
    })
    public ResponseEntity<LikeResponse> likePost(@PathVariable("postId") Long postId) {
        Long authenticatedUserId = UserContext.getUserId();
        LikeResponse response = likeService.likePost(authenticatedUserId, postId);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/like")
    @Operation(summary = "Unlike post", description = "Unlikes a post for the authenticated user")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Post successfully unliked"),
            @ApiResponse(responseCode = "401", description = "Unauthenticated user"),
            @ApiResponse(responseCode = "404", description = "Post not found")
    })
    public ResponseEntity<LikeResponse> unlikePost(@PathVariable("postId") Long postId) {
        Long authenticatedUserId = UserContext.getUserId();
        LikeResponse response = likeService.unlikePost(authenticatedUserId, postId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/likes")
    @Operation(summary = "Get post likes", description = "Retrieves a paginated list of user profiles who liked the post")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Likers list successfully retrieved"),
            @ApiResponse(responseCode = "404", description = "Post not found")
    })
    public ResponseEntity<PageResponse<UserProfileResponse>> getLikesForPost(
            @PathVariable("postId") Long postId,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        PageResponse<UserProfileResponse> response = likeService.getLikesForPost(postId, pageable);
        return ResponseEntity.ok(response);
    }
}
