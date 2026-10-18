package com.talktrading.community.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.talktrading.community.dto.CreatePostRequest;
import com.talktrading.community.entity.PostMedia;
import com.talktrading.community.enums.PostMediaType;
import com.talktrading.community.enums.PostType;
import com.talktrading.community.repository.PostMediaRepository;
import com.talktrading.community.repository.PostRepository;
import com.talktrading.community.security.UserContextFilter;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class MediaControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private PostMediaRepository postMediaRepository;

    @Value("${app.storage.local-dir:./uploads}")
    private String uploadDir;

    private Long postId;
    private Path uploadPath;

    @BeforeEach
    void setUp() throws Exception {
        postMediaRepository.deleteAll();
        postRepository.deleteAll();

        uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(uploadPath);

        // Create post owned by User 601
        CreatePostRequest postReq = CreatePostRequest.builder()
                .postType(PostType.CHART)
                .title("Media Test Post")
                .build();

        String response = mockMvc.perform(post("/api/v1/posts")
                        .header(UserContextFilter.USER_ID_HEADER, "601")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(postReq)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        postId = objectMapper.readTree(response).get("id").asLong();
    }

    @AfterEach
    void tearDown() throws Exception {
        // Clean up test media files written to physical local storage directory
        if (Files.exists(uploadPath)) {
            try (var stream = Files.walk(uploadPath)) {
                stream.sorted((p1, p2) -> p2.compareTo(p1))
                        .filter(p -> !p.equals(uploadPath))
                        .forEach(p -> {
                            try {
                                Files.deleteIfExists(p);
                            } catch (Exception ignored) {}
                        });
            }
        }
    }

    @Test
    void uploadImageMedia_success_andPersistedToStorageAndDb() throws Exception {
        MockMultipartFile imageFile = new MockMultipartFile(
                "file",
                "chart_screenshot.png",
                "image/png",
                "binary image data".getBytes()
        );

        String resultJson = mockMvc.perform(multipart("/api/v1/posts/" + postId + "/media")
                        .file(imageFile)
                        .param("mediaType", "CHART_IMAGE")
                        .header(UserContextFilter.USER_ID_HEADER, "601"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.postId", is(postId.intValue())))
                .andExpect(jsonPath("$.mediaType", is("CHART_IMAGE")))
                .andExpect(jsonPath("$.mediaUrl", containsString("/api/v1/media/files/")))
                .andReturn().getResponse().getContentAsString();

        String mediaUrl = objectMapper.readTree(resultJson).get("mediaUrl").asText();

        // 1. Verify media metadata persistence in PostgreSQL/H2 DB table
        List<PostMedia> mediaInDb = postMediaRepository.findByPostId(postId);
        assertEquals(1, mediaInDb.size());
        assertEquals(PostMediaType.CHART_IMAGE, mediaInDb.get(0).getMediaType());

        // 2. Verify media file actually written to physical local storage directory (Requirement 16)
        String storedFilename = mediaUrl.substring(mediaUrl.lastIndexOf("/") + 1);
        Path physicalFile = uploadPath.resolve(storedFilename);
        assertTrue(Files.exists(physicalFile), "File should actually exist on local disk");
        assertEquals("binary image data", Files.readString(physicalFile));

        // 3. Verify serving local file via GET endpoint
        mockMvc.perform(get(mediaUrl))
                .andExpect(status().isOk())
                .andExpect(content().string("binary image data"));
    }

    @Test
    void uploadVideoMedia_success() throws Exception {
        MockMultipartFile videoFile = new MockMultipartFile(
                "file",
                "analysis.mp4",
                "video/mp4",
                "binary video data".getBytes()
        );

        mockMvc.perform(multipart("/api/v1/posts/" + postId + "/media")
                        .file(videoFile)
                        .param("mediaType", "VIDEO")
                        .header(UserContextFilter.USER_ID_HEADER, "601"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.mediaType", is("VIDEO")))
                .andExpect(jsonPath("$.mediaUrl", containsString(".mp4")));
    }

    @Test
    void uploadMedia_unsupportedFileType_returnsBadRequest() throws Exception {
        MockMultipartFile exeFile = new MockMultipartFile(
                "file",
                "script.exe",
                "application/x-msdownload",
                "exe content".getBytes()
        );

        mockMvc.perform(multipart("/api/v1/posts/" + postId + "/media")
                        .file(exeFile)
                        .param("mediaType", "IMAGE")
                        .header(UserContextFilter.USER_ID_HEADER, "601"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void uploadMedia_emptyFile_returnsBadRequest() throws Exception {
        MockMultipartFile emptyFile = new MockMultipartFile(
                "file",
                "empty.png",
                "image/png",
                new byte[0]
        );

        mockMvc.perform(multipart("/api/v1/posts/" + postId + "/media")
                        .file(emptyFile)
                        .param("mediaType", "IMAGE")
                        .header(UserContextFilter.USER_ID_HEADER, "601"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void uploadMedia_unauthorized_missingHeader_returnsUnauthorized() throws Exception {
        MockMultipartFile imageFile = new MockMultipartFile(
                "file",
                "chart.png",
                "image/png",
                "data".getBytes()
        );

        mockMvc.perform(multipart("/api/v1/posts/" + postId + "/media")
                        .file(imageFile)
                        .param("mediaType", "IMAGE"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void uploadMedia_postOwnershipValidation_returnsUnauthorized() throws Exception {
        MockMultipartFile imageFile = new MockMultipartFile(
                "file",
                "chart.png",
                "image/png",
                "data".getBytes()
        );

        // User 999 attempts to upload to User 601's post
        mockMvc.perform(multipart("/api/v1/posts/" + postId + "/media")
                        .file(imageFile)
                        .param("mediaType", "IMAGE")
                        .header(UserContextFilter.USER_ID_HEADER, "999"))
                .andExpect(status().isUnauthorized());
    }
}
