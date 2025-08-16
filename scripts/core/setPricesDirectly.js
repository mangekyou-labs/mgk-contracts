const { contractAt, readTmpAddresses, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');
const tokens = require('./tokens')[network];

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Read deployed addresses
  const addresses = readTmpAddresses()
  
  console.log("🔧 Setting Prices Directly in FastPriceFeed")
  console.log("Network:", network)
  console.log("Signer:", signer.address)
  
  try {
    // Get contracts
    const vault = await contractAt("Vault", addresses.vault)
    const fastPriceFeed = await contractAt("FastPriceFeed", addresses.secondaryPriceFeed)
    
    console.log("Vault address:", vault.address)
    console.log("FastPriceFeed address:", fastPriceFeed.address)
    
    // Check current prices
    const { link, nativeToken } = tokens
    const currentLinkPrice = await vault.getMinPrice(link.address)
    const currentHbarPrice = await vault.getMinPrice(nativeToken.address)
    
    console.log("\n=== Current Prices ===")
    console.log("LINK price:", ethers.utils.formatUnits(currentLinkPrice, 30))
    console.log("HBAR price:", ethers.utils.formatUnits(currentHbarPrice, 30))
    
    // Check if signer is updater
    const isUpdater = await fastPriceFeed.isUpdater(signer.address)
    console.log("Signer is updater:", isUpdater)
    
    if (!isUpdater) {
      console.log("❌ Signer is not an updater - cannot set prices")
      return
    }
    
    // Check if secondary price feed is enabled in VaultPriceFeed
    const vaultPriceFeed = await contractAt("VaultPriceFeed", addresses.vaultPriceFeed)
    const isSecondaryPriceEnabled = await vaultPriceFeed.isSecondaryPriceEnabled()
    console.log("Secondary price feed enabled:", isSecondaryPriceEnabled)
    
    if (!isSecondaryPriceEnabled) {
      console.log("Enabling secondary price feed...")
      await sendTxn(
        vaultPriceFeed.setIsSecondaryPriceEnabled(true),
        "Enable secondary price feed"
      )
      console.log("✅ Secondary price feed enabled!")
    }
    
    // Try to set prices directly in FastPriceFeed
    console.log("\n=== Setting Prices Directly ===")
    
    // Set realistic prices (30 decimal precision)
    const linkPrice = expandDecimals(15, 30)    // $15 LINK
    const hbarPrice = expandDecimals(5, 28)     // $0.05 HBAR
    
    console.log("Setting LINK price to:", ethers.utils.formatUnits(linkPrice, 30))
    console.log("Setting HBAR price to:", ethers.utils.formatUnits(hbarPrice, 30))
    
    // Try to call a direct price setting function if it exists
    try {
      // Check if there's a direct setPrice function
      const linkPriceBefore = await fastPriceFeed.prices(link.address)
      const hbarPriceBefore = await fastPriceFeed.prices(nativeToken.address)
      
      console.log("LINK price in FastPriceFeed before:", linkPriceBefore.toString())
      console.log("HBAR price in FastPriceFeed before:", hbarPriceBefore.toString())
      
      // Try to use a different approach - check if we can call internal functions
      console.log("\n=== Trying Alternative Price Setting ===")
      
      // Check if we can use the FastPriceFeed's internal _setPrice function
      // This might require us to be an authorized updater
      
      // Try to create a simple price update that bypasses Pyth
      console.log("Attempting to bypass Pyth and set prices directly...")
      
      // Check if there are any other price setting functions
      const fastPriceFeedCode = await ethers.provider.getCode(fastPriceFeed.address)
      console.log("FastPriceFeed contract code length:", fastPriceFeedCode.length)
      
      // Try to use the setPricesWithData function with empty data to trigger price updates
      const emptyUpdateData = []
      
      try {
        await sendTxn(
          fastPriceFeed.setPricesWithData(emptyUpdateData, { value: 0 }),
          "Set prices with empty data"
        )
        console.log("✅ Prices updated with empty data!")
      } catch (emptyDataError) {
        console.log("❌ Empty data approach failed:", emptyDataError.message)
      }
      
    } catch (directError) {
      console.log("❌ Direct price setting failed:", directError.message)
    }
    
    // Check new prices
    console.log("\n=== Checking New Prices ===")
    const newLinkPrice = await vault.getMinPrice(link.address)
    const newHbarPrice = await vault.getMinPrice(nativeToken.address)
    
    console.log("New LINK price:", ethers.utils.formatUnits(newLinkPrice, 30))
    console.log("New HBAR price:", ethers.utils.formatUnits(newHbarPrice, 30))
    
    if (newLinkPrice.gt(currentLinkPrice.mul(1000))) {
      console.log("✅ LINK price significantly increased!")
    } else {
      console.log("❌ LINK price unchanged")
    }
    
    if (newHbarPrice.gt(currentHbarPrice.mul(1000))) {
      console.log("✅ HBAR price significantly increased!")
    } else {
      console.log("❌ HBAR price unchanged")
    }
    
    // Test position viability with new prices
    if (newLinkPrice.gt(currentLinkPrice.mul(1000))) {
      console.log("\n=== Position Viability Check ===")
      const collateralAmount = expandDecimals(2, 18) // 2 LINK
      const collateralValue = newLinkPrice.mul(collateralAmount).div(expandDecimals(1, 18))
      const liquidationFee = await vault.liquidationFeeUsd()
      
      console.log("2 LINK collateral value:", ethers.utils.formatUnits(collateralValue, 30), "USD")
      console.log("Liquidation fee:", ethers.utils.formatUnits(liquidationFee, 30), "USD")
      console.log("Available for position:", ethers.utils.formatUnits(collateralValue.sub(liquidationFee), 30), "USD")
      
      if (collateralValue.gt(liquidationFee.mul(2))) {
        console.log("✅ Positions should now work!")
        console.log("Ready to run perpetual tests!")
      } else {
        console.log("⚠️ May need more collateral or lower fees")
      }
    }
    
    // Summary
    console.log("\n=== Summary ===")
    console.log("The Pyth network integration is complex and requires:")
    console.log("1. Valid Pyth price update data")
    console.log("2. Proper price feed IDs")
    console.log("3. Working Pyth network on Hedera testnet")
    console.log("")
    console.log("For testing purposes, consider:")
    console.log("1. Using mock price feeds")
    console.log("2. Testing on other networks with better oracle support")
    console.log("3. Using local hardhat network with controlled prices")
    
  } catch (error) {
    console.log("Error:", error.message)
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
