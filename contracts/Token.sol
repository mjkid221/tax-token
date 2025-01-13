// SPDX-License-Identifier: UNLICENSED
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {TransientSlot} from "@openzeppelin/contracts/utils/TransientSlot.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IToken} from "./interface/IToken.sol";
import {Storage} from "./Storage.sol";
import {ExternalAccountRecords} from "./ExternalAccountRecords.sol";
import {ud, intoUint256} from "@prb/math/src/UD60x18.sol";
import {IUniswapV2Pair} from "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import {IUniswapV2Factory} from "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

/**
 * @title ERC20 Token
 * @author @mjkid221
 * @notice A fee-on-transfer token with univ2 integration and revenue sharing mechanism
 */
contract Token is ERC20, Ownable2Step, ERC20Permit, IToken, Storage, ExternalAccountRecords {
    using TransientSlot for *;
    /// Constants
    uint64 public constant DENOMINATOR = 1e18; // 100%
    bytes32 private constant SWAP_GUARD_STORAGE =
        keccak256(abi.encode(uint256(keccak256("transient.storage.swap.guard")) - 1)) & ~bytes32(uint256(0xff));

    /// ## Construction
    constructor(
        address _initialOwner,
        string memory _name,
        string memory _symbol,
        uint256 _maxSupply,
        address payable _revenueRecipient,
        address _lpTokenRecipient,
        address _uniswapV2Router02
    ) ERC20(_name, _symbol) ERC20Permit(_name) Ownable(_initialOwner) {
        /// Set transaction limits
        uint256 maxSupply = _maxSupply * 10 ** decimals();
        uint256 onePercentOfTotalSupply = intoUint256(ud(maxSupply).mul(ud(0.01e18)));
        maximumTransactionSize = onePercentOfTotalSupply;
        maximumWalletSize = onePercentOfTotalSupply;

        isLimitExempt[address(this)] = true;
        isLimitExempt[address(0)] = true;
        isLimitExempt[_initialOwner] = true;
        isLimitExempt[_uniswapV2Router02] = true;

        revenueRecipient = _revenueRecipient;
        lpTokenRecipient = _lpTokenRecipient;

        /// Set fees
        /// @dev for the purposes of percentages, 1e18 is === 100%
        revenuePercentage = 0.60e18; // 60%
        liquidityPercentage = 0.40e18; // 40%
        buyFee = 0.05e18; // 5% fee
        sellFee = 0.05e18; // 5% fee

        swapThresholdAmount = intoUint256(ud(maxSupply).mul(ud(0.0001e18))); // 0.01% of total supply

        _mint(_initialOwner, maxSupply);

        /// Construct the base pair
        _approve(address(this), _uniswapV2Router02, type(uint256).max);

        router = IUniswapV2Router02(_uniswapV2Router02);

        basePair = IUniswapV2Pair(IUniswapV2Factory(router.factory()).createPair(router.WETH(), address(this)));

        isLiquidityPool[address(basePair)] = true;
    }

    /// ## Modifiers

    modifier swapGuard() {
        SWAP_GUARD_STORAGE.asBoolean().tstore(true);
        _;
        SWAP_GUARD_STORAGE.asBoolean().tstore(false);
    }

    /// ## View methods
    function decimals() public view virtual override returns (uint8) {
        return 9;
    }

    /// ## Public methods
    receive() external payable {}

    /// ### Fee management
    function setTransferFeeStatus(bool status) external override onlyOwner {
        isTransferFeeEnabled = status;
        emit TransferFeeStatusChange(status);
    }

    function setTradeFeeStatus(bool status) public override onlyOwner {
        isTradeFeeEnabled = status;
        emit TradeFeeStatusChange(status);
    }

    function setFees(uint64 newBuyFee, uint64 newSellFee) external override onlyOwner {
        if (newBuyFee > DENOMINATOR) {
            revert InvalidBuyFee();
        } else if (newSellFee > DENOMINATOR) {
            revert InvalidSellFee();
        }

        buyFee = newBuyFee;
        sellFee = newSellFee;

        emit FeesChanged(newBuyFee, newSellFee);
    }

    function setFeeSplit(uint64 revenueShare) external override onlyOwner {
        if (revenueShare > DENOMINATOR) {
            revert ShareExceedsDenominator();
        }

        liquidityPercentage = DENOMINATOR - revenueShare;
        revenuePercentage = revenueShare;

        emit FeeSplitChanged(DENOMINATOR - revenueShare, revenueShare);
    }

    /// ### Liquidity & Revenue management
    function setLiquidityPool(address pool, bool isEnabled) external override onlyOwner {
        if (pool == address(0)) {
            revert ZeroAddress();
        } else if (pool == address(basePair)) {
            revert BasePairIsImmutable();
        }
        isLiquidityPool[pool] = isEnabled;
        emit LiquidityPoolUpdated(pool, isEnabled);
    }

    function setRevenueRecipient(address payable recipient) external override onlyOwner {
        if (recipient == address(0)) {
            revert ZeroAddress();
        }
        revenueRecipient = recipient;
        emit RevenueRecipientChanged(recipient);
    }

    function setLpTokenRecipient(address recipient) external override onlyOwner {
        if (recipient == address(0)) {
            revert ZeroAddress();
        }
        lpTokenRecipient = recipient;
        emit LpTokenRecipientChanged(recipient);
    }

    function setSwapThreshold(uint256 threshold) external override onlyOwner {
        if (threshold == 0) {
            revert InvalidThreshold();
        }
        swapThresholdAmount = threshold;
        emit SwapThresholdChanged(threshold);
    }

    function withdrawStuckFunds(address payable account, uint64 percentOfBalance) external override onlyOwner {
        if (percentOfBalance == 0) {
            revert InvalidPercentage();
        } else if (percentOfBalance > DENOMINATOR) {
            revert ShareExceedsDenominator();
        } else if (account == address(0)) {
            revert ZeroAddress();
        }
        uint256 amount = intoUint256(ud(address(this).balance).mul(ud(percentOfBalance)));

        emit StuckFundsWithdrawn(account, amount);

        Address.sendValue(account, amount);
    }

    /// ### General
    function setSizeLimits(uint64 transactionSizeLimit, uint64 walletSizeLimit) external override onlyOwner {
        if (transactionSizeLimit == 0 || walletSizeLimit == 0) {
            revert InvalidPercentage();
        } else if (transactionSizeLimit > DENOMINATOR || walletSizeLimit > DENOMINATOR) {
            revert ShareExceedsDenominator();
        }
        uint256 supply = totalSupply();

        uint256 newTxLimit = intoUint256(ud(supply).mul(ud(transactionSizeLimit)));
        uint256 newWalletLimit = intoUint256(ud(supply).mul(ud(walletSizeLimit)));

        maximumTransactionSize = newTxLimit;
        maximumWalletSize = newWalletLimit;

        emit SizeLimitsChanged(newTxLimit, newWalletLimit);
    }

    function setFeeExemption(address account, bool isExempt) external override onlyOwner {
        if (address(0) == account) {
            revert ZeroAddress();
        }
        isFeeExempt[account] = isExempt;

        emit FeeExemptionUpdated(account, isExempt);
    }

    function setLimitExemption(address account, bool isExempt) external override onlyOwner {
        if (address(0) == account) {
            revert ZeroAddress();
        }
        isLimitExempt[account] = isExempt;

        emit LimitExemptionUpdated(account, isExempt);
    }

    function addToBlacklist(address[] memory accounts) external override onlyOwner {
        for (uint256 i = 0; i < accounts.length; ++i) {
            isBlacklisted[accounts[i]] = true;
        }
        emit AccountsBlacklisted(accounts);
    }

    function removeFromBlacklist(address[] memory accounts) external override onlyOwner {
        for (uint256 i = 0; i < accounts.length; ++i) {
            isBlacklisted[accounts[i]] = false;
        }
        emit AccountsUnblacklisted(accounts);
    }

    function enableToken() external override onlyOwner {
        if (isTokenEnabled) {
            revert TokenAlreadyEnabled();
        }
        isTokenEnabled = true;
        emit TokenEnabled();
    }

    /// ## Internal methods
    /// @dev The Openzepplin recommended procedure for customising transfers is to override the _update method.
    ///      This method is called automatically as part of a transfer/transferFrom method call.
    function _update(address from, address to, uint256 value) internal virtual override {
        if (getIsBlacklisted(from, to)) {
            revert Blacklisted();
        } else if (!getIsTokenEnabled(from, to)) {
            revert TokenDisabled();
        }
        if (getSwapGuardState()) {
            super._update(from, to, value);
        } else {
            if (getExceedsSizeLimits(from, to, value)) {
                revert ExceedsSizeLimit();
            }

            if (shouldTakeFee(from, to)) {
                uint256 transferAmount = value;
                uint256 feeAmount = getFeeAmount(to, transferAmount);
                transferAmount -= feeAmount;

                super._update(from, address(this), feeAmount);
                // Swaps must occur before sending final amount to user, otherwise Uniswap throws an error
                (bool shouldSwap, uint256 tokenBalance) = shouldSwapForEth(from, to);
                if (shouldSwap) {
                    swapForEth(tokenBalance);
                }
                // Send on to caller
                super._update(from, to, transferAmount);

                emit FeeTaken(feeAmount);
            } else {
                super._update(from, to, value);
            }
        }
    }

    function getFeeAmount(address to, uint256 transferAmount) internal view returns (uint256) {
        bool isSelling = isLiquidityPool[to];
        uint64 feePercentage = isSelling ? sellFee : buyFee;

        return intoUint256(ud(transferAmount).mul(ud(feePercentage)));
    }

    function swapForEth(uint256 tokenBalance) internal swapGuard {
        /// 50/50 Token/ETH
        uint256 lpTokenAmount = intoUint256(ud(tokenBalance).mul(ud(liquidityPercentage)).mul(ud(0.5e18)));

        // This is LP eth from the last swap, and should not be sent as revenue
        uint256 ethBalanceBefore = address(this).balance;

        /// Perform swap for eth
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = router.WETH();

        router.swapExactTokensForETH(tokenBalance - lpTokenAmount, 0, path, address(this), block.timestamp);

        uint256 revenueEthAmount = intoUint256(ud(address(this).balance - ethBalanceBefore).mul(ud(revenuePercentage)));

        /// Add to LP

        (uint256 amountTokenAdded, uint256 amountEthAdded, uint256 liquidity) = router.addLiquidityETH{
            value: address(this).balance - revenueEthAmount
        }(address(this), lpTokenAmount, 0, 0, lpTokenRecipient, block.timestamp);

        emit LiquiditySwapExecuted(revenueEthAmount, amountTokenAdded, amountEthAdded, liquidity);
        /// Send revenue share to recipient
        Address.sendValue(revenueRecipient, revenueEthAmount);
    }

    function shouldTakeFee(address from, address to) internal view returns (bool) {
        if (isFeeExempt[from] || isFeeExempt[to]) {
            return false;
        }

        if (isTradeFeeEnabled && (isLiquidityPool[from] || isLiquidityPool[to])) {
            return true;
        }
        if (isTransferFeeEnabled) {
            return true;
        }
        return false;
    }

    function shouldSwapForEth(address from, address to) internal view returns (bool shouldSwap, uint256 tokenBalance) {
        tokenBalance = balanceOf(address(this));
        shouldSwap = !isLiquidityPool[from] && isLiquidityPool[to] && tokenBalance >= swapThresholdAmount;
    }

    function getExceedsSizeLimits(address from, address to, uint256 amount) internal view returns (bool status) {
        if (isLimitExempt[from] || isLimitExempt[to]) {
            return false;
        }
        if (amount > maximumTransactionSize || (balanceOf(to) + amount) > maximumWalletSize) {
            return true;
        }
    }

    function getSwapGuardState() internal view returns (bool) {
        return SWAP_GUARD_STORAGE.asBoolean().tload();
    }

    function getIsBlacklisted(address from, address to) internal view returns (bool) {
        address owner = owner();
        if (to == owner) {
            return false;
        }
        return isBlacklisted[from] || isBlacklisted[to];
    }

    function getIsTokenEnabled(address from, address to) internal view returns (bool) {
        address owner = owner();
        bool isEnabled = isTokenEnabled;
        if (!isEnabled && (from == owner || to == owner || isLiquidityPool[to])) {
            return true;
        }
        return isEnabled;
    }
}
