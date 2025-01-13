// SPDX-License-Identifier: UNLICENSED
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.24;

/**
 * @title Storage
 * @author @mjkid221
 * @notice Contains slot definitions for the token contract's internal mechanisms.
 */
abstract contract Storage {
    // user -> isExempt
    mapping(address account => bool isExempt) public isLimitExempt;
    mapping(address account => bool isExempt) public isFeeExempt;
    mapping(address account => bool isBlacklisted) public isBlacklisted;

    mapping(address pool => bool isEnabled) public isLiquidityPool;

    uint256 public maximumTransactionSize;
    uint256 public maximumWalletSize;
    uint256 public swapThresholdAmount;

    // Packing these into a single slot to save gas (4 x 64 = 256 bits)
    uint64 public revenuePercentage;
    uint64 public liquidityPercentage;
    uint64 public buyFee;
    uint64 public sellFee;

    // Packing these into a single slot to save gas (3 x 64 = 192 bits)
    bool public isTradeFeeEnabled;
    bool public isTransferFeeEnabled;
    bool public isTokenEnabled;
}
