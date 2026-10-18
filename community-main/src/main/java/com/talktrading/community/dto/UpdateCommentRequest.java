package com.talktrading.community.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateCommentRequest {

    @NotBlank(message = "Comment content cannot be empty")
    @Size(max = 2000, message = "Comment content must not exceed 2000 characters")
    private String content;
}
