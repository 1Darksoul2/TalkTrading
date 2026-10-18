package com.talktrading.community.dto;

import com.talktrading.community.enums.PostType;
import com.talktrading.community.enums.TradeDirection;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PostResponse {

    private Long id;
    private Long userId;
    private Long communityId;
    private PostType postType;
    private String title;
    private String content;

    // Optional Trading Fields
    private String symbol;
    private BigDecimal entryPrice;
    private BigDecimal targetPrice;
    private BigDecimal stopLoss;
    private String timeframe;
    private TradeDirection tradeDirection;

    // Metrics & Counts
    private Long likeCount;
    private Long commentCount;
    private Long upvoteCount;
    private Long downvoteCount;
    private Long score;

    // User Engagement Status
    private Boolean hasLiked;
    private com.talktrading.community.enums.VoteType currentUserVote;

    private java.util.List<PostMediaResponse> media;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
