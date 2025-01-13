import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

import { UNISWAP_V2_ROUTER } from "../test/constants/addresses";

task("task:deployToken", "Deploys Token Contract")
  .addParam("owner", "The address of the owner account")
  .addParam("name", "The name of the token")
  .addParam("symbol", "The token symbol")
  .addParam("supply", "The maximum supply of the token, in whole tokens")
  .addParam("revenue", "The address of the revenue account")
  .addParam("lptoken", "The address of the lp token account")
  .addParam("router", "The address of the Uniswap v2 router", UNISWAP_V2_ROUTER)
  .setAction(async function (taskArguments: TaskArguments, { ethers }) {
    const { owner, name, symbol, supply, revenue, lptoken, router } = taskArguments;
    // Check params
    ethers.getAddress(owner);
    ethers.getAddress(revenue);
    ethers.getAddress(lptoken);
    ethers.getAddress(router);

    if (!Number.parseInt(supply)) {
      throw new Error("Invalid max supply");
    }
    if (!name.length) {
      throw new Error("name is missing");
    }
    if (!symbol.length) {
      throw new Error("name is missing");
    }

    // Deploy

    const signers = await ethers.getSigners();

    const factory = await ethers.getContractFactory("Token");
    console.log(`Deploying Token`);
    const token = await factory.connect(signers[0]).deploy(owner, name, symbol, supply, revenue, lptoken, router);
    await token.waitForDeployment();
    console.log("Token deployed to: ", await token.getAddress());
  });
