package com.talktrading.explore.dto;

import com.talktrading.explore.entity.InteractionType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(description = "Request body to record an Explore post interaction")
public class UserInteractionRequest {

    @Schema(description = "ID of the post interacted with", example = "123")
    @NotNull(message = "postId is required")
    private Long postId;

    @Schema(description = "Type of interaction", example = "CLICK")
    @NotNull(message = "interactionType is required")
    private InteractionType interactionType;

    @Schema(description = "Optional category of the post", example = "crypto")
    private String category;

    public UserInteractionRequest() {
    }

    public UserInteractionRequest(Long postId, InteractionType interactionType, String category) {
        this.postId = postId;
        this.interactionType = interactionType;
        this.category = category;
    }

    public Long getPostId() {
        return postId;
    }

    public void setPostId(Long postId) {
        this.postId = postId;
    }

    public InteractionType getInteractionType() {
        return interactionType;
    }

    public void setInteractionType(InteractionType interactionType) {
        this.interactionType = interactionType;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }
}
