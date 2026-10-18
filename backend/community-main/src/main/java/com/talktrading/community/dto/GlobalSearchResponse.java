package com.talktrading.community.dto;

import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GlobalSearchResponse {

    @Builder.Default
    private List<UserProfileResponse> users = new ArrayList<>();

    @Builder.Default
    private List<PostResponse> posts = new ArrayList<>();

    @Builder.Default
    private List<CommunityResponse> communities = new ArrayList<>();
}
