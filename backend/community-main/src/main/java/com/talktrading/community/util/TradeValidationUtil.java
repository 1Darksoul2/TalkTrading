package com.talktrading.community.util;

import com.talktrading.community.enums.TradeDirection;
import com.talktrading.community.exception.BadRequestException;

import java.math.BigDecimal;

public class TradeValidationUtil {

    /**
     * Validates trade idea setup pricing according to direction:
     * BUY:  stopLoss < entryPrice < targetPrice
     * SELL: targetPrice < entryPrice < stopLoss
     */
    public static void validateTradeSetup(TradeDirection direction, BigDecimal entryPrice, BigDecimal targetPrice, BigDecimal stopLoss) {
        if (direction == null || entryPrice == null || targetPrice == null || stopLoss == null) {
            throw new BadRequestException("Trade idea requires tradeDirection, entryPrice, targetPrice, and stopLoss");
        }

        if (entryPrice.compareTo(BigDecimal.ZERO) <= 0 || targetPrice.compareTo(BigDecimal.ZERO) <= 0 || stopLoss.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("Prices must be positive numbers");
        }

        if (direction == TradeDirection.BUY) {
            if (!(stopLoss.compareTo(entryPrice) < 0 && entryPrice.compareTo(targetPrice) < 0)) {
                throw new BadRequestException("For BUY trade setup, stopLoss must be less than entryPrice, and entryPrice must be less than targetPrice (stopLoss < entryPrice < targetPrice)");
            }
        } else if (direction == TradeDirection.SELL) {
            if (!(targetPrice.compareTo(entryPrice) < 0 && entryPrice.compareTo(stopLoss) < 0)) {
                throw new BadRequestException("For SELL trade setup, targetPrice must be less than entryPrice, and entryPrice must be less than stopLoss (targetPrice < entryPrice < stopLoss)");
            }
        }
    }
}
