// SPDX-License-Identifier: UNLICENSED
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.24;

/**
 * @title IToken Interface
 * @notice Interface for managing token operations, fees, and security features
 */
interface IToken {
    error TokenAlreadyEnabled();
    error ZeroAddress();
    error InvalidBuyFee();
    error InvalidSellFee();
    error ShareExceedsDenominator();
    error BasePairIsImmutable();
    error InvalidThreshold();
    error InvalidPercentage();
    error Blacklisted();
    error TokenDisabled();
    error ExceedsSizeLimit();

    /**
     * @notice Emitted when trade fee status is changed
     * @param status New status of trade fees
     */
    event TradeFeeStatusChange(bool status);

    /**
     * @notice Emitted when transfer fee status is changed
     * @param status New status of transfer fees
     */
    event TransferFeeStatusChange(bool status);

    /**
     * @notice Emitted when buy/sell fees are updated
     * @param newBuyFee New buy fee percentage
     * @param newSellFee New sell fee percentage
     */
    event FeesChanged(uint64 newBuyFee, uint64 newSellFee);

    /**
     * @notice Emitted when fee split ratios are changed
     * @param liquidityShare Percentage allocated to liquidity
     * @param revenueShare Percentage allocated to revenue
     */
    event FeeSplitChanged(uint64 liquidityShare, uint64 revenueShare);

    /**
     * @notice Emitted when a liquidity pool's status is updated
     * @param pool Address of the liquidity pool
     * @param isEnabled New status of the pool
     */
    event LiquidityPoolUpdated(address pool, bool isEnabled);

    /**
     * @notice Emitted when revenue recipient is changed
     * @param recipient New revenue recipient address
     */
    event RevenueRecipientChanged(address recipient);

    /**
     * @notice Emitted when LP token recipient is changed
     * @param recipient New LP token recipient address
     */
    event LpTokenRecipientChanged(address recipient);

    /**
     * @notice Emitted when swap threshold is changed
     * @param threshold New swap threshold value
     */
    event SwapThresholdChanged(uint256 threshold);

    /**
     * @notice Emitted when stuck funds are withdrawn
     * @param to Recipient of the withdrawn funds
     * @param amount Amount withdrawn
     */
    event StuckFundsWithdrawn(address to, uint256 amount);

    /**
     * @notice Emitted when size limits are changed
     * @param transactionSizeLimit New transaction size limit
     * @param walletSizeLimit New wallet size limit
     */
    event SizeLimitsChanged(uint256 transactionSizeLimit, uint256 walletSizeLimit);

    /**
     * @notice Emitted when fee exemption status is updated for an account
     * @param account Address of the account
     * @param isExempt New exemption status
     */
    event FeeExemptionUpdated(address account, bool isExempt);

    /**
     * @notice Emitted when limit exemption status is updated for an account
     * @param account Address of the account
     * @param isExempt New exemption status
     */
    event LimitExemptionUpdated(address account, bool isExempt);

    /**
     * @notice Emitted when accounts are blacklisted
     * @param accounts Array of blacklisted addresses
     */
    event AccountsBlacklisted(address[] accounts);

    /**
     * @notice Emitted when accounts are removed from blacklist
     * @param accounts Array of unblacklisted addresses
     */
    event AccountsUnblacklisted(address[] accounts);

    /**
     * @notice Emitted when token is enabled
     */
    event TokenEnabled();

    /**
     * @notice Emitted when a liquidity swap is executed
     * @param ethRevenue Amount of ETH revenue
     * @param amountTokenAdded Amount of tokens added to liquidity
     * @param amountEthAdded Amount of ETH added to liquidity
     * @param lpTokensGained Amount of LP tokens received
     */
    event LiquiditySwapExecuted(
        uint256 ethRevenue,
        uint256 amountTokenAdded,
        uint256 amountEthAdded,
        uint256 lpTokensGained
    );

    /**
     * @notice Emitted when a fee is taken
     * @param amount Amount of fee taken
     */
    event FeeTaken(uint256 amount);

    /**
     * @notice Enables or disables trade fees
     * @param status New status for trade fees
     */
    function setTradeFeeStatus(bool status) external;

    /**
     * @notice Enables or disables transfer fees
     * @param status New status for transfer fees
     */
    function setTransferFeeStatus(bool status) external;

    /**
     * @notice Sets new buy and sell fees
     * @param newBuyFee New fee percentage for buys
     * @param newSellFee New fee percentage for sells
     */
    function setFees(uint64 newBuyFee, uint64 newSellFee) external;

    /**
     * @notice Sets the split ratio for fees between revenue and liquidity
     * @param revenueShare Percentage allocated to revenue
     */
    function setFeeSplit(uint64 revenueShare) external;

    /**
     * @notice Enables or disables a liquidity pool
     * @param pool Address of the liquidity pool
     * @param isEnabled Whether the pool should be enabled
     */
    function setLiquidityPool(address pool, bool isEnabled) external;

    /**
     * @notice Sets the recipient address for revenue
     * @param to New revenue recipient address
     */
    function setRevenueRecipient(address payable to) external;

    /**
     * @notice Sets the recipient address for LP tokens
     * @param to New LP token recipient address
     */
    function setLpTokenRecipient(address to) external;

    /**
     * @notice Sets the threshold for automatic swaps
     * @param threshold New threshold amount
     */
    function setSwapThreshold(uint256 threshold) external;

    /**
     * @notice Withdraws stuck funds from the contract
     * @param account Recipient address
     * @param percentOfBalance Percentage of balance to withdraw
     */
    function withdrawStuckFunds(address payable account, uint64 percentOfBalance) external;

    /**
     * @notice Sets transaction and wallet size limits
     * @param transactionSizeLimit Maximum transaction size
     * @param walletSizeLimit Maximum wallet size
     */
    function setSizeLimits(uint64 transactionSizeLimit, uint64 walletSizeLimit) external;

    /**
     * @notice Sets fee exemption status for an account
     * @param account Address to update
     * @param isExempt Whether the account should be exempt from fees
     */
    function setFeeExemption(address account, bool isExempt) external;

    /**
     * @notice Sets limit exemption status for an account
     * @param account Address to update
     * @param isExempt Whether the account should be exempt from limits
     */
    function setLimitExemption(address account, bool isExempt) external;

    /**
     * @notice Adds multiple accounts to the blacklist
     * @param accounts Array of addresses to blacklist
     */
    function addToBlacklist(address[] memory accounts) external;

    /**
     * @notice Removes multiple accounts from the blacklist
     * @param accounts Array of addresses to unblacklist
     */
    function removeFromBlacklist(address[] memory accounts) external;

    /**
     * @notice Enables the token for trading
     */
    function enableToken() external;
}
