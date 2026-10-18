package com.talktrading.community.mapper;

import com.talktrading.community.dto.PostMediaResponse;
import com.talktrading.community.entity.PostMedia;
import org.springframework.stereotype.Component;

@Component
public class PostMediaMapper {

    public PostMediaResponse toResponse(PostMedia media) {
        if (media == null) {
            return null;
        }

        return PostMediaResponse.builder()
                .id(media.getId())
                .postId(media.getPostId())
                .mediaType(media.getMediaType())
                .mediaUrl(media.getMediaUrl())
                .createdAt(media.getCreatedAt())
                .build();
    }
}
