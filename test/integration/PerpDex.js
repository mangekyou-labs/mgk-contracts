const { expect } = require("chai");
const { ethers } = require("hardhat");
const { expandDecimals, increaseTime, mineBlock } = require("../shared/utilities");
const { toUsd } = require("../shared/units");
const { toChainlinkPrice } = require("../shared/chainlink");

describe("MGK Perp Integration Test", function () {
    let vault, vaultPriceFeed, usdg, router, glp, glpManager, positionRouter;
    let link, shortsTracker;
    let deployer;

    // Contract addresses
    const VAULT_ADDRESS = "0x2D641633FE39fAc1E79085dCAF91244EcBBda809";
    const USDG_ADDRESS = "0xCdd92f8983b4c0F9588DcEE98434B4f8F62ED2ef";
    const ROUTER_ADDRESS = "0x10B0628681e63a9610fec17f08A3aaE9cd1Edf3e";
    const VAULT_PRICE_FEED_ADDRESS = "0x50938434Ea67f71b2B34B02F7E73e9a946B3DE70";
    const GLP_ADDRESS = "0x72fa2d4Ac18741787740AAE3DEfEb2911B2627b3";
    const GLP_MANAGER_ADDRESS = "0x9FDC5ACeBb6684EB4EfE19a36b6377CbD12175F4";
    const POSITION_ROUTER_ADDRESS = "0x863ee39c49A3AbadA8e903FF6ea6A1bFc3854A84";
    const SHORTS_TRACKER_ADDRESS = "0xEbB9F472C853675678e797D06D33682df8b167c8";
    const LINK_ADDRESS = "0x90a386d59b9a6a4795a011e8f032fc21ed6fefb6";

    before(async function () {
        [deployer] = await ethers.getSigners();
        console.log("Deployer address:", deployer.address);

        // Connect to existing contracts
        vault = await ethers.getContractAt("Vault", VAULT_ADDRESS);
        usdg = await ethers.getContractAt("USDG", USDG_ADDRESS);
        router = await ethers.getContractAt("Router", ROUTER_ADDRESS);
        vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", VAULT_PRICE_FEED_ADDRESS);
        glp = await ethers.getContractAt("GLP", GLP_ADDRESS);
        glpManager = await ethers.getContractAt("GlpManager", GLP_MANAGER_ADDRESS);
        positionRouter = await ethers.getContractAt("PositionRouter", POSITION_ROUTER_ADDRESS);
        shortsTracker = await ethers.getContractAt("ShortsTracker", SHORTS_TRACKER_ADDRESS);
        link = await ethers.getContractAt("Token", LINK_ADDRESS);

        // Check contract states
        const isLeverageEnabled = await vault.isLeverageEnabled();
        const isLiquidatorEnabled = await vault.isLiquidator(deployer.address);
        const isManager = await vault.isManager(glpManager.address);

        console.log("Contract states:");
        console.log("- Leverage enabled:", isLeverageEnabled);
        console.log("- Deployer is liquidator:", isLiquidatorEnabled);
        console.log("- GLP Manager is vault manager:", isManager);

        // Check initial LINK balance
        const linkBalance = await link.balanceOf(deployer.address);
        console.log("Initial LINK balance:", ethers.utils.formatUnits(linkBalance, 18));
    });

    it("Should allow adding liquidity with LINK", async function () {
        const linkAmount = expandDecimals(1, 18); // 1 LINK

        // Approve GLP Manager to spend LINK
        await link.connect(deployer).approve(glpManager.address, linkAmount);
        console.log("Approved GLP Manager to spend LINK");

        // Add liquidity
        await glpManager.connect(deployer).addLiquidity(
            link.address,
            linkAmount,
            0, // minUsdg
            0  // minGlp
        );
        console.log("Added liquidity with LINK");

        // Verify GLP balance
        const glpBalance = await glp.balanceOf(deployer.address);
        console.log("GLP balance after adding liquidity:", ethers.utils.formatUnits(glpBalance, 18));
        expect(glpBalance).to.be.gt(0);
    });

    it("Should allow opening a long position with LINK", async function () {
        const collateralAmount = expandDecimals(1, 18); // 1 LINK
        const leverage = 2;
        const sizeDelta = collateralAmount.mul(leverage);

        // Approve Position Router to spend LINK
        await link.connect(deployer).approve(positionRouter.address, collateralAmount);
        console.log("Approved Position Router to spend LINK");

        // Create long position
        await positionRouter.connect(deployer).createIncreasePosition(
            [link.address], // path
            link.address,   // indexToken
            collateralAmount,
            0, // minOut
            sizeDelta,
            true, // isLong
            toUsd(2000), // acceptablePrice for 2000 USD/LINK
            expandDecimals(1, 17), // executionFee
            ethers.constants.HashZero, // referralCode
            ethers.constants.AddressZero // callbackTarget
        );
        console.log("Created increase position request");

        // Wait for position to be executed
        await increaseTime(provider, 300);
        await mineBlock(provider);

        // Verify position
        const position = await vault.getPosition(
            deployer.address,
            link.address,
            link.address,
            true
        );
        console.log("Position size:", ethers.utils.formatUnits(position.size, 30));
        expect(position.size).to.be.gt(0);
    });

    it("Should update price feed and trigger liquidation", async function () {
        // Set up a highly leveraged position
        const collateralAmount = expandDecimals(1, 17); // 0.1 LINK
        const leverage = 10;
        const sizeDelta = collateralAmount.mul(leverage);

        // Create position
        await link.connect(deployer).approve(positionRouter.address, collateralAmount);
        await positionRouter.connect(deployer).createIncreasePosition(
            [link.address],
            link.address,
            collateralAmount,
            0,
            sizeDelta,
            true,
            toUsd(2000),
            expandDecimals(1, 17),
            ethers.constants.HashZero,
            ethers.constants.AddressZero
        );

        await increaseTime(provider, 300);
        await mineBlock(provider);

        // Update price feed to trigger liquidation
        await vaultPriceFeed.connect(deployer).setPrice(
            link.address,
            toChainlinkPrice(1800) // Price drops to $1800
        );
        console.log("Updated LINK price to trigger liquidation");

        // Liquidate position
        await positionRouter.connect(deployer).liquidatePosition(
            deployer.address,
            link.address,
            link.address,
            true,
            deployer.address
        );
        console.log("Liquidation executed");

        // Verify position is liquidated
        const position = await vault.getPosition(
            deployer.address,
            link.address,
            link.address,
            true
        );
        expect(position.size).to.eq(0);
    });

    it("Should allow removing liquidity", async function () {
        const glpBalance = await glp.balanceOf(deployer.address);
        console.log("GLP balance before removal:", ethers.utils.formatUnits(glpBalance, 18));

        await glpManager.connect(deployer).removeLiquidity(
            link.address,
            glpBalance,
            0, // minOut
            deployer.address
        );
        console.log("Removed liquidity");

        const finalGlpBalance = await glp.balanceOf(deployer.address);
        console.log("Final GLP balance:", ethers.utils.formatUnits(finalGlpBalance, 18));
        expect(finalGlpBalance).to.eq(0);
    });

    it("Should collect and distribute fees correctly", async function () {
        // Create a position that will generate fees
        const collateralAmount = expandDecimals(1, 18); // 1 LINK
        await link.connect(deployer).approve(router.address, collateralAmount);

        // Initial fee recipient balances
        const initialFeeBalance = await link.balanceOf(vault.address);
        console.log("Initial fee balance:", ethers.utils.formatUnits(initialFeeBalance, 18));

        // Create and close position to generate fees
        await positionRouter.connect(deployer).createIncreasePosition(
            [link.address],
            link.address,
            collateralAmount,
            0,
            collateralAmount.mul(2),
            true,
            toUsd(2000),
            expandDecimals(1, 17),
            ethers.constants.HashZero,
            ethers.constants.AddressZero
        );

        await increaseTime(provider, 300);
        await mineBlock(provider);

        await positionRouter.connect(deployer).createDecreasePosition(
            [link.address],
            link.address,
            collateralAmount.div(2),
            collateralAmount.mul(2),
            true,
            deployer.address,
            toUsd(1900),
            0,
            expandDecimals(1, 17),
            false,
            ethers.constants.AddressZero
        );

        // Verify fees were collected
        const finalFeeBalance = await link.balanceOf(vault.address);
        console.log("Final fee balance:", ethers.utils.formatUnits(finalFeeBalance, 18));
        expect(finalFeeBalance).to.be.gt(initialFeeBalance);
    });
});
