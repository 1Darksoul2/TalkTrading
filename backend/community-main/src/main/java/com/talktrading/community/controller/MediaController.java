package com.talktrading.community.controller;

import com.talktrading.community.dto.PostMediaResponse;
import com.talktrading.community.enums.PostMediaType;
import com.talktrading.community.security.UserContext;
import com.talktrading.community.service.MediaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Media", description = "Endpoints for uploading, deleting, and serving post media")
public class MediaController {

    private final MediaService mediaService;

    @PostMapping(value = "/posts/{postId}/media", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload post media", description = "Uploads media (IMAGE, VIDEO, CHART_IMAGE, SCREENSHOT) for a post owned by the authenticated user")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Media successfully uploaded"),
            @ApiResponse(responseCode = "400", description = "Invalid file, empty file, unsupported extension, or file exceeds size limit"),
            @ApiResponse(responseCode = "401", description = "Unauthorized: user does not own this post"),
            @ApiResponse(responseCode = "404", description = "Post not found")
    })
    public ResponseEntity<PostMediaResponse> uploadPostMedia(
            @PathVariable("postId") Long postId,
            @RequestParam("mediaType") PostMediaType mediaType,
            @RequestParam("file") MultipartFile file) {
        Long authenticatedUserId = UserContext.getUserId();
        PostMediaResponse response = mediaService.uploadPostMedia(authenticatedUserId, postId, mediaType, file);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/posts/{postId}/media")
    @Operation(summary = "Get post media", description = "Retrieves a list of media attachments for a post")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Media list successfully retrieved"),
            @ApiResponse(responseCode = "404", description = "Post not found")
    })
    public ResponseEntity<List<PostMediaResponse>> getPostMedia(@PathVariable("postId") Long postId) {
        List<PostMediaResponse> response = mediaService.getMediaByPostId(postId);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/posts/{postId}/media/{mediaId}")
    @Operation(summary = "Delete post media", description = "Deletes a media attachment owned by the authenticated user")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Media successfully deleted"),
            @ApiResponse(responseCode = "401", description = "Unauthorized: user does not own this post"),
            @ApiResponse(responseCode = "404", description = "Post or media attachment not found")
    })
    public ResponseEntity<Void> deletePostMedia(
            @PathVariable("postId") Long postId,
            @PathVariable("mediaId") Long mediaId) {
        Long authenticatedUserId = UserContext.getUserId();
        mediaService.deletePostMedia(authenticatedUserId, postId, mediaId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/media/files/{filename:.+}")
    @Operation(summary = "Serve media file", description = "Serves stored local media files directly")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "File content successfully returned"),
            @ApiResponse(responseCode = "404", description = "Media file not found")
    })
    public ResponseEntity<Resource> serveMediaFile(@PathVariable("filename") String filename) {
        Resource resource = mediaService.loadMediaFile(filename);
        String contentType = "application/octet-stream";
        try {
            if (filename.endsWith(".png")) contentType = "image/png";
            else if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) contentType = "image/jpeg";
            else if (filename.endsWith(".gif")) contentType = "image/gif";
            else if (filename.endsWith(".webp")) contentType = "image/webp";
            else if (filename.endsWith(".mp4")) contentType = "video/mp4";
            else if (filename.endsWith(".webm")) contentType = "video/webm";
        } catch (Exception ignored) {}

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + resource.getFilename() + "\"")
                .body(resource);
    }
}
