package com.talktrading.community.mapper;

import com.talktrading.community.dto.CommunityResponse;
import com.talktrading.community.entity.Community;
import com.talktrading.community.enums.CommunityRole;
import org.springframework.stereotype.Component;

@Component
public class CommunityMapper {

    public CommunityResponse toResponse(Community community) {
        return toResponse(community, null);
    }

    public CommunityResponse toResponse(Community community, CommunityRole currentUserRole) {
        if (community == null) {
            return null;
        }

        return CommunityResponse.builder()
                .id(community.getId())
                .name(community.getName())
                .description(community.getDescription())
                .icon(community.getIcon())
                .createdBy(community.getCreatedBy())
                .memberCount(community.getMemberCount() != null ? community.getMemberCount() : 0L)
                .createdAt(community.getCreatedAt())
                .updatedAt(community.getUpdatedAt())
                .currentUserRole(currentUserRole)
                .isMember(currentUserRole != null)
                .build();
    }
}
