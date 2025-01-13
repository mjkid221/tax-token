// SPDX-License-Identifier: UNLICENSED
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.24;
import {IUniswapV2Pair} from "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

/**
 * @title External Account Records
 * @author @mjkid221
 * @notice Contains the addresses of external parties with whom the contract interacts (recipients, uni router, etc.)
 */
abstract contract ExternalAccountRecords {
    address payable public revenueRecipient;
    address public lpTokenRecipient;

    IUniswapV2Router02 public router;
    IUniswapV2Pair public basePair;
}
