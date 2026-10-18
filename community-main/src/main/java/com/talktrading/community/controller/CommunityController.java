package com.talktrading.community.controller;

import com.talktrading.community.dto.*;
import com.talktrading.community.security.UserContext;
import com.talktrading.community.service.CommunityService;
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
@RequestMapping("/api/v1/communities")
@RequiredArgsConstructor
@Tag(name = "Communities", description = "Endpoints for managing communities, memberships, and community posts")
public class CommunityController {

    private final CommunityService communityService;

    @PostMapping
    @Operation(summary = "Create community", description = "Creates a new community and sets creator as OWNER")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Community successfully created"),
            @ApiResponse(responseCode = "400", description = "Invalid community payload"),
            @ApiResponse(responseCode = "401", description = "Unauthenticated user"),
            @ApiResponse(responseCode = "409", description = "Community name already exists")
    })
    public ResponseEntity<CommunityResponse> createCommunity(@Valid @RequestBody CreateCommunityRequest request) {
        Long authenticatedUserId = UserContext.getUserId();
        CommunityResponse response = communityService.createCommunity(authenticatedUserId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    @Operation(summary = "Get communities", description = "Retrieves a paginated list of communities with optional search query")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Communities list successfully retrieved")
    })
    public ResponseEntity<PageResponse<CommunityResponse>> getCommunities(
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        Long currentUserId = UserContext.getUserId();
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        PageResponse<CommunityResponse> response = communityService.getCommunities(currentUserId, search, pageable);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get community by ID", description = "Retrieves community details by ID")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Community details successfully retrieved"),
            @ApiResponse(responseCode = "404", description = "Community not found")
    })
    public ResponseEntity<CommunityResponse> getCommunityById(@PathVariable("id") Long communityId) {
        Long currentUserId = UserContext.getUserId();
        CommunityResponse response = communityService.getCommunityById(currentUserId, communityId);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update community", description = "Updates community details (requires OWNER or MODERATOR role)")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Community successfully updated"),
            @ApiResponse(responseCode = "400", description = "Invalid request payload"),
            @ApiResponse(responseCode = "401", description = "Unauthorized: insufficient community privileges"),
            @ApiResponse(responseCode = "404", description = "Community not found"),
            @ApiResponse(responseCode = "409", description = "Community name conflict")
    })
    public ResponseEntity<CommunityResponse> updateCommunity(
            @PathVariable("id") Long communityId,
            @Valid @RequestBody UpdateCommunityRequest request) {
        Long authenticatedUserId = UserContext.getUserId();
        CommunityResponse response = communityService.updateCommunity(authenticatedUserId, communityId, request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete community", description = "Deletes a community (requires OWNER role)")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Community successfully deleted"),
            @ApiResponse(responseCode = "401", description = "Unauthorized: only OWNER can delete community"),
            @ApiResponse(responseCode = "404", description = "Community not found")
    })
    public ResponseEntity<Void> deleteCommunity(@PathVariable("id") Long communityId) {
        Long authenticatedUserId = UserContext.getUserId();
        communityService.deleteCommunity(authenticatedUserId, communityId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/join")
    @Operation(summary = "Join community", description = "Joins the specified community as a MEMBER")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Successfully joined community"),
            @ApiResponse(responseCode = "401", description = "Unauthenticated user"),
            @ApiResponse(responseCode = "404", description = "Community not found"),
            @ApiResponse(responseCode = "409", description = "Already a member of this community")
    })
    public ResponseEntity<CommunityMemberResponse> joinCommunity(@PathVariable("id") Long communityId) {
        Long authenticatedUserId = UserContext.getUserId();
        CommunityMemberResponse response = communityService.joinCommunity(authenticatedUserId, communityId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @DeleteMapping("/{id}/join")
    @Operation(summary = "Leave community", description = "Leaves the specified community")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Successfully left community"),
            @ApiResponse(responseCode = "401", description = "Unauthenticated user"),
            @ApiResponse(responseCode = "404", description = "Community or membership not found")
    })
    public ResponseEntity<Void> leaveCommunity(@PathVariable("id") Long communityId) {
        Long authenticatedUserId = UserContext.getUserId();
        communityService.leaveCommunity(authenticatedUserId, communityId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/members/{userId}")
    @Operation(summary = "Remove community member", description = "Removes a member from the community (requires MODERATOR or OWNER role)")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Member successfully removed"),
            @ApiResponse(responseCode = "401", description = "Unauthorized: insufficient moderation privileges"),
            @ApiResponse(responseCode = "404", description = "Community or member not found")
    })
    public ResponseEntity<Void> removeMember(
            @PathVariable("id") Long communityId,
            @PathVariable("userId") Long targetUserId) {
        Long authenticatedUserId = UserContext.getUserId();
        communityService.removeMember(authenticatedUserId, communityId, targetUserId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/members/{userId}/role")
    @Operation(summary = "Update member role", description = "Updates a member's role (requires OWNER role)")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Member role successfully updated"),
            @ApiResponse(responseCode = "400", description = "Invalid role payload"),
            @ApiResponse(responseCode = "401", description = "Unauthorized: only OWNER can update roles"),
            @ApiResponse(responseCode = "404", description = "Community or member not found")
    })
    public ResponseEntity<CommunityMemberResponse> updateMemberRole(
            @PathVariable("id") Long communityId,
            @PathVariable("userId") Long targetUserId,
            @Valid @RequestBody UpdateMemberRoleRequest request) {
        Long authenticatedUserId = UserContext.getUserId();
        CommunityMemberResponse response = communityService.updateMemberRole(authenticatedUserId, communityId, targetUserId, request.getRole());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}/members")
    @Operation(summary = "Get community members", description = "Retrieves a paginated list of members for a community")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Community members list successfully retrieved"),
            @ApiResponse(responseCode = "404", description = "Community not found")
    })
    public ResponseEntity<PageResponse<CommunityMemberResponse>> getCommunityMembers(
            @PathVariable("id") Long communityId,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("joinedAt").ascending());
        PageResponse<CommunityMemberResponse> response = communityService.getCommunityMembers(communityId, pageable);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/posts")
    @Operation(summary = "Create community post", description = "Creates a post in a community (requires active community membership)")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Community post successfully created"),
            @ApiResponse(responseCode = "400", description = "Invalid post payload or trade price validation failure"),
            @ApiResponse(responseCode = "401", description = "Unauthorized: user is not a member of this community"),
            @ApiResponse(responseCode = "404", description = "Community not found")
    })
    public ResponseEntity<PostResponse> createCommunityPost(
            @PathVariable("id") Long communityId,
            @Valid @RequestBody CreatePostRequest request) {
        Long authenticatedUserId = UserContext.getUserId();
        PostResponse response = communityService.createCommunityPost(authenticatedUserId, communityId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
