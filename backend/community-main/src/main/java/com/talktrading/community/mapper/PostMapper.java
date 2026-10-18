package com.talktrading.community.mapper;

import com.talktrading.community.dto.PostMediaResponse;
import com.talktrading.community.dto.PostResponse;
import com.talktrading.community.entity.Post;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;

@Component
public class PostMapper {

    public PostResponse toResponse(Post post) {
        return toResponse(post, Collections.emptyList());
    }

    public PostResponse toResponse(Post post, List<PostMediaResponse> mediaList) {
        return toResponse(post, mediaList, null, null);
    }

    public PostResponse toResponse(Post post, List<PostMediaResponse> mediaList, Boolean hasLiked, com.talktrading.community.enums.VoteType currentUserVote) {
        if (post == null) {
            return null;
        }

        return PostResponse.builder()
                .id(post.getId())
                .userId(post.getUserId())
                .communityId(post.getCommunityId())
                .postType(post.getPostType())
                .title(post.getTitle())
                .content(post.getContent())
                .symbol(post.getSymbol())
                .entryPrice(post.getEntryPrice())
                .targetPrice(post.getTargetPrice())
                .stopLoss(post.getStopLoss())
                .timeframe(post.getTimeframe())
                .tradeDirection(post.getTradeDirection())
                .likeCount(post.getLikeCount() != null ? post.getLikeCount() : 0L)
                .commentCount(post.getCommentCount() != null ? post.getCommentCount() : 0L)
                .upvoteCount(post.getUpvoteCount() != null ? post.getUpvoteCount() : 0L)
                .downvoteCount(post.getDownvoteCount() != null ? post.getDownvoteCount() : 0L)
                .score(post.getScore() != null ? post.getScore() : 0L)
                .hasLiked(hasLiked)
                .currentUserVote(currentUserVote)
                .media(mediaList != null ? mediaList : Collections.emptyList())
                .createdAt(post.getCreatedAt())
                .updatedAt(post.getUpdatedAt())
                .build();
    }
}
