import { expect } from "chai";
import { ethers } from "hardhat";

import { Token } from "../types";
import { deployTokenFixture, getContractParams } from "./helpers/utilities";

describe("setTradeFee", () => {
  let contract: Token;
  beforeEach(async () => {
    const { token } = await deployTokenFixture(await getContractParams({}));
    contract = token;
  });
  it("should fail when called by non-owner account", async () => {
    const [_, alice] = await ethers.getSigners();
    await expect(contract.connect(alice).setTradeFeeStatus(false)).to.be.revertedWithCustomError(
      contract,
      "OwnableUnauthorizedAccount",
    );
  });
  it("should set the trade fee", async () => {
    expect(await contract.isTradeFeeEnabled()).to.be.false;
    await contract.setTradeFeeStatus(true);
    expect(await contract.isTradeFeeEnabled()).to.be.true;
  });
});
describe("setTransferFee", () => {
  let contract: Token;
  beforeEach(async () => {
    const { token } = await deployTokenFixture(await getContractParams({}));
    contract = token;
  });
  it("should fail when called by non-owner account", async () => {
    const [_, alice] = await ethers.getSigners();
    await expect(contract.connect(alice).setTransferFeeStatus(false)).to.be.revertedWithCustomError(
      contract,
      "OwnableUnauthorizedAccount",
    );
  });
  it("should set the transfer fee ", async () => {
    expect(await contract.isTransferFeeEnabled()).to.be.false;
    await contract.setTransferFeeStatus(true);
    expect(await contract.isTransferFeeEnabled()).to.be.true;
  });
});
describe("setFees", () => {
  let contract: Token;
  beforeEach(async () => {
    const { token } = await deployTokenFixture(await getContractParams({}));
    contract = token;
  });
  it("should fail when called by non-owner account", async () => {
    const [_, alice] = await ethers.getSigners();
    await expect(contract.connect(alice).setFees(0, 0)).to.be.revertedWithCustomError(
      contract,
      "OwnableUnauthorizedAccount",
    );
  });
  it("should fail if percentage is invalid", async () => {
    await expect(contract.setFees(ethers.parseEther("1.1"), 0)).to.be.revertedWithCustomError(
      contract,
      "InvalidBuyFee",
    );
    await expect(contract.setFees(0, ethers.parseEther("1.1"))).to.be.revertedWithCustomError(
      contract,
      "InvalidSellFee",
    );
  });
  it("should set new set of fees", async () => {
    const buyFee = await contract.buyFee();
    const sellFee = await contract.sellFee();
    expect(buyFee).to.gt(0);
    expect(sellFee).to.gt(0);
    const newFee = ethers.parseEther("0.15");
    await contract.setFees(newFee, newFee);
    expect(await contract.buyFee()).to.not.eq(buyFee);
    expect(await contract.buyFee()).to.eq(newFee);
    expect(await contract.sellFee()).to.not.eq(sellFee);
    expect(await contract.sellFee()).to.eq(newFee);
  });
});
describe("setFeeSplit", () => {
  let contract: Token;
  beforeEach(async () => {
    const { token } = await deployTokenFixture(await getContractParams({}));
    contract = token;
  });
  it("should fail if new fee split is invalid", async () => {
    await expect(contract.setFeeSplit(ethers.parseEther("1.1"))).to.be.revertedWithCustomError(
      contract,
      "ShareExceedsDenominator",
    );
  });
  it("should fail when called by non-owner account", async () => {
    const [_, alice] = await ethers.getSigners();
    await expect(contract.connect(alice).setFeeSplit(ethers.parseEther("0.25"))).to.be.revertedWithCustomError(
      contract,
      "OwnableUnauthorizedAccount",
    );
  });
  it("should set new fee split between liquidity and revenue", async () => {
    const revenueShare = await contract.revenuePercentage();
    const liquidityShare = await contract.liquidityPercentage();
    expect(revenueShare).to.gt(0);
    expect(liquidityShare).to.gt(0);

    const newSplit = ethers.parseEther("0.25");
    await contract.setFeeSplit(newSplit);
    expect(await contract.revenuePercentage()).to.not.eq(revenueShare);
    expect(await contract.revenuePercentage()).to.eq(newSplit);
    expect(await contract.liquidityPercentage()).to.not.eq(liquidityShare);
    expect(await contract.liquidityPercentage()).to.eq(ethers.parseEther("1") - newSplit);
  });
});
