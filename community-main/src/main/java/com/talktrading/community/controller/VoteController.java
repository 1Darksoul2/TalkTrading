package com.talktrading.community.controller;

import com.talktrading.community.dto.VoteRequest;
import com.talktrading.community.dto.VoteResponse;
import com.talktrading.community.security.UserContext;
import com.talktrading.community.service.VoteService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/posts/{postId}")
@RequiredArgsConstructor
@Tag(name = "Voting", description = "Endpoints for upvoting, downvoting, and removing votes on posts")
public class VoteController {

    private final VoteService voteService;

    @PostMapping("/vote")
    @Operation(summary = "Vote on post", description = "Cast an UPVOTE or DOWNVOTE on a post")
    public ResponseEntity<VoteResponse> votePost(
            @PathVariable("postId") Long postId,
            @Valid @RequestBody VoteRequest request) {
        Long authenticatedUserId = UserContext.getUserId();
        VoteResponse response = voteService.votePost(authenticatedUserId, postId, request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/vote")
    @Operation(summary = "Remove vote", description = "Removes any active vote on a post for the authenticated user")
    public ResponseEntity<VoteResponse> removeVote(@PathVariable("postId") Long postId) {
        Long authenticatedUserId = UserContext.getUserId();
        VoteResponse response = voteService.removeVote(authenticatedUserId, postId);
        return ResponseEntity.ok(response);
    }
}
