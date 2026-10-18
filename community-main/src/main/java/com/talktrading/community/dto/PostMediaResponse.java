package com.talktrading.community.dto;

import com.talktrading.community.enums.PostMediaType;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PostMediaResponse {

    private Long id;
    private Long postId;
    private PostMediaType mediaType;
    private String mediaUrl;
    private LocalDateTime createdAt;
}
