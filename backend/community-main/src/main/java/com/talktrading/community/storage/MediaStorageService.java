package com.talktrading.community.storage;

import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

public interface MediaStorageService {

    /**
     * Stores a multipart file and returns its relative access URL/path.
     */
    String storeFile(MultipartFile file);

    /**
     * Loads a stored file as a Resource.
     */
    Resource loadFileAsResource(String fileName);

    /**
     * Deletes a file by its URL or stored filename.
     */
    void deleteFile(String mediaUrlOrPath);
}
