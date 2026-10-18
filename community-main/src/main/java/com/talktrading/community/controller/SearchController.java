package com.talktrading.community.controller;

import com.talktrading.community.dto.GlobalSearchResponse;
import com.talktrading.community.security.UserContext;
import com.talktrading.community.service.SearchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/search")
@RequiredArgsConstructor
@Tag(name = "Global Search", description = "Endpoints for searching across Users, Communities, and Posts")
public class SearchController {

    private static final int MAX_PAGE_SIZE = 50;

    private final SearchService searchService;

    @GetMapping
    @Operation(summary = "Global search", description = "Searches across users, communities, and posts using case-insensitive partial matching")
    public ResponseEntity<GlobalSearchResponse> searchGlobal(
            @RequestParam(value = "q", required = false) String query,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        Long currentUserId = UserContext.getUserId();
        int cappedSize = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(Math.max(0, page), cappedSize);
        GlobalSearchResponse response = searchService.searchGlobal(currentUserId, query, pageable);
        return ResponseEntity.ok(response);
    }
}
