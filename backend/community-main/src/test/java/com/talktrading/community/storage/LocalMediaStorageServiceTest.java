package com.talktrading.community.storage;

import com.talktrading.community.exception.BadRequestException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.Resource;
import org.springframework.mock.web.MockMultipartFile;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class LocalMediaStorageServiceTest {

    @TempDir
    Path tempDir;

    private LocalMediaStorageService storageService;

    @BeforeEach
    void setUp() {
        storageService = new LocalMediaStorageService(tempDir.toString());
        storageService.init();
    }

    @Test
    void storeFile_success() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "test-image.png",
                "image/png",
                "sample png content".getBytes()
        );

        String mediaUrl = storageService.storeFile(file);

        assertNotNull(mediaUrl);
        assertTrue(mediaUrl.startsWith("/api/v1/media/files/"));
        assertFalse(mediaUrl.contains("test-image.png")); // Confirms safe unique filename generation

        String filename = mediaUrl.substring(mediaUrl.lastIndexOf("/") + 1);
        Path storedPath = tempDir.resolve(filename);
        assertTrue(Files.exists(storedPath));
        assertEquals("sample png content", Files.readString(storedPath));
    }

    @Test
    void storeFile_emptyFile_throwsBadRequestException() {
        MockMultipartFile emptyFile = new MockMultipartFile("file", "empty.png", "image/png", new byte[0]);
        assertThrows(BadRequestException.class, () -> storageService.storeFile(emptyFile));
    }

    @Test
    void loadFileAsResource_success() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "sample.jpg", "image/jpeg", "data".getBytes());
        String mediaUrl = storageService.storeFile(file);
        String filename = mediaUrl.substring(mediaUrl.lastIndexOf("/") + 1);

        Resource resource = storageService.loadFileAsResource(filename);
        assertNotNull(resource);
        assertTrue(resource.exists());
        assertTrue(resource.isReadable());
    }

    @Test
    void deleteFile_success() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "sample.jpg", "image/jpeg", "data".getBytes());
        String mediaUrl = storageService.storeFile(file);
        String filename = mediaUrl.substring(mediaUrl.lastIndexOf("/") + 1);
        Path storedPath = tempDir.resolve(filename);

        assertTrue(Files.exists(storedPath));

        storageService.deleteFile(mediaUrl);

        assertFalse(Files.exists(storedPath));
    }
}
