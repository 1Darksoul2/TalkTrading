package com.talktrading.community.mapper;

import com.talktrading.community.dto.CommunityMemberResponse;
import com.talktrading.community.entity.CommunityMember;
import com.talktrading.community.entity.UserProfile;
import org.springframework.stereotype.Component;

@Component
public class CommunityMemberMapper {

    public CommunityMemberResponse toResponse(CommunityMember member) {
        return toResponse(member, null);
    }

    public CommunityMemberResponse toResponse(CommunityMember member, UserProfile userProfile) {
        if (member == null) {
            return null;
        }

        return CommunityMemberResponse.builder()
                .id(member.getId())
                .communityId(member.getCommunityId())
                .userId(member.getUserId())
                .role(member.getRole())
                .joinedAt(member.getJoinedAt())
                .username(userProfile != null ? userProfile.getUsername() : null)
                .displayName(userProfile != null ? userProfile.getDisplayName() : null)
                .profileImage(userProfile != null ? userProfile.getProfileImage() : null)
                .build();
    }
}
