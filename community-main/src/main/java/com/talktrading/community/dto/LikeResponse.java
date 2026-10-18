package com.talktrading.community.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LikeResponse {

    private Long postId;
    private Long likeCount;
    private Boolean hasLiked;
}
