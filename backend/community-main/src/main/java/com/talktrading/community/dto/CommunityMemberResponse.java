package com.talktrading.community.dto;

import com.talktrading.community.enums.CommunityRole;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommunityMemberResponse {

    private Long id;
    private Long communityId;
    private Long userId;
    private CommunityRole role;
    private LocalDateTime joinedAt;

    private String username;
    private String displayName;
    private String profileImage;
}
