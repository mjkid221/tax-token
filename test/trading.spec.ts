import { expect } from "chai";
import { ethers } from "hardhat";

import { IERC20, Token } from "../types";
import {
  deployTokenFixture,
  executeEthForTokenTrade,
  executeSingleTradeCycle,
  executeTokenForEthTrade,
  getContractParams,
  prepareAccountsForTrading,
  seedUniswapPool,
} from "./helpers/utilities";

describe("Blacklist support", () => {
  let contract: Token;
  beforeEach(async () => {
    const { token } = await deployTokenFixture(await getContractParams({}));
    contract = token;
    await prepareAccountsForTrading(token);
  });

  it("should block blacklisted accounts from interacting", async () => {
    const [_, bob, carol] = await ethers.getSigners();
    const balanceBefore = await contract.balanceOf(bob.address);

    await contract.addToBlacklist([bob.address]);
    const amount = balanceBefore / BigInt(2);
    await expect(contract.connect(bob).transfer(carol.address, amount)).to.revertedWithCustomError(
      contract,
      "Blacklisted",
    );
    expect(await contract.balanceOf(bob.address)).to.eq(balanceBefore);
  });
  it("should allow non blacklisted accounts", async () => {
    const [_, bob] = await ethers.getSigners();
    const balanceBefore = await contract.balanceOf(bob.address);
    expect(balanceBefore).to.gt(1);
    const amount = balanceBefore / BigInt(2);
    await contract.transfer(bob.address, amount);
    expect(await contract.balanceOf(bob.address)).to.eq(balanceBefore + amount);
  });
  it("should allow the owner account to recieve tokens even if the sender is blacklisted", async () => {
    const [alice, bob] = await ethers.getSigners();
    let balanceBefore = await contract.balanceOf(bob.address);

    const amount = balanceBefore / BigInt(3);
    await contract.transfer(bob.address, amount);
    await contract.addToBlacklist([bob.address]);
    expect(await contract.balanceOf(bob.address)).to.eq(balanceBefore + amount);
    balanceBefore = await contract.balanceOf(alice.address);
    await contract.connect(bob).transfer(alice.address, amount);
    expect(await contract.balanceOf(alice.address)).to.eq(balanceBefore + amount);
  });
});

describe("Token enabled switch", () => {
  let contract: Token;
  beforeEach(async () => {
    const { token } = await deployTokenFixture(await getContractParams({}));
    contract = token;
  });
  it("should allow the owner to transfer even if the token is disabled", async () => {
    const [_, bob] = await ethers.getSigners();
    expect(await contract.isTokenEnabled()).to.be.false;
    const balanceBefore = await contract.balanceOf(bob.address);
    const amount = balanceBefore / BigInt(2);
    await contract.transfer(bob.address, amount);
    expect(await contract.balanceOf(bob.address)).to.eq(balanceBefore + amount);
  });
  it("should prevent transfers if the token is disabled", async () => {
    const [_, bob, carol] = await ethers.getSigners();
    expect(await contract.isTokenEnabled()).to.be.false;
    const balanceBefore = await contract.balanceOf(bob.address);
    const amount = balanceBefore / BigInt(2);
    await contract.transfer(bob.address, amount);
    await expect(contract.connect(bob).transfer(carol.address, amount)).to.revertedWithCustomError(
      contract,
      "TokenDisabled",
    );
  });
  it("should allow transfers if the token is enabled", async () => {
    const [_, bob, carol] = await ethers.getSigners();
    await prepareAccountsForTrading(contract);
    const balanceBeforeBob = await contract.balanceOf(bob.address);
    const balanceBeforeCarol = await contract.balanceOf(carol.address);
    const amount = balanceBeforeBob / BigInt(2);
    await contract.connect(bob).transfer(carol.address, amount);
    expect(await contract.balanceOf(carol.address)).to.eq(balanceBeforeCarol + amount);
    expect(await contract.balanceOf(bob.address)).to.eq(balanceBeforeBob - amount);
  });
});
describe("Size limits", () => {
  let contract: Token;
  beforeEach(async () => {
    const { token } = await deployTokenFixture(await getContractParams({}));
    contract = token;
    await contract.enableToken();
  });
  it("should prevent trades that exceed the transaction size limit", async () => {
    const [owner, alice, bob] = await ethers.getSigners();

    await contract.transfer(alice.address, await contract.balanceOf(owner.address));

    await expect(
      contract.connect(alice).transfer(bob.address, await contract.balanceOf(alice.address)),
    ).to.revertedWithCustomError(contract, "ExceedsSizeLimit");
  });
  it("should prevent trades that exceed the wallet size limit", async () => {
    const [_, alice, bob] = await ethers.getSigners();

    await contract.transfer(alice.address, await contract.maximumWalletSize());
    await contract.transfer(bob.address, 5);

    await expect(
      contract.connect(bob).transfer(alice.address, await contract.balanceOf(bob.address)),
    ).to.revertedWithCustomError(contract, "ExceedsSizeLimit");
  });
  it("should not enforce size limits for limit exempt accounts", async () => {
    const [owner, alice, bob] = await ethers.getSigners();
    await contract.setLimitExemption(alice.address, true);
    await contract.setLimitExemption(bob.address, true);

    await contract.transfer(alice.address, await contract.balanceOf(owner.address));
    const amount = await contract.balanceOf(alice.address);
    const balanceBeforeBob = await contract.balanceOf(bob.address);
    await contract.connect(alice).transfer(bob.address, await contract.balanceOf(alice.address));
    expect(await contract.balanceOf(alice.address)).to.eq(0);
    expect(await contract.balanceOf(bob.address)).to.eq(balanceBeforeBob + amount);
    expect(amount).to.gt(await contract.maximumTransactionSize());
    expect(amount).to.gt(await contract.maximumWalletSize());
  });
});
describe("Fees", () => {
  let contract: Token;
  beforeEach(async () => {
    const { token } = await deployTokenFixture(await getContractParams({}));
    contract = token;
    await prepareAccountsForTrading(token);
    await seedUniswapPool(token);
  });
  it("should take a trade fee if enabled", async () => {
    await contract.setTradeFeeStatus(true);
    await contract.setSwapThreshold(ethers.MaxUint256);

    const tokenAddress = await contract.getAddress();
    const balanceBefore = await contract.balanceOf(tokenAddress);

    const [alice, bob] = await ethers.getSigners();
    for (let i = 0; i < 10; i++) {
      await executeSingleTradeCycle(contract, alice);
      await executeSingleTradeCycle(contract, bob);
    }
    expect(await contract.balanceOf(tokenAddress)).to.be.gt(balanceBefore);
  });
  it("should not take a trade fee if disabled", async () => {
    await contract.setTradeFeeStatus(false);
    await contract.setSwapThreshold(ethers.MaxUint256);

    const tokenAddress = await contract.getAddress();
    const balanceBefore = await contract.balanceOf(tokenAddress);

    const [alice, bob] = await ethers.getSigners();
    for (let i = 0; i < 10; i++) {
      await executeSingleTradeCycle(contract, alice);
      await executeSingleTradeCycle(contract, bob);
    }
    expect(await contract.balanceOf(tokenAddress)).to.be.eq(balanceBefore);
  });
  it("should not take any fees if there is a fee exemption", async () => {
    const [alice, bob] = await ethers.getSigners();
    await contract.setTradeFeeStatus(true);
    await contract.setTransferFeeStatus(true);
    await contract.setSwapThreshold(ethers.MaxUint256);
    await contract.setFeeExemption(alice.address, true);
    await contract.setFeeExemption(bob.address, true);

    const tokenAddress = await contract.getAddress();
    const balanceBefore = await contract.balanceOf(tokenAddress);

    for (let i = 0; i < 10; i++) {
      await executeSingleTradeCycle(contract, alice);
      await executeSingleTradeCycle(contract, bob);
    }
    expect(await contract.balanceOf(tokenAddress)).to.be.eq(balanceBefore);
  });
  it("should take a transfer fee if enabled", async () => {
    const [alice, bob] = await ethers.getSigners();
    await contract.setTradeFeeStatus(false);
    await contract.setTransferFeeStatus(true);
    await contract.setSwapThreshold(ethers.MaxUint256);

    const tokenAddress = await contract.getAddress();
    const balanceBefore = await contract.balanceOf(tokenAddress);

    for (let i = 0; i < 5; i++) {
      await contract.transfer(bob.address, await contract.maximumTransactionSize());
      await contract.connect(bob).transfer(alice.address, await contract.maximumTransactionSize());
    }
    expect(await contract.balanceOf(tokenAddress)).to.be.gt(balanceBefore);
  });
  it("should not take a transfer fee if disabled", async () => {
    const [alice, bob] = await ethers.getSigners();
    await contract.setTradeFeeStatus(false);
    await contract.setTransferFeeStatus(false);
    await contract.setSwapThreshold(ethers.MaxUint256);

    const tokenAddress = await contract.getAddress();
    const balanceBefore = await contract.balanceOf(tokenAddress);

    for (let i = 0; i < 5; i++) {
      await contract.transfer(bob.address, await contract.maximumTransactionSize());
      await contract.connect(bob).transfer(alice.address, await contract.maximumTransactionSize());
    }
    expect(await contract.balanceOf(tokenAddress)).to.be.eq(balanceBefore);
  });
});
describe("Liquidity mechanism", () => {
  let contract: Token;

  beforeEach(async () => {
    const { token } = await deployTokenFixture(await getContractParams({}));
    contract = token;

    await seedUniswapPool(token);
    await prepareAccountsForTrading(token);

    await contract.setTradeFeeStatus(true);
  });
  it("should add liquidity to the base pair once the swap threshold is met", async () => {
    const [alice, bob] = await ethers.getSigners();
    const lpToken = new ethers.Contract(
      await contract.basePair(),
      [
        {
          constant: true,
          inputs: [
            {
              internalType: "address",
              name: "",
              type: "address",
            },
          ],
          name: "balanceOf",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          payable: false,
          stateMutability: "view",
          type: "function",
        },
      ],
      alice,
    ) as unknown as IERC20;
    const balanceBefore = await lpToken.balanceOf(await contract.lpTokenRecipient());

    for (let i = 0; i < 20; i++) {
      await prepareAccountsForTrading(contract);

      await executeTokenForEthTrade(contract, alice);
      await executeEthForTokenTrade(contract, alice);
      await executeTokenForEthTrade(contract, bob);
      await executeEthForTokenTrade(contract, bob);
    }

    expect(await lpToken.balanceOf(await contract.lpTokenRecipient())).to.be.gt(balanceBefore);
  });
  it("should send eth revenue to revenue recipient when swapping", async () => {
    const balanceBefore = await ethers.provider.getBalance(await contract.revenueRecipient());
    const [alice, bob] = await ethers.getSigners();

    for (let i = 0; i < 20; i++) {
      await prepareAccountsForTrading(contract);

      await executeTokenForEthTrade(contract, alice);
      await executeEthForTokenTrade(contract, alice);
      await executeTokenForEthTrade(contract, bob);
      await executeEthForTokenTrade(contract, bob);
    }

    expect(await ethers.provider.getBalance(await contract.revenueRecipient())).to.be.gt(balanceBefore);
  });
});
