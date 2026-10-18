package com.talktrading.explore.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ExternalPostDto {

    private static final Pattern HASHTAG_PATTERN = Pattern.compile("#(\\w+)");

    private Long id;

    @JsonProperty("author_id")
    private Long authorId;

    private String caption;
    private String title;

    private String visibility;
    private String status;

    @JsonProperty("like_count")
    private int likeCount;

    @JsonProperty("comment_count")
    private int commentCount;

    @JsonProperty("save_count")
    private int saveCount;

    @JsonProperty("share_count")
    private int shareCount;

    @JsonProperty("view_count")
    private Integer viewCount;

    @JsonProperty("created_at")
    @JsonDeserialize(using = LenientInstantDeserializer.class)
    private Instant createdAt;

    @JsonProperty("updated_at")
    @JsonDeserialize(using = LenientInstantDeserializer.class)
    private Instant updatedAt;

    /**
     * This project's Post Service returns timestamps without a timezone
     * (e.g. "2026-09-29T16:09:39"), which Instant's default parser rejects.
     * A value with no zone is interpreted as UTC.
     */
    public static class LenientInstantDeserializer extends JsonDeserializer<Instant> {
        @Override
        public Instant deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
            String text = p.getValueAsString();
            if (text == null || text.isBlank()) {
                return null;
            }
            try {
                return Instant.parse(text);
            } catch (DateTimeParseException ignored) {
                return LocalDateTime.parse(text).toInstant(ZoneOffset.UTC);
            }
        }
    }

    @JsonProperty("media_items")
    private List<ExternalMediaDto> mediaItems = new ArrayList<>();

    @JsonProperty("hashtags")
    private List<String> explicitHashtags;

    public ExternalPostDto() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getAuthorId() {
        return authorId;
    }

    public void setAuthorId(Long authorId) {
        this.authorId = authorId;
    }

    public String getCaption() {
        return caption;
    }

    public void setCaption(String caption) {
        this.caption = caption;
    }

    public String getTitle() {
        if (title != null && !title.isBlank()) {
            return title;
        }
        if (caption != null && !caption.isBlank()) {
            String firstLine = caption.split("\\R")[0].trim();
            // strip hashtags from title if clean title is preferred
            String clean = firstLine.replaceAll("#\\w+", "").trim();
            return clean.isEmpty() ? firstLine : clean;
        }
        return "Untitled Post";
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getVisibility() {
        return visibility;
    }

    public void setVisibility(String visibility) {
        this.visibility = visibility;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public int getLikeCount() {
        return likeCount;
    }

    public void setLikeCount(int likeCount) {
        this.likeCount = likeCount;
    }

    public int getCommentCount() {
        return commentCount;
    }

    public void setCommentCount(int commentCount) {
        this.commentCount = commentCount;
    }

    public int getSaveCount() {
        return saveCount;
    }

    public void setSaveCount(int saveCount) {
        this.saveCount = saveCount;
    }

    public int getShareCount() {
        return shareCount;
    }

    public void setShareCount(int shareCount) {
        this.shareCount = shareCount;
    }

    public int getViewCount() {
        if (viewCount != null && viewCount > 0) {
            return viewCount;
        }
        // Organic estimated view count when post service doesn't store explicit impressions
        return Math.max(10, (likeCount * 8) + (commentCount * 15) + (shareCount * 25));
    }

    public void setViewCount(Integer viewCount) {
        this.viewCount = viewCount;
    }

    public Instant getCreatedAt() {
        return createdAt != null ? createdAt : Instant.now();
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public List<ExternalMediaDto> getMediaItems() {
        return mediaItems;
    }

    public void setMediaItems(List<ExternalMediaDto> mediaItems) {
        this.mediaItems = mediaItems;
    }

    public List<String> getHashtags() {
        if (explicitHashtags != null && !explicitHashtags.isEmpty()) {
            return explicitHashtags;
        }
        List<String> tags = new ArrayList<>();
        if (caption != null) {
            Matcher matcher = HASHTAG_PATTERN.matcher(caption);
            while (matcher.find()) {
                tags.add(matcher.group(1).toLowerCase());
            }
        }
        return tags;
    }

    public void setHashtags(List<String> explicitHashtags) {
        this.explicitHashtags = explicitHashtags;
    }

    public String getPrimaryMediaUrl() {
        if (mediaItems != null && !mediaItems.isEmpty()) {
            return mediaItems.get(0).getFileUrl();
        }
        return null;
    }

    public String getPrimaryThumbnailUrl() {
        if (mediaItems != null && !mediaItems.isEmpty()) {
            String thumb = mediaItems.get(0).getThumbnailUrl();
            return thumb != null ? thumb : mediaItems.get(0).getFileUrl();
        }
        return null;
    }
}
