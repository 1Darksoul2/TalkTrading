package com.talktrading.community.dto;

import com.talktrading.community.enums.CommunityRole;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommunityResponse {

    private Long id;
    private String name;
    private String description;
    private String icon;
    private Long createdBy;
    private Long memberCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private CommunityRole currentUserRole;
    private Boolean isMember;
}
