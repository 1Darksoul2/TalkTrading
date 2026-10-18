package com.talktrading.explore.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(description = "Paginated Explore response")
public class ExploreResponse {

    @Schema(description = "List of ranked explore posts")
    private List<ExplorePostDto> content;

    @Schema(description = "Current page index (0-based)", example = "0")
    private int page;

    @Schema(description = "Requested page size", example = "20")
    private int size;

    @Schema(description = "Indicates whether more results are available on subsequent pages", example = "true")
    private boolean hasNext;

    public ExploreResponse() {
    }

    public ExploreResponse(List<ExplorePostDto> content, int page, int size, boolean hasNext) {
        this.content = content;
        this.page = page;
        this.size = size;
        this.hasNext = hasNext;
    }

    public List<ExplorePostDto> getContent() {
        return content;
    }

    public void setContent(List<ExplorePostDto> content) {
        this.content = content;
    }

    public int getPage() {
        return page;
    }

    public void setPage(int page) {
        this.page = page;
    }

    public int getSize() {
        return size;
    }

    public void setSize(int size) {
        this.size = size;
    }

    public boolean isHasNext() {
        return hasNext;
    }

    public void setHasNext(boolean hasNext) {
        this.hasNext = hasNext;
    }
}
