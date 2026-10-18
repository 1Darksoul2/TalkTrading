package com.talktrading.community.controller;

import com.talktrading.community.dto.CreateProfileRequest;
import com.talktrading.community.dto.PageResponse;
import com.talktrading.community.dto.UpdateProfileRequest;
import com.talktrading.community.dto.UserProfileResponse;
import com.talktrading.community.security.UserContext;
import com.talktrading.community.service.UserProfileService;
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
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "User Profiles", description = "Endpoints for managing user profiles, followers, and follow relationships")
public class UserProfileController {

    private final UserProfileService userProfileService;

    @PostMapping
    @Operation(summary = "Create user profile", description = "Creates a new profile for the authenticated user derived from UserContext")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Profile successfully created"),
            @ApiResponse(responseCode = "400", description = "Invalid request payload or validation failure"),
            @ApiResponse(responseCode = "401", description = "Unauthenticated user"),
            @ApiResponse(responseCode = "409", description = "Profile or username already exists")
    })
    public ResponseEntity<UserProfileResponse> createProfile(@Valid @RequestBody CreateProfileRequest request) {
        Long authenticatedUserId = UserContext.getUserId();
        UserProfileResponse response = userProfileService.createProfile(authenticatedUserId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get profile by user ID", description = "Retrieves user profile details by user ID")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Profile successfully retrieved"),
            @ApiResponse(responseCode = "404", description = "User profile not found")
    })
    public ResponseEntity<UserProfileResponse> getProfile(@PathVariable("id") Long userId) {
        Long currentUserId = UserContext.getUserId();
        UserProfileResponse response = userProfileService.getProfileByUserId(userId, currentUserId);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update user profile", description = "Updates profile information for the specified user ID (requires ownership)")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Profile successfully updated"),
            @ApiResponse(responseCode = "400", description = "Invalid update payload"),
            @ApiResponse(responseCode = "401", description = "Unauthorized: cannot modify another user's profile"),
            @ApiResponse(responseCode = "404", description = "User profile not found"),
            @ApiResponse(responseCode = "409", description = "Username conflict")
    })
    public ResponseEntity<UserProfileResponse> updateProfile(@PathVariable("id") Long userId,
                                                             @Valid @RequestBody UpdateProfileRequest request) {
        Long authenticatedUserId = UserContext.getUserId();
        UserProfileResponse response = userProfileService.updateProfile(authenticatedUserId, userId, request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/follow")
    @Operation(summary = "Follow user", description = "Follows the specified target user ID")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "User successfully followed"),
            @ApiResponse(responseCode = "400", description = "Cannot follow yourself"),
            @ApiResponse(responseCode = "401", description = "Unauthenticated user"),
            @ApiResponse(responseCode = "404", description = "Target user not found"),
            @ApiResponse(responseCode = "409", description = "Already following user")
    })
    public ResponseEntity<Void> followUser(@PathVariable("id") Long targetUserId) {
        Long authenticatedUserId = UserContext.getUserId();
        userProfileService.followUser(authenticatedUserId, targetUserId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}/follow")
    @Operation(summary = "Unfollow user", description = "Unfollows the specified target user ID")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "User successfully unfollowed"),
            @ApiResponse(responseCode = "401", description = "Unauthenticated user"),
            @ApiResponse(responseCode = "404", description = "Target user not found")
    })
    public ResponseEntity<Void> unfollowUser(@PathVariable("id") Long targetUserId) {
        Long authenticatedUserId = UserContext.getUserId();
        userProfileService.unfollowUser(authenticatedUserId, targetUserId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/followers")
    @Operation(summary = "Get followers", description = "Retrieves a paginated list of followers for the specified user ID")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Followers list successfully retrieved"),
            @ApiResponse(responseCode = "404", description = "User not found")
    })
    public ResponseEntity<PageResponse<UserProfileResponse>> getFollowers(
            @PathVariable("id") Long userId,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        Long currentUserId = UserContext.getUserId();
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        PageResponse<UserProfileResponse> response = userProfileService.getFollowers(userId, currentUserId, pageable);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}/following")
    @Operation(summary = "Get following", description = "Retrieves a paginated list of users followed by the specified user ID")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Following list successfully retrieved"),
            @ApiResponse(responseCode = "404", description = "User not found")
    })
    public ResponseEntity<PageResponse<UserProfileResponse>> getFollowing(
            @PathVariable("id") Long userId,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        Long currentUserId = UserContext.getUserId();
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        PageResponse<UserProfileResponse> response = userProfileService.getFollowing(userId, currentUserId, pageable);
        return ResponseEntity.ok(response);
    }
}
