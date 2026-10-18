package com.talktrading.community.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateCommunityRequest {

    @NotBlank(message = "Community name cannot be empty")
    @Size(min = 3, max = 100, message = "Community name must be between 3 and 100 characters")
    private String name;

    @Size(max = 1000, message = "Description must not exceed 1000 characters")
    private String description;

    @Size(max = 255, message = "Icon URL must not exceed 255 characters")
    private String icon;
}
