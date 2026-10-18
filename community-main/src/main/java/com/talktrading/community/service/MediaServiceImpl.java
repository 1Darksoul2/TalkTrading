package com.talktrading.community.service;

import com.talktrading.community.dto.PostMediaResponse;
import com.talktrading.community.entity.Post;
import com.talktrading.community.entity.PostMedia;
import com.talktrading.community.enums.PostMediaType;
import com.talktrading.community.exception.BadRequestException;
import com.talktrading.community.exception.ResourceNotFoundException;
import com.talktrading.community.exception.UnauthorizedException;
import com.talktrading.community.mapper.PostMediaMapper;
import com.talktrading.community.repository.PostMediaRepository;
import com.talktrading.community.repository.PostRepository;
import com.talktrading.community.storage.MediaStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MediaServiceImpl implements MediaService {

    private static final long DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

    private static final Set<String> ALLOWED_IMAGE_CONTENT_TYPES = Set.of(
            "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"
    );

    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS = Set.of(
            "jpg", "jpeg", "png", "webp", "gif"
    );

    private static final Set<String> ALLOWED_VIDEO_CONTENT_TYPES = Set.of(
            "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/avi"
    );

    private static final Set<String> ALLOWED_VIDEO_EXTENSIONS = Set.of(
            "mp4", "webm", "mov", "avi"
    );

    private final PostRepository postRepository;
    private final PostMediaRepository postMediaRepository;
    private final MediaStorageService mediaStorageService;
    private final PostMediaMapper postMediaMapper;

    @Value("${app.media.max-file-size-bytes:52428800}")
    private long maxFileSizeBytes = DEFAULT_MAX_FILE_SIZE;

    @Override
    @Transactional
    public PostMediaResponse uploadPostMedia(Long authenticatedUserId, Long postId, PostMediaType mediaType, MultipartFile file) {
        if (authenticatedUserId == null) {
            throw new UnauthorizedException("User ID is required to upload media");
        }

        if (mediaType == null) {
            throw new BadRequestException("Media type is required");
        }

        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Uploaded file cannot be empty");
        }

        if (file.getSize() > maxFileSizeBytes) {
            throw new BadRequestException("File size exceeds maximum allowed limit of " + maxFileSizeBytes + " bytes");
        }

        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Post not found with ID: " + postId));

        if (!post.getUserId().equals(authenticatedUserId)) {
            throw new UnauthorizedException("You can only upload media to your own posts");
        }

        validateFileTypeAndExtension(mediaType, file);

        String mediaUrl = mediaStorageService.storeFile(file);

        PostMedia postMedia = PostMedia.builder()
                .postId(postId)
                .mediaType(mediaType)
                .mediaUrl(mediaUrl)
                .build();

        PostMedia savedMedia = postMediaRepository.save(postMedia);
        return postMediaMapper.toResponse(savedMedia);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PostMediaResponse> getMediaByPostId(Long postId) {
        if (!postRepository.existsById(postId)) {
            throw new ResourceNotFoundException("Post not found with ID: " + postId);
        }

        return postMediaRepository.findByPostId(postId).stream()
                .map(postMediaMapper::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void deletePostMedia(Long authenticatedUserId, Long postId, Long mediaId) {
        if (authenticatedUserId == null) {
            throw new UnauthorizedException("User ID is required to delete media");
        }

        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Post not found with ID: " + postId));

        if (!post.getUserId().equals(authenticatedUserId)) {
            throw new UnauthorizedException("You can only delete media from your own posts");
        }

        PostMedia media = postMediaRepository.findById(mediaId)
                .orElseThrow(() -> new ResourceNotFoundException("Post media not found with ID: " + mediaId));

        if (!media.getPostId().equals(postId)) {
            throw new BadRequestException("Media ID " + mediaId + " does not belong to post ID " + postId);
        }

        mediaStorageService.deleteFile(media.getMediaUrl());
        postMediaRepository.delete(media);
    }

    @Override
    public Resource loadMediaFile(String fileName) {
        return mediaStorageService.loadFileAsResource(fileName);
    }

    private void validateFileTypeAndExtension(PostMediaType mediaType, MultipartFile file) {
        String contentType = file.getContentType() != null ? file.getContentType().toLowerCase() : "";
        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        String extension = getExtension(originalFilename);

        if (mediaType == PostMediaType.IMAGE || mediaType == PostMediaType.CHART_IMAGE || mediaType == PostMediaType.SCREENSHOT) {
            boolean validContentType = contentType.startsWith("image/") || ALLOWED_IMAGE_CONTENT_TYPES.contains(contentType);
            boolean validExtension = ALLOWED_IMAGE_EXTENSIONS.contains(extension);

            if (!validContentType && !validExtension) {
                throw new BadRequestException("Unsupported or invalid image file type/extension for mediaType " + mediaType);
            }
        } else if (mediaType == PostMediaType.VIDEO) {
            boolean validContentType = contentType.startsWith("video/") || ALLOWED_VIDEO_CONTENT_TYPES.contains(contentType);
            boolean validExtension = ALLOWED_VIDEO_EXTENSIONS.contains(extension);

            if (!validContentType && !validExtension) {
                throw new BadRequestException("Unsupported or invalid video file type/extension for mediaType VIDEO");
            }
        } else {
            throw new BadRequestException("Unsupported mediaType: " + mediaType);
        }
    }

    private String getExtension(String filename) {
        if (filename == null || filename.lastIndexOf('.') == -1) {
            return "";
        }
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    }
}
