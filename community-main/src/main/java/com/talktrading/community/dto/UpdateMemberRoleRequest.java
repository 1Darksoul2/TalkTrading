package com.talktrading.community.dto;

import com.talktrading.community.enums.CommunityRole;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateMemberRoleRequest {

    @NotNull(message = "Role is required")
    private CommunityRole role;
}
