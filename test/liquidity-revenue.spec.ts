import { expect } from "chai";
import { AddressLike } from "ethers";
import { ethers } from "hardhat";

import { Token } from "../types";
import { ADDRESS_ONE } from "./constants/addresses";
import { deployTokenFixture, getContractParams } from "./helpers/utilities";

describe("setLiquidityPool", () => {
  let contract: Token;
  beforeEach(async () => {
    const { token } = await deployTokenFixture(await getContractParams({}));
    contract = token;
  });
  it("should fail when called by non-owner account", async () => {
    const [_, alice] = await ethers.getSigners();
    await expect(contract.connect(alice).setLiquidityPool(alice.address, true)).to.be.revertedWithCustomError(
      contract,
      "OwnableUnauthorizedAccount",
    );
  });
  it("should fail if given the base pair address", async () => {
    await expect(contract.setLiquidityPool(await contract.basePair(), false)).to.be.revertedWithCustomError(
      contract,
      "BasePairIsImmutable",
    );
  });
  it("should fail if given the zero address", async () => {
    await expect(contract.setLiquidityPool(ethers.ZeroAddress, true)).to.be.revertedWithCustomError(
      contract,
      "ZeroAddress",
    );
  });
  it("should set the address as a liquidity pool", async () => {
    const [_, alice] = await ethers.getSigners();
    expect(await contract.isLiquidityPool(alice.address)).to.be.false;
    await contract.setLiquidityPool(alice.address, true);
    expect(await contract.isLiquidityPool(alice.address)).to.be.true;
    await contract.setLiquidityPool(alice.address, false);
    expect(await contract.isLiquidityPool(alice.address)).to.be.false;
  });
});
describe("setRevenueRecipient", () => {
  let contract: Token;
  beforeEach(async () => {
    const { token } = await deployTokenFixture(await getContractParams({}));
    contract = token;
  });
  it("should fail when called by non-owner account", async () => {
    const [_, alice] = await ethers.getSigners();
    await expect(contract.connect(alice).setRevenueRecipient(alice.address)).to.be.revertedWithCustomError(
      contract,
      "OwnableUnauthorizedAccount",
    );
  });
  it("should fail if given the zero address", async () => {
    await expect(contract.setRevenueRecipient(ethers.ZeroAddress)).to.be.revertedWithCustomError(
      contract,
      "ZeroAddress",
    );
  });
  it("should set the new revenue recipient address", async () => {
    const currentRecipient = await contract.revenueRecipient();
    await contract.setRevenueRecipient(ADDRESS_ONE);
    expect(await contract.revenueRecipient()).to.eq(ADDRESS_ONE);
    expect(await contract.revenueRecipient()).to.not.eq(currentRecipient);
  });
});
describe("setLpTokenRecipient", () => {
  let contract: Token;
  beforeEach(async () => {
    const { token } = await deployTokenFixture(await getContractParams({}));
    contract = token;
  });
  it("should fail when called by non-owner account", async () => {
    const [_, alice] = await ethers.getSigners();
    await expect(contract.connect(alice).setLpTokenRecipient(ADDRESS_ONE)).to.be.revertedWithCustomError(
      contract,
      "OwnableUnauthorizedAccount",
    );
  });
  it("should fail if given the zero address", async () => {
    await expect(contract.setLpTokenRecipient(ethers.ZeroAddress)).to.be.revertedWithCustomError(
      contract,
      "ZeroAddress",
    );
  });
  it("should set the lp token address", async () => {
    const currentRecipient = await contract.lpTokenRecipient();
    await contract.setLpTokenRecipient(ADDRESS_ONE);
    expect(await contract.lpTokenRecipient()).to.eq(ADDRESS_ONE);
    expect(await contract.lpTokenRecipient()).to.not.eq(currentRecipient);
  });
});

describe("setSwapThreshold", () => {
  let contract: Token;
  beforeEach(async () => {
    const { token } = await deployTokenFixture(await getContractParams({}));
    contract = token;
  });
  it("should fail when called by non-owner account", async () => {
    const [_, alice] = await ethers.getSigners();
    await expect(contract.connect(alice).setSwapThreshold(ethers.parseEther("1"))).to.be.revertedWithCustomError(
      contract,
      "OwnableUnauthorizedAccount",
    );
  });
  it("should set the new threshold", async () => {
    const oldThreshold = await contract.swapThresholdAmount();
    const newThreshold = oldThreshold * BigInt(2);
    await contract.setSwapThreshold(newThreshold);
    expect(await contract.swapThresholdAmount()).to.eq(newThreshold);
    expect(await contract.swapThresholdAmount()).to.not.eq(oldThreshold);
  });
  it("should fail if the threshold is zero", async () => {
    await expect(contract.setSwapThreshold(ethers.parseEther("0"))).to.be.revertedWithCustomError(
      contract,
      "InvalidThreshold",
    );
  });
});
describe("withdrawStuckFunds", () => {
  let contract: Token;
  let contractAddress: AddressLike;
  beforeEach(async () => {
    const { token, tokenAddress } = await deployTokenFixture(await getContractParams({}));
    contract = token;
    contractAddress = tokenAddress;
  });
  it("should fail when called by non-owner account", async () => {
    const [_, alice] = await ethers.getSigners();
    await expect(
      contract.connect(alice).withdrawStuckFunds(alice.address, ethers.parseEther("1")),
    ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
  });
  it("should fail if given the zero address", async () => {
    await expect(contract.withdrawStuckFunds(ethers.ZeroAddress, ethers.parseEther("1"))).to.be.revertedWithCustomError(
      contract,
      "ZeroAddress",
    );
  });
  it("should fail if withdraw percentage is zero", async () => {
    await expect(contract.withdrawStuckFunds(ADDRESS_ONE, ethers.parseEther("0"))).to.be.revertedWithCustomError(
      contract,
      "InvalidPercentage",
    );
  });
  it("should fail if withdraw percentage is greater than 100%", async () => {
    await expect(contract.withdrawStuckFunds(ADDRESS_ONE, ethers.parseEther("2"))).to.be.revertedWithCustomError(
      contract,
      "ShareExceedsDenominator",
    );
  });
  it("should withdraw the correct percentages of stuck funds", async () => {
    const [owner] = await ethers.getSigners();
    const value = ethers.parseEther("1");
    expect(await ethers.provider.getBalance(contractAddress)).to.eq(ethers.parseEther("0"));
    await owner.sendTransaction({
      to: contractAddress,
      value,
    });
    expect(await ethers.provider.getBalance(contractAddress)).to.eq(value);

    const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
    const transferAmount = value / BigInt(2);
    const gasPrice = await ethers.provider.getFeeData();
    const tx = await contract.withdrawStuckFunds(owner.address, transferAmount);

    expect(await ethers.provider.getBalance(contractAddress)).to.eq(value / BigInt(2));

    expect(await ethers.provider.getBalance(owner.address)).to.approximately(
      ownerBalanceBefore + transferAmount,
      tx.gasLimit *
        (tx.maxPriorityFeePerGas ||
          BigInt(
            gasPrice.maxPriorityFeePerGas ||
              gasPrice.maxFeePerGas ||
              gasPrice.gasPrice ||
              ethers.parseEther("0.000001"),
          )),
    );
  });
});
