package com.talktrading.community.controller;

import com.talktrading.community.dto.CommentResponse;
import com.talktrading.community.dto.CreateCommentRequest;
import com.talktrading.community.dto.PageResponse;
import com.talktrading.community.dto.UpdateCommentRequest;
import com.talktrading.community.security.UserContext;
import com.talktrading.community.service.CommentService;
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

import java.util.List;

import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Comments", description = "Endpoints for managing post comments and threaded replies")
public class CommentController {

    private final CommentService commentService;

    @PostMapping("/posts/{postId}/comments")
    @Operation(summary = "Create comment or reply", description = "Creates a root comment or reply to an existing comment on a post")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Comment/reply successfully created"),
            @ApiResponse(responseCode = "400", description = "Invalid payload or parent comment belongs to a different post"),
            @ApiResponse(responseCode = "401", description = "Unauthenticated user"),
            @ApiResponse(responseCode = "404", description = "Post or parent comment not found")
    })
    public ResponseEntity<CommentResponse> createComment(
            @PathVariable("postId") Long postId,
            @Valid @RequestBody CreateCommentRequest request) {
        Long authenticatedUserId = UserContext.getUserId();
        CommentResponse response = commentService.createComment(authenticatedUserId, postId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/posts/{postId}/comments")
    @Operation(summary = "Get post comments", description = "Retrieves paginated root comments with nested reply trees")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Comments list successfully retrieved"),
            @ApiResponse(responseCode = "404", description = "Post not found")
    })
    public ResponseEntity<PageResponse<CommentResponse>> getCommentsForPost(
            @PathVariable("postId") Long postId,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").ascending());
        PageResponse<CommentResponse> response = commentService.getCommentsForPost(postId, pageable);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/comments/{commentId}/replies")
    @Operation(summary = "Get comment replies", description = "Retrieves direct replies for a comment")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Replies list successfully retrieved"),
            @ApiResponse(responseCode = "404", description = "Comment not found")
    })
    public ResponseEntity<List<CommentResponse>> getRepliesForComment(@PathVariable("commentId") Long commentId) {
        List<CommentResponse> response = commentService.getRepliesForComment(commentId);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/comments/{commentId}")
    @Operation(summary = "Update comment", description = "Updates a comment (requires author authorization)")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Comment successfully updated"),
            @ApiResponse(responseCode = "400", description = "Invalid payload"),
            @ApiResponse(responseCode = "401", description = "Unauthorized: user does not own this comment"),
            @ApiResponse(responseCode = "404", description = "Comment not found")
    })
    public ResponseEntity<CommentResponse> updateComment(
            @PathVariable("commentId") Long commentId,
            @Valid @RequestBody UpdateCommentRequest request) {
        Long authenticatedUserId = UserContext.getUserId();
        CommentResponse response = commentService.updateComment(authenticatedUserId, commentId, request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/comments/{commentId}")
    @Operation(summary = "Delete comment", description = "Deletes a comment or marks content as [deleted] if child replies exist")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Comment successfully deleted or soft deleted"),
            @ApiResponse(responseCode = "401", description = "Unauthorized: user does not own this comment"),
            @ApiResponse(responseCode = "404", description = "Comment not found")
    })
    public ResponseEntity<Void> deleteComment(@PathVariable("commentId") Long commentId) {
        Long authenticatedUserId = UserContext.getUserId();
        commentService.deleteComment(authenticatedUserId, commentId);
        return ResponseEntity.noContent().build();
    }
}
