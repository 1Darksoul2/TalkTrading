package com.talktrading.community.dto;

import com.talktrading.community.enums.VoteType;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VoteRequest {

    @NotNull(message = "Vote type is required (UPVOTE or DOWNVOTE)")
    private VoteType voteType;
}
