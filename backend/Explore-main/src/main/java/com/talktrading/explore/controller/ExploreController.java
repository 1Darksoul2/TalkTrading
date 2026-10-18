package com.talktrading.explore.controller;

import com.talktrading.explore.config.SecurityUtils;
import com.talktrading.explore.dto.ErrorResponse;
import com.talktrading.explore.dto.ExploreResponse;
import com.talktrading.explore.dto.UserInteractionRequest;
import com.talktrading.explore.service.ExploreService;
import com.talktrading.explore.service.RecommendationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/explore")
@Tag(name = "Explore", description = "Endpoints for discovering trending, popular, recent, and personalized content")
public class ExploreController {

    private final ExploreService exploreService;
    private final RecommendationService recommendationService;
    private final SecurityUtils securityUtils;

    public ExploreController(ExploreService exploreService,
                             RecommendationService recommendationService,
                             SecurityUtils securityUtils) {
        this.exploreService = exploreService;
        this.recommendationService = recommendationService;
        this.securityUtils = securityUtils;
    }

    @Operation(summary = "Get Personalized Explore Feed",
            description = "Retrieves ranked and personalized discoverable posts. Supports optional filtering by category or hashtag.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Successfully retrieved explore feed",
                    content = @Content(schema = @Schema(implementation = ExploreResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid pagination or query parameters",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "500", description = "Internal server error",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping
    public ResponseEntity<ExploreResponse> getExplore(
            @Parameter(description = "Optional user ID for personalized ranking (dev mode or gateway context)")
            @RequestParam(required = false) Long userId,
            @Parameter(description = "Page index, 0-based", example = "0")
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size (1 to 50)", example = "20")
            @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "Optional category filter", example = "crypto")
            @RequestParam(required = false) String category,
            @Parameter(description = "Optional hashtag filter", example = "bitcoin")
            @RequestParam(required = false) String hashtag,
            HttpServletRequest request
    ) {
        Optional<Long> effectiveUserId = securityUtils.resolveUserId(request, userId);
        ExploreResponse response = exploreService.getExploreFeed(effectiveUserId.orElse(null), page, size, category, hashtag);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Get Trending Posts",
            description = "Retrieves current trending posts ranked by recent interaction velocity and engagement.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Successfully retrieved trending posts",
                    content = @Content(schema = @Schema(implementation = ExploreResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid page or size parameters",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping("/trending")
    public ResponseEntity<ExploreResponse> getTrending(
            @Parameter(description = "Page index, 0-based", example = "0")
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size (1 to 50)", example = "20")
            @RequestParam(defaultValue = "20") int size
    ) {
        ExploreResponse response = exploreService.getTrending(page, size);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Get Popular Posts",
            description = "Retrieves all-time popular posts ranked heavily by total likes, views, and comments.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Successfully retrieved popular posts",
                    content = @Content(schema = @Schema(implementation = ExploreResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid page or size parameters",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping("/popular")
    public ResponseEntity<ExploreResponse> getPopular(
            @Parameter(description = "Page index, 0-based", example = "0")
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size (1 to 50)", example = "20")
            @RequestParam(defaultValue = "20") int size
    ) {
        ExploreResponse response = exploreService.getPopular(page, size);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Get Recent Posts",
            description = "Retrieves newly created posts sorted chronologically by creation timestamp.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Successfully retrieved recent posts",
                    content = @Content(schema = @Schema(implementation = ExploreResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid page or size parameters",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping("/recent")
    public ResponseEntity<ExploreResponse> getRecent(
            @Parameter(description = "Page index, 0-based", example = "0")
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size (1 to 50)", example = "20")
            @RequestParam(defaultValue = "20") int size
    ) {
        ExploreResponse response = exploreService.getRecent(page, size);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Get Posts by Hashtag",
            description = "Retrieves ranked posts indexed under a specific hashtag.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Successfully retrieved posts for hashtag",
                    content = @Content(schema = @Schema(implementation = ExploreResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid hashtag or pagination parameters",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping("/hashtags/{hashtag}")
    public ResponseEntity<ExploreResponse> getByHashtag(
            @Parameter(description = "Target hashtag (without leading #)", example = "bitcoin")
            @PathVariable String hashtag,
            @Parameter(description = "Page index, 0-based", example = "0")
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size (1 to 50)", example = "20")
            @RequestParam(defaultValue = "20") int size
    ) {
        ExploreResponse response = exploreService.getByHashtag(hashtag, page, size);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Record Post Interaction",
            description = "Records a user interaction with an Explore post (VIEW, LIKE, CLICK, DISMISS) to adapt personal recommendation weights. Requires user identity via X-User-Id gateway header (or userId param in dev mode).")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "201", description = "Interaction recorded successfully"),
            @ApiResponse(responseCode = "400", description = "Invalid interaction request payload",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "401", description = "User identity header missing or unauthenticated")
    })
    @PostMapping("/interactions")
    public ResponseEntity<Map<String, String>> recordInteraction(
            @Parameter(description = "Optional user ID in query (dev mode only) or gateway header")
            @RequestParam(required = false) Long userId,
            @Valid @RequestBody UserInteractionRequest interactionRequest,
            HttpServletRequest request
    ) {
        Optional<Long> effectiveUserId = securityUtils.resolveUserId(request, userId);
        if (effectiveUserId.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("status", "unauthorized", "message", "User identity (X-User-Id header) is required to record interactions"));
        }

        recommendationService.recordInteraction(
                effectiveUserId.get(),
                interactionRequest.getPostId(),
                interactionRequest.getInteractionType(),
                interactionRequest.getCategory()
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("status", "recorded"));
    }
}
