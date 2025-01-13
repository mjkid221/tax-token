import { abi } from "@uniswap/v2-core/build/UniswapV2Factory.json";
import { expect } from "chai";
import { ethers } from "hardhat";

import { Token } from "../types";
import { UNISWAP_V2_FACTORY, WETH_MAINNET } from "./constants/addresses";
import { deployTokenFixture, getContractParams } from "./helpers/utilities";

describe("setLimitExemption", function () {
  let contract: Token;
  beforeEach(async () => {
    const { token } = await deployTokenFixture(await getContractParams({}));
    contract = token;
  });
  it("should fail when called by non-owner account", async () => {
    const [_, alice] = await ethers.getSigners();
    await expect(contract.connect(alice).setLimitExemption(alice.address, true)).to.be.revertedWithCustomError(
      contract,
      "OwnableUnauthorizedAccount",
    );
  });
  it("should set limit exemption to true", async () => {
    const [_, alice] = await ethers.getSigners();
    expect(await contract.isLimitExempt(alice.address)).to.be.false;
    await contract.setLimitExemption(alice.address, true);
    expect(await contract.isLimitExempt(alice.address)).to.be.true;
  });
  it("should set limit exemption to false", async () => {
    const [_, alice] = await ethers.getSigners();
    await contract.setLimitExemption(alice.address, true);
    expect(await contract.isLimitExempt(alice.address)).to.be.true;
    await contract.setLimitExemption(alice.address, false);
    expect(await contract.isLimitExempt(alice.address)).to.be.false;
  });
  it("should fail for the zero address", async () => {
    await expect(contract.setLimitExemption(ethers.ZeroAddress, true)).to.be.revertedWithCustomError(
      contract,
      "ZeroAddress",
    );
  });
});
describe("setFeeExemption", function () {
  let contract: Token;

  beforeEach(async () => {
    const { token } = await deployTokenFixture(await getContractParams({}));
    contract = token;
  });
  it("should fail when called by non-owner account", async () => {
    const [_, alice, bob] = await ethers.getSigners();
    await expect(contract.connect(alice).setFeeExemption(bob.address, true)).to.be.revertedWithCustomError(
      contract,
      "OwnableUnauthorizedAccount",
    );
  });
  it("should set fee exemption to true", async () => {
    const [_, alice] = await ethers.getSigners();
    expect(await contract.isFeeExempt(alice.address)).to.be.false;
    await contract.setFeeExemption(alice.address, true);
    expect(await contract.isFeeExempt(alice.address)).to.be.true;
  });
  it("should set fee exemption to false", async () => {
    const [_, alice] = await ethers.getSigners();
    await contract.setFeeExemption(alice.address, true);
    expect(await contract.isFeeExempt(alice.address)).to.be.true;
    await contract.setFeeExemption(alice.address, false);
    expect(await contract.isFeeExempt(alice.address)).to.be.false;
  });
  it("should fail for the zero address", async () => {
    await expect(contract.setFeeExemption(ethers.ZeroAddress, true)).to.be.revertedWithCustomError(
      contract,
      "ZeroAddress",
    );
  });
});
describe("Blacklist methods", () => {
  let contract: Token;
  beforeEach(async () => {
    const { token } = await deployTokenFixture(await getContractParams({}));
    contract = token;
  });
  it("should fail if called by a non owner account", async () => {
    const [_, alice] = await ethers.getSigners();
    await expect(contract.connect(alice).addToBlacklist([])).to.be.revertedWithCustomError(
      contract,
      "OwnableUnauthorizedAccount",
    );
    await expect(contract.connect(alice).removeFromBlacklist([])).to.be.revertedWithCustomError(
      contract,
      "OwnableUnauthorizedAccount",
    );
  });
  it("should add accounts to the blacklist", async () => {
    const [_, alice] = await ethers.getSigners();
    expect(await contract.isBlacklisted(alice.address)).to.be.false;
    await contract.addToBlacklist([alice.address]);
    expect(await contract.isBlacklisted(alice.address)).to.be.true;
  });
  it("should remove accounts from the blacklist", async () => {
    const [_, alice] = await ethers.getSigners();
    await contract.addToBlacklist([alice.address]);
    expect(await contract.isBlacklisted(alice.address)).to.be.true;
    await contract.removeFromBlacklist([alice.address]);
    expect(await contract.isBlacklisted(alice.address)).to.be.false;
  });
});
describe("setSizeLimits", () => {
  let contract: Token;
  beforeEach(async () => {
    const { token } = await deployTokenFixture(await getContractParams({}));
    contract = token;
  });
  it("should set the new limits", async () => {
    const txLimit = await contract.maximumTransactionSize();
    const walletLimit = await contract.maximumWalletSize();
    const newLimitPercentage = ethers.parseEther("0.5");
    const newLimit = (await contract.totalSupply()) / BigInt(2);
    await contract.setSizeLimits(newLimitPercentage, newLimitPercentage);

    expect(await contract.maximumWalletSize()).to.eq(newLimit);
    expect(await contract.maximumTransactionSize()).to.eq(newLimit);
    expect(await contract.maximumWalletSize()).to.not.eq(txLimit);
    expect(await contract.maximumTransactionSize()).to.not.eq(walletLimit);
  });
  it("should fail if called a non-owner account", async () => {
    const [_, alice] = await ethers.getSigners();
    await expect(
      contract.connect(alice).setSizeLimits(ethers.parseEther("0.5"), ethers.parseEther("0.5")),
    ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
  });
  it("should fail if provided invalid parameters", async () => {
    const invalidPercentage = ethers.parseEther("2");
    const validPercentage = ethers.parseEther("0.5");
    await expect(contract.setSizeLimits(invalidPercentage, invalidPercentage)).to.be.revertedWithCustomError(
      contract,
      "ShareExceedsDenominator",
    );
    await expect(contract.setSizeLimits(validPercentage, invalidPercentage)).to.be.revertedWithCustomError(
      contract,
      "ShareExceedsDenominator",
    );
    await expect(contract.setSizeLimits(0, 0)).to.be.revertedWithCustomError(contract, "InvalidPercentage");
    await expect(contract.setSizeLimits(validPercentage, 0)).to.be.revertedWithCustomError(
      contract,
      "InvalidPercentage",
    );
  });
});
describe("enableToken", () => {
  let contract: Token;
  beforeEach(async () => {
    const { token } = await deployTokenFixture(await getContractParams({}));
    contract = token;
  });
  it("should set isTokenEnabled", async () => {
    expect(await contract.isTokenEnabled()).to.be.false;
    await contract.enableToken();
    expect(await contract.isTokenEnabled()).to.be.true;
  });
  it("should fail if called a non-owner account", async () => {
    const [_, alice] = await ethers.getSigners();
    await expect(contract.connect(alice).enableToken()).to.be.revertedWithCustomError(
      contract,
      "OwnableUnauthorizedAccount",
    );
  });
  it("should fail if trading is already enabled", async () => {
    await contract.enableToken();
    await expect(contract.enableToken()).to.be.revertedWithCustomError(contract, "TokenAlreadyEnabled");
  });
});

describe("Deployment", () => {
  it("should set parameters", async () => {
    const params = await getContractParams({});

    const { token } = await deployTokenFixture(params);

    expect(await token.owner()).to.equal(params._initialOwner);
    expect(await token.lpTokenRecipient()).to.equal(params._lpTokenRecipient);
    expect(await token.revenueRecipient()).to.equal(params._revenueRecipient);
    expect(await token.router()).to.equal(params._uniswapV2Router02);
    expect(await token.name()).to.equal(params._name);
    expect(await token.symbol()).to.equal(params._symbol);
    expect(await token.balanceOf(params._initialOwner)).to.equal(
      ethers.parseUnits(params._maxSupply.toString(), await token.decimals()),
    );
  });
  it("should create a UniswapV2 pool for the token", async () => {
    const params = await getContractParams({});
    const { token, tokenAddress } = await deployTokenFixture(params);

    const factory = new ethers.Contract(
      UNISWAP_V2_FACTORY,
      abi,
      await ethers.getSigner(params._initialOwner.toString()),
    );
    const pairAddress: string = await factory.getPair(tokenAddress, WETH_MAINNET);
    expect(pairAddress).eq(await token.basePair());
  });
});
