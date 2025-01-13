import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { abi as routerAbi } from "@uniswap/v2-periphery/build/IUniswapV2Router02.json";
import { AddressLike, BigNumberish } from "ethers";
import { ethers } from "hardhat";

import { Token, Token__factory } from "../../types";
import { IUniswapV2Router02 } from "../../types/@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02";
import { UNISWAP_V2_ROUTER, WETH_MAINNET } from "../constants/addresses";

export interface ContractParams {
  _initialOwner: AddressLike;
  _name: string;
  _symbol: string;
  _maxSupply: BigNumberish;
  _revenueRecipient: AddressLike;
  _lpTokenRecipient: AddressLike;
  _uniswapV2Router02: AddressLike;
}
export const deployTokenFixture = async ({
  _initialOwner,
  _name,
  _symbol,
  _maxSupply,
  _revenueRecipient,
  _lpTokenRecipient,
  _uniswapV2Router02,
}: ContractParams) => {
  const TokenFactory = (await ethers.getContractFactory("Token")) as Token__factory;

  const token = (await TokenFactory.deploy(
    _initialOwner,
    _name,
    _symbol,
    _maxSupply,
    _revenueRecipient,
    _lpTokenRecipient,
    _uniswapV2Router02,
  )) as Token;

  const tokenAddress = await token.getAddress();

  return { token, tokenAddress };
};

export const getContractParams = async ({
  owner,
  revenueRecipient,
  lpTokenRecipient,
}: {
  owner?: AddressLike;
  revenueRecipient?: AddressLike;
  lpTokenRecipient?: AddressLike;
}) => {
  const [alice, , , , carol, dave] = await ethers.getSigners();
  return {
    _initialOwner: owner || alice.address,
    _lpTokenRecipient: lpTokenRecipient || dave.address,
    _maxSupply: 100,
    _name: "TEST TOKEN",
    _symbol: "TEST",
    _revenueRecipient: revenueRecipient || carol.address,
    _uniswapV2Router02: UNISWAP_V2_ROUTER,
  };
};

const getUniswapRouter = (signer: HardhatEthersSigner) => {
  return new ethers.Contract(UNISWAP_V2_ROUTER, routerAbi, signer) as unknown as IUniswapV2Router02;
};
const getDeadline = () => {
  return Math.floor(1735522007) * 2;
};
export const seedUniswapPool = async (token: Token) => {
  const [alice] = await ethers.getSigners();
  await token.approve(UNISWAP_V2_ROUTER, ethers.MaxUint256);
  const tokenSeedAmount = (await token.balanceOf(alice.address)) / BigInt(2);
  const router = getUniswapRouter(alice);

  await router.addLiquidityETH(await token.getAddress(), tokenSeedAmount, 0, 0, alice.address, getDeadline(), {
    value: tokenSeedAmount,
  });
};
export const prepareAccountsForTrading = async (token: Token) => {
  const [alice, bob] = await ethers.getSigners();

  if (!(await token.isTokenEnabled())) {
    await token.enableToken();
    await token.connect(bob).approve(UNISWAP_V2_ROUTER, ethers.MaxUint256);
    await token.setLimitExemption(bob.address, true);
  }

  await token.connect(bob).transfer(alice.address, await token.balanceOf(bob.address));
  await token.transfer(bob.address, (await token.balanceOf(alice.address)) / BigInt(2));
};

export const executeSingleTradeCycle = async (token: Token, signer: HardhatEthersSigner) => {
  await executeTokenForEthTrade(token, signer);
  await executeEthForTokenTrade(token, signer);
};

export const executeTokenForEthTrade = async (token: Token, signer: HardhatEthersSigner) => {
  const tokenAddress = await token.getAddress();

  const router = getUniswapRouter(signer);

  await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
    ethers.parseUnits("1", await token.decimals()),
    0,
    [tokenAddress, WETH_MAINNET],
    signer.address,
    getDeadline(),
  );
};

export const executeEthForTokenTrade = async (token: Token, signer: HardhatEthersSigner) => {
  const tokenAddress = await token.getAddress();

  const router = getUniswapRouter(signer);

  await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
    0,
    [WETH_MAINNET, tokenAddress],
    signer.address,
    getDeadline(),
    { value: ethers.parseUnits("1", 9) },
  );
};
