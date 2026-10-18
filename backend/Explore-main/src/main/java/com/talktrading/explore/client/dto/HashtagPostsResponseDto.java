package com.talktrading.explore.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.ArrayList;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class HashtagPostsResponseDto {

    private String hashtag;
    private List<ExternalPostDto> posts = new ArrayList<>();
    private int total;

    public HashtagPostsResponseDto() {
    }

    public String getHashtag() {
        return hashtag;
    }

    public void setHashtag(String hashtag) {
        this.hashtag = hashtag;
    }

    public List<ExternalPostDto> getPosts() {
        return posts;
    }

    public void setPosts(List<ExternalPostDto> posts) {
        this.posts = posts;
    }

    public int getTotal() {
        return total;
    }

    public void setTotal(int total) {
        this.total = total;
    }
}
