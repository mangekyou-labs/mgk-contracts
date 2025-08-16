const { contractAt, readTmpAddresses, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');
const tokens = require('./tokens')[network];

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Read deployed addresses
  const addresses = readTmpAddresses()
  
  console.log("🔧 Configuring Secondary Price Feed")
  console.log("Network:", network)
  console.log("Signer:", signer.address)
  
  try {
    // Get the vault and price feed contracts
    const vault = await contractAt("Vault", addresses.vault)
    const vaultPriceFeed = await contractAt("VaultPriceFeed", addresses.vaultPriceFeed)
    const secondaryPriceFeed = await contractAt("FastPriceFeed", addresses.secondaryPriceFeed)
    
    console.log("Vault address:", vault.address)
    console.log("VaultPriceFeed address:", vaultPriceFeed.address)
    console.log("Secondary price feed address:", secondaryPriceFeed.address)
    
    // Check current configuration
    const currentSecondaryPriceFeed = await vaultPriceFeed.secondaryPriceFeed()
    console.log("Current secondary price feed in VaultPriceFeed:", currentSecondaryPriceFeed)
    
    if (currentSecondaryPriceFeed === ethers.constants.AddressZero) {
      console.log("❌ Secondary price feed not configured in VaultPriceFeed")
      
      // Configure the secondary price feed
      console.log("Configuring secondary price feed...")
      await sendTxn(
        vaultPriceFeed.setSecondaryPriceFeed(secondaryPriceFeed.address),
        "Set secondary price feed"
      )
      console.log("✅ Secondary price feed configured!")
      
    } else {
      console.log("✅ Secondary price feed already configured")
    }
    
    // Enable secondary price feed
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
    
    // Now try to set realistic prices
    console.log("\n=== Setting Realistic Prices ===")
    const { link, nativeToken } = tokens
    
    // Check current prices
    const currentLinkPrice = await vault.getMinPrice(link.address)
    console.log("Current LINK price:", ethers.utils.formatUnits(currentLinkPrice, 30))
    
    // Set realistic prices using FastPriceFeed
    const linkPrice = expandDecimals(15, 30)    // $15 LINK
    const hbarPrice = expandDecimals(5, 28)     // $0.05 HBAR
    
    console.log("Setting LINK price to:", ethers.utils.formatUnits(linkPrice, 30))
    console.log("Setting HBAR price to:", ethers.utils.formatUnits(hbarPrice, 30))
    
    try {
      // Use FastPriceFeed to set prices
      await sendTxn(
        secondaryPriceFeed.setPrices(
          [link.address, nativeToken.address],
          [linkPrice, hbarPrice]
        ),
        "Set prices via FastPriceFeed"
      )
      console.log("✅ Prices set successfully via FastPriceFeed!")
      
    } catch (fastPriceError) {
      console.log("❌ FastPriceFeed error:", fastPriceError.message)
      console.log("This might be a permissions issue or the FastPriceFeed needs initialization")
    }
    
    // Verify new prices
    console.log("\n=== Verifying New Prices ===")
    const newLinkPrice = await vault.getMinPrice(link.address)
    console.log("New LINK price:", ethers.utils.formatUnits(newLinkPrice, 30))
    
    if (newLinkPrice.gt(currentLinkPrice.mul(1000))) {
      console.log("✅ Price significantly increased!")
      
      // Test position viability
      const collateralAmount = expandDecimals(2, 18) // 2 LINK
      const collateralValue = newLinkPrice.mul(collateralAmount).div(expandDecimals(1, 18))
      const liquidationFee = await vault.liquidationFeeUsd()
      
      console.log("\n=== Position Viability Check ===")
      console.log("2 LINK collateral value:", ethers.utils.formatUnits(collateralValue, 30), "USD")
      console.log("Liquidation fee:", ethers.utils.formatUnits(liquidationFee, 30), "USD")
      console.log("Available for position:", ethers.utils.formatUnits(collateralValue.sub(liquidationFee), 30), "USD")
      
      if (collateralValue.gt(liquidationFee.mul(2))) {
        console.log("✅ Positions should now work!")
        console.log("Ready to run perpetual tests!")
      } else {
        console.log("⚠️ May need more collateral or lower fees")
      }
      
    } else {
      console.log("❌ Price unchanged - may need different approach")
      console.log("The FastPriceFeed might need to be initialized or have proper permissions")
    }
    
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
