package com.talktrading.community.dto;

import com.talktrading.community.enums.PostType;
import com.talktrading.community.enums.TradeDirection;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreatePostRequest {

    @NotNull(message = "Post type is required")
    private PostType postType;

    @NotBlank(message = "Title cannot be empty")
    @Size(max = 255, message = "Title must not exceed 255 characters")
    private String title;

    private String content;

    private Long communityId;

    @Size(max = 20, message = "Symbol must not exceed 20 characters")
    private String symbol;

    private BigDecimal entryPrice;

    private BigDecimal targetPrice;

    private BigDecimal stopLoss;

    @Size(max = 20, message = "Timeframe must not exceed 20 characters")
    private String timeframe;

    private TradeDirection tradeDirection;
}
