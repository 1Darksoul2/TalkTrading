package com.talktrading.community.service;

import com.talktrading.community.dto.PostMediaResponse;
import com.talktrading.community.entity.Post;
import com.talktrading.community.entity.PostMedia;
import com.talktrading.community.enums.PostMediaType;
import com.talktrading.community.enums.PostType;
import com.talktrading.community.exception.BadRequestException;
import com.talktrading.community.exception.ResourceNotFoundException;
import com.talktrading.community.exception.UnauthorizedException;
import com.talktrading.community.mapper.PostMediaMapper;
import com.talktrading.community.repository.PostMediaRepository;
import com.talktrading.community.repository.PostRepository;
import com.talktrading.community.storage.MediaStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MediaServiceImplTest {

    @Mock
    private PostRepository postRepository;

    @Mock
    private PostMediaRepository postMediaRepository;

    @Mock
    private MediaStorageService mediaStorageService;

    @Spy
    private PostMediaMapper postMediaMapper = new PostMediaMapper();

    @InjectMocks
    private MediaServiceImpl mediaService;

    private Post ownerPost;

    @BeforeEach
    void setUp() {
        ownerPost = Post.builder()
                .id(10L)
                .userId(101L)
                .postType(PostType.CHART)
                .title("Sample Post")
                .build();
    }

    @Test
    void uploadPostMedia_successfulImageUpload() {
        MockMultipartFile imageFile = new MockMultipartFile("file", "chart.png", "image/png", "png data".getBytes());
        PostMedia savedMedia = PostMedia.builder()
                .id(1L)
                .postId(10L)
                .mediaType(PostMediaType.CHART_IMAGE)
                .mediaUrl("/api/v1/media/files/unique_chart.png")
                .build();

        when(postRepository.findById(10L)).thenReturn(Optional.of(ownerPost));
        when(mediaStorageService.storeFile(imageFile)).thenReturn("/api/v1/media/files/unique_chart.png");
        when(postMediaRepository.save(any(PostMedia.class))).thenReturn(savedMedia);

        PostMediaResponse response = mediaService.uploadPostMedia(101L, 10L, PostMediaType.CHART_IMAGE, imageFile);

        assertNotNull(response);
        assertEquals(10L, response.getPostId());
        assertEquals(PostMediaType.CHART_IMAGE, response.getMediaType());
        assertEquals("/api/v1/media/files/unique_chart.png", response.getMediaUrl());
    }

    @Test
    void uploadPostMedia_successfulVideoUpload() {
        MockMultipartFile videoFile = new MockMultipartFile("file", "demo.mp4", "video/mp4", "mp4 data".getBytes());
        PostMedia savedMedia = PostMedia.builder()
                .id(2L)
                .postId(10L)
                .mediaType(PostMediaType.VIDEO)
                .mediaUrl("/api/v1/media/files/unique_video.mp4")
                .build();

        when(postRepository.findById(10L)).thenReturn(Optional.of(ownerPost));
        when(mediaStorageService.storeFile(videoFile)).thenReturn("/api/v1/media/files/unique_video.mp4");
        when(postMediaRepository.save(any(PostMedia.class))).thenReturn(savedMedia);

        PostMediaResponse response = mediaService.uploadPostMedia(101L, 10L, PostMediaType.VIDEO, videoFile);

        assertNotNull(response);
        assertEquals(PostMediaType.VIDEO, response.getMediaType());
    }

    @Test
    void uploadPostMedia_unsupportedFileType_throwsBadRequestException() {
        MockMultipartFile exeFile = new MockMultipartFile("file", "malware.exe", "application/x-msdownload", "exe bytes".getBytes());
        when(postRepository.findById(10L)).thenReturn(Optional.of(ownerPost));

        assertThrows(BadRequestException.class, () ->
                mediaService.uploadPostMedia(101L, 10L, PostMediaType.IMAGE, exeFile)
        );

        verify(mediaStorageService, never()).storeFile(any());
    }

    @Test
    void uploadPostMedia_emptyFile_throwsBadRequestException() {
        MockMultipartFile emptyFile = new MockMultipartFile("file", "empty.png", "image/png", new byte[0]);

        assertThrows(BadRequestException.class, () ->
                mediaService.uploadPostMedia(101L, 10L, PostMediaType.IMAGE, emptyFile)
        );
    }

    @Test
    void uploadPostMedia_unauthorizedUser_throwsUnauthorizedException() {
        MockMultipartFile imageFile = new MockMultipartFile("file", "chart.png", "image/png", "png data".getBytes());

        assertThrows(UnauthorizedException.class, () ->
                mediaService.uploadPostMedia(null, 10L, PostMediaType.IMAGE, imageFile)
        );
    }

    @Test
    void uploadPostMedia_postOwnershipValidation_throwsUnauthorizedException() {
        MockMultipartFile imageFile = new MockMultipartFile("file", "chart.png", "image/png", "png data".getBytes());
        when(postRepository.findById(10L)).thenReturn(Optional.of(ownerPost));

        // User 999 attempts to upload to User 101's post
        assertThrows(UnauthorizedException.class, () ->
                mediaService.uploadPostMedia(999L, 10L, PostMediaType.IMAGE, imageFile)
        );

        verify(mediaStorageService, never()).storeFile(any());
    }

    @Test
    void uploadPostMedia_postNotFound_throwsResourceNotFoundException() {
        MockMultipartFile imageFile = new MockMultipartFile("file", "chart.png", "image/png", "png data".getBytes());
        when(postRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () ->
                mediaService.uploadPostMedia(101L, 999L, PostMediaType.IMAGE, imageFile)
        );
    }
}
