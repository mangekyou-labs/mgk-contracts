const { expect, use } = require("chai")
const { solidity } = require("ethereum-waffle")
const { expandDecimals } = require("../../shared/utilities")
const { toUsd } = require("../../shared/units")

use(solidity)

describe("Hedera Testnet - Basic Perpetual Engine Test", function () {
  let vault
  let vaultPriceFeed
  let usdg
  let router
  let link
  let linkPriceFeed
  let signer

  before(async () => {
    // Get the signer (equivalent to user0 in the original tests)
    ;[signer] = await ethers.getSigners()
    
    // Read deployed addresses from our tmp file
    const path = require('path')
    const fs = require('fs')
    const addressesPath = path.join(__dirname, '../../../.tmp-addresses-hederaTestnet.json')
    
    if (!fs.existsSync(addressesPath)) {
      throw new Error(`Addresses file not found: ${addressesPath}`)
    }
    
    const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'))
    console.log("Addresses loaded:", Object.keys(addresses))
    
    // Get deployed contracts
    vault = await ethers.getContractAt("Vault", addresses.vault)
    vaultPriceFeed = await ethers.getContractAt("VaultPriceFeed", addresses.vaultPriceFeed)
    usdg = await ethers.getContractAt("USDG", addresses.usdg)
    router = await ethers.getContractAt("Router", addresses.router)
    
    // Get LINK token from our tokens config
    const tokens = require("../../../scripts/core/tokens").hederaTestnet
    link = await ethers.getContractAt("IERC20", tokens.link.address)
    
    console.log("✅ Contracts loaded successfully")
    console.log("Vault:", vault.address)
    console.log("VaultPriceFeed:", vaultPriceFeed.address)
    console.log("USDG:", usdg.address)
    console.log("Router:", router.address)
    console.log("LINK:", link.address)
  })

  it("should have correct basic configuration", async () => {
    // Check basic vault configuration
    expect(await vault.isInitialized()).to.be.true
    expect(await vault.isLeverageEnabled()).to.be.true
    expect(await vault.maxLeverage()).to.equal(50 * 10000) // 50x
    
    console.log("✅ Basic vault configuration verified")
  })

  it("should have LINK token whitelisted", async () => {
    // Check if LINK is whitelisted
    expect(await vault.whitelistedTokens(link.address)).to.be.true
    
    // Check token decimals
    expect(await vault.tokenDecimals(link.address)).to.equal(18)
    
    console.log("✅ LINK token whitelisted and configured")
  })

  it("should have realistic LINK price", async () => {
    // Get current LINK price
    const linkPrice = await vault.getMinPrice(link.address)
    
    // Price should be realistic (not the old extremely low value)
    expect(linkPrice).to.be.gt(ethers.utils.parseUnits("1", 30)) // > $1 USD
    expect(linkPrice).to.be.lt(ethers.utils.parseUnits("100", 30)) // < $100 USD
    
    console.log("✅ LINK price is realistic:", ethers.utils.formatUnits(linkPrice, 30), "USD")
  })

  it("should allow collateral deposit", async () => {
    // Check initial balance
    const initialBalance = await link.balanceOf(signer.address)
    expect(initialBalance).to.be.gt(0)
    
    console.log("Initial LINK balance:", ethers.utils.formatEther(initialBalance))
    
    // Transfer small amount to vault as collateral
    const depositAmount = initialBalance.mul(10).div(100) // 10% of balance
    await link.transfer(vault.address, depositAmount)
    
    // Verify transfer
    const vaultBalance = await link.balanceOf(vault.address)
    expect(vaultBalance).to.be.gte(depositAmount)
    
    console.log("✅ Collateral deposit successful:", ethers.utils.formatEther(depositAmount), "LINK")
  })

  it("should allow position opening", async () => {
    // Get current position state
    const positionKey = ethers.utils.solidityKeccak256(
      ["address", "address", "address", "bool"],
      [signer.address, link.address, link.address, true]
    )
    
    const initialPosition = await vault.positions(positionKey)
    const initialSize = initialPosition[0]
    
    // Get current LINK price and calculate position size with leverage
    const linkPrice = await vault.getMinPrice(link.address)
    const availableCollateral = await link.balanceOf(signer.address)
    
    // Use 50% of available balance for position
    const collateralAmount = availableCollateral.mul(50).div(100)
    
    // Calculate collateral value in USD
    const collateralValueUsd = collateralAmount.mul(linkPrice).div(ethers.utils.parseUnits("1", 18))
    
    // For the vault to accept the position, the position size must be > collateral value
    // Let's use a 1.5x leverage (position size = 1.5 * collateral value)
    const positionSize = collateralValueUsd.mul(150).div(100) // 1.5x leverage
    
    console.log("Opening position with:")
    console.log("- Collateral:", ethers.utils.formatEther(collateralAmount), "LINK")
    console.log("- Collateral value:", ethers.utils.formatUnits(collateralValueUsd, 30), "USD")
    console.log("- Position size:", ethers.utils.formatUnits(positionSize, 30), "USD")
    console.log("- Leverage:", ethers.utils.formatUnits(positionSize.mul(10000).div(collateralValueUsd), 4), "x")
    console.log("- Size vs Collateral ratio:", ethers.utils.formatUnits(positionSize.mul(10000).div(collateralValueUsd), 4))
    console.log("- Position size > Collateral value?", positionSize.gt(collateralValueUsd))
    
    // Transfer collateral to vault first
    await link.transfer(vault.address, collateralAmount)
    
    // Open the long position
    await vault.increasePosition(
      signer.address,     // account
      link.address,       // collateralToken
      link.address,       // indexToken 
      positionSize,       // sizeDelta
      true                // isLong
    )
    
    // Verify position was created
    const newPosition = await vault.positions(positionKey)
    expect(newPosition[0]).to.be.gt(0) // Position size > 0
    
    console.log("✅ Position opened successfully")
    console.log("Position size:", ethers.utils.formatUnits(newPosition[0], 30), "USD")
    console.log("Collateral:", ethers.utils.formatUnits(newPosition[1], 30), "USD")
  })

  it("should allow position closing", async () => {
    // Get current position
    const positionKey = ethers.utils.solidityKeccak256(
      ["address", "address", "address", "bool"],
      [signer.address, link.address, link.address, true]
    )
    
    const position = await vault.positions(positionKey)
    const positionSize = position[0]
    
    if (positionSize.gt(0)) {
      // Close the position
      await vault.decreasePosition(
        signer.address,     // account
        link.address,       // collateralToken
        link.address,       // indexToken 
        0,                  // collateralDelta (0 = no collateral withdrawal)
        positionSize,       // sizeDelta (close entire position)
        true,               // isLong
        signer.address      // receiver
      )
      
      // Verify position is closed
      const closedPosition = await vault.positions(positionKey)
      expect(closedPosition[0]).to.equal(0)
      
      console.log("✅ Position closed successfully")
    } else {
      console.log("ℹ️ No position to close")
    }
  })

  it("should have working price feed integration", async () => {
    // Check that VaultPriceFeed is working
    const primaryPriceFeed = await vaultPriceFeed.primaryPriceFeed()
    expect(primaryPriceFeed).to.not.equal(ethers.constants.AddressZero)
    
    // Check that secondary price feed is configured
    const secondaryPriceFeed = await vaultPriceFeed.secondaryPriceFeed()
    expect(secondaryPriceFeed).to.not.equal(ethers.constants.AddressZero)
    
    // Check that secondary price feed is enabled
    const isSecondaryPriceFeedEnabled = await vaultPriceFeed.isSecondaryPriceFeedEnabled()
    expect(isSecondaryPriceFeedEnabled).to.be.true
    
    console.log("✅ Price feed integration working")
    console.log("Primary price feed:", primaryPriceFeed)
    console.log("Secondary price feed:", secondaryPriceFeed)
    console.log("Secondary enabled:", isSecondaryPriceFeedEnabled)
  })
})
