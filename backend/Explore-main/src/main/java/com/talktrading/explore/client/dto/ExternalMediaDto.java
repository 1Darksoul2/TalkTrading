package com.talktrading.explore.client.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ExternalMediaDto {

    private Long id;

    @JsonProperty("media_type")
    private String mediaType;

    // This project's actual Post Service serializes the media URL field as
    // "url", not "file_url" as originally documented/assumed here. @JsonAlias
    // accepts either key so this works against both the documented contract
    // and the real running Post Service without needing a Post Service change.
    @JsonProperty("file_url")
    @JsonAlias({"url"})
    private String fileUrl;

    @JsonProperty("thumbnail_url")
    private String thumbnailUrl;

    public ExternalMediaDto() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getMediaType() {
        return mediaType;
    }

    public void setMediaType(String mediaType) {
        this.mediaType = mediaType;
    }

    public String getFileUrl() {
        return fileUrl;
    }

    public void setFileUrl(String fileUrl) {
        this.fileUrl = fileUrl;
    }

    public String getThumbnailUrl() {
        return thumbnailUrl;
    }

    public void setThumbnailUrl(String thumbnailUrl) {
        this.thumbnailUrl = thumbnailUrl;
    }
}
