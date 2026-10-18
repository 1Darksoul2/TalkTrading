package com.talktrading.explore.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(description = "Post item displayed in Explore feed")
public class ExplorePostDto {

    @Schema(description = "Unique post identifier", example = "123")
    private String postId;

    @Schema(description = "Author user identifier", example = "456")
    private String authorId;

    @Schema(description = "Post title or headline extracted from caption", example = "Bitcoin market analysis")
    private String title;

    @Schema(description = "Primary media URL if attached", example = "https://cdn.talktrading.com/posts/btc-chart.png")
    private String mediaUrl;

    @Schema(description = "Thumbnail URL for preview", example = "https://cdn.talktrading.com/posts/btc-chart-thumb.png")
    private String thumbnailUrl;

    @Schema(description = "Total likes count", example = "100")
    private int likes;

    @Schema(description = "Total comments count", example = "20")
    private int comments;

    @Schema(description = "Total views count", example = "1000")
    private int views;

    @Schema(description = "Extracted hashtags associated with post", example = "[\"bitcoin\", \"trading\"]")
    private List<String> hashtags;

    @Schema(description = "Calculated relevance and ranking score between 0.0 and 1.0", example = "0.91")
    private double score;

    public ExplorePostDto() {
    }

    public ExplorePostDto(String postId, String authorId, String title, String mediaUrl,
                          String thumbnailUrl, int likes, int comments, int views,
                          List<String> hashtags, double score) {
        this.postId = postId;
        this.authorId = authorId;
        this.title = title;
        this.mediaUrl = mediaUrl;
        this.thumbnailUrl = thumbnailUrl;
        this.likes = likes;
        this.comments = comments;
        this.views = views;
        this.hashtags = hashtags;
        this.score = score;
    }

    public String getPostId() {
        return postId;
    }

    public void setPostId(String postId) {
        this.postId = postId;
    }

    public String getAuthorId() {
        return authorId;
    }

    public void setAuthorId(String authorId) {
        this.authorId = authorId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getMediaUrl() {
        return mediaUrl;
    }

    public void setMediaUrl(String mediaUrl) {
        this.mediaUrl = mediaUrl;
    }

    public String getThumbnailUrl() {
        return thumbnailUrl;
    }

    public void setThumbnailUrl(String thumbnailUrl) {
        this.thumbnailUrl = thumbnailUrl;
    }

    public int getLikes() {
        return likes;
    }

    public void setLikes(int likes) {
        this.likes = likes;
    }

    public int getComments() {
        return comments;
    }

    public void setComments(int comments) {
        this.comments = comments;
    }

    public int getViews() {
        return views;
    }

    public void setViews(int views) {
        this.views = views;
    }

    public List<String> getHashtags() {
        return hashtags;
    }

    public void setHashtags(List<String> hashtags) {
        this.hashtags = hashtags;
    }

    public double getScore() {
        return score;
    }

    public void setScore(double score) {
        this.score = score;
    }
}
