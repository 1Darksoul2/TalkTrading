package com.talktrading.community.dto;

import com.talktrading.community.enums.VoteType;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VoteResponse {

    private Long postId;
    private Long upvoteCount;
    private Long downvoteCount;
    private Long score;
    private VoteType currentUserVote;
}
