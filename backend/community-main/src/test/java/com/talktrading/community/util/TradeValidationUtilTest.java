package com.talktrading.community.util;

import com.talktrading.community.enums.TradeDirection;
import com.talktrading.community.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

class TradeValidationUtilTest {

    @Test
    void validBuyTradeSetup_shouldPass() {
        assertDoesNotThrow(() -> TradeValidationUtil.validateTradeSetup(
                TradeDirection.BUY,
                new BigDecimal("25000"),
                new BigDecimal("25200"),
                new BigDecimal("24900")
        ));
    }

    @Test
    void invalidBuyTradeSetup_shouldThrowBadRequestException() {
        // stopLoss > entryPrice
        assertThrows(BadRequestException.class, () -> TradeValidationUtil.validateTradeSetup(
                TradeDirection.BUY,
                new BigDecimal("25000"),
                new BigDecimal("25200"),
                new BigDecimal("25100")
        ));

        // targetPrice < entryPrice
        assertThrows(BadRequestException.class, () -> TradeValidationUtil.validateTradeSetup(
                TradeDirection.BUY,
                new BigDecimal("25000"),
                new BigDecimal("24900"),
                new BigDecimal("24800")
        ));
    }

    @Test
    void validSellTradeSetup_shouldPass() {
        assertDoesNotThrow(() -> TradeValidationUtil.validateTradeSetup(
                TradeDirection.SELL,
                new BigDecimal("25000"),
                new BigDecimal("24800"),
                new BigDecimal("25100")
        ));
    }

    @Test
    void invalidSellTradeSetup_shouldThrowBadRequestException() {
        // targetPrice > entryPrice
        assertThrows(BadRequestException.class, () -> TradeValidationUtil.validateTradeSetup(
                TradeDirection.SELL,
                new BigDecimal("25000"),
                new BigDecimal("25200"),
                new BigDecimal("25300")
        ));

        // stopLoss < entryPrice
        assertThrows(BadRequestException.class, () -> TradeValidationUtil.validateTradeSetup(
                TradeDirection.SELL,
                new BigDecimal("25000"),
                new BigDecimal("24800"),
                new BigDecimal("24900")
        ));
    }
}
