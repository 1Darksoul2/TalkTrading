package com.talktrading.community.service;

import com.talktrading.community.dto.PostMediaResponse;
import com.talktrading.community.enums.PostMediaType;
import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface MediaService {

    PostMediaResponse uploadPostMedia(Long authenticatedUserId, Long postId, PostMediaType mediaType, MultipartFile file);

    List<PostMediaResponse> getMediaByPostId(Long postId);

    void deletePostMedia(Long authenticatedUserId, Long postId, Long mediaId);

    Resource loadMediaFile(String fileName);
}
