package com.talktrading.community.storage;

import com.talktrading.community.exception.BadRequestException;
import com.talktrading.community.exception.ResourceNotFoundException;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.nio.file.*;
import java.util.UUID;

@Service
public class LocalMediaStorageService implements MediaStorageService {

    private final Path uploadPath;

    public LocalMediaStorageService(@Value("${app.storage.local-dir:./uploads}") String uploadDir) {
        this.uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(this.uploadPath);
        } catch (IOException e) {
            throw new RuntimeException("Could not initialize storage directory: " + this.uploadPath, e);
        }
    }

    @Override
    public String storeFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Failed to store empty file");
        }

        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename() != null ? file.getOriginalFilename() : "");
        String extension = getFileExtension(originalFilename);
        
        // Generate unique safe filename
        String uniqueFilename = UUID.randomUUID().toString() + "_" + System.currentTimeMillis() + (extension.isEmpty() ? "" : "." + extension);

        try {
            if (uniqueFilename.contains("..")) {
                throw new BadRequestException("Cannot store file with relative path outside directory " + uniqueFilename);
            }

            Path targetLocation = this.uploadPath.resolve(uniqueFilename);
            try (InputStream inputStream = file.getInputStream()) {
                Files.copy(inputStream, targetLocation, StandardCopyOption.REPLACE_EXISTING);
            }

            return "/api/v1/media/files/" + uniqueFilename;
        } catch (IOException e) {
            throw new RuntimeException("Failed to store file " + uniqueFilename, e);
        }
    }

    @Override
    public Resource loadFileAsResource(String fileName) {
        try {
            Path filePath = this.uploadPath.resolve(fileName).normalize();
            if (!filePath.startsWith(this.uploadPath)) {
                throw new BadRequestException("File access outside upload directory is not allowed");
            }

            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists() && resource.isReadable()) {
                return resource;
            } else {
                throw new ResourceNotFoundException("File not found: " + fileName);
            }
        } catch (MalformedURLException e) {
            throw new ResourceNotFoundException("File not found: " + fileName);
        }
    }

    @Override
    public void deleteFile(String mediaUrlOrPath) {
        if (mediaUrlOrPath == null || mediaUrlOrPath.isBlank()) {
            return;
        }

        String fileName = mediaUrlOrPath;
        if (mediaUrlOrPath.contains("/files/")) {
            fileName = mediaUrlOrPath.substring(mediaUrlOrPath.lastIndexOf("/files/") + 7);
        } else if (mediaUrlOrPath.contains("/")) {
            fileName = mediaUrlOrPath.substring(mediaUrlOrPath.lastIndexOf("/") + 1);
        }

        try {
            Path filePath = this.uploadPath.resolve(fileName).normalize();
            if (filePath.startsWith(this.uploadPath)) {
                Files.deleteIfExists(filePath);
            }
        } catch (IOException e) {
            // Log warning or ignore deletion failure
        }
    }

    private String getFileExtension(String filename) {
        if (filename == null || filename.lastIndexOf('.') == -1) {
            return "";
        }
        String ext = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
        return ext.replaceAll("[^a-z0-9]", "");
    }
}
