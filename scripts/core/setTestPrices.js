const { contractAt, readTmpAddresses, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');
const tokens = require('./tokens')[network];

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Read deployed addresses
  const addresses = readTmpAddresses()
  
  // Try to find price feed contracts
  console.log("🔧 Setting Realistic Test Prices")
  console.log("Network:", network)
  
  try {
    // Get the vault price feed
    const vault = await contractAt("Vault", addresses.vault)
    const priceFeedAddr = await vault.priceFeed()
    const vaultPriceFeed = await contractAt("VaultPriceFeed", priceFeedAddr)
    
    console.log("Vault address:", vault.address)
    console.log("Price feed address:", priceFeedAddr)
    
    // Check if this is a mock price feed that allows setting prices
    console.log("\n=== Current Prices ===")
    const { link, nativeToken } = tokens
    
    const currentLinkPrice = await vault.getMinPrice(link.address)
    console.log("Current LINK price:", ethers.utils.formatUnits(currentLinkPrice, 30))
    
    // Try to find FastPriceFeed or Mock price feed
    console.log("\n=== Attempting to Set Realistic Prices ===")
    
    // Set realistic prices (30 decimal precision)
    const linkPrice = expandDecimals(15, 30)    // $15 LINK
    const hbarPrice = expandDecimals(5, 28)     // $0.05 HBAR (5 * 10^28 = 0.05 * 10^30)
    
    console.log("Setting LINK price to:", ethers.utils.formatUnits(linkPrice, 30))
    console.log("Setting HBAR price to:", ethers.utils.formatUnits(hbarPrice, 30))
    
    try {
      // Try if this is a mock price feed
      await sendTxn(
        vaultPriceFeed.setPrice(link.address, linkPrice),
        "Set LINK price"
      )
      console.log("✅ LINK price set successfully!")
      
    } catch (setPriceError) {
      console.log("❌ Direct price setting failed:", setPriceError.message)
      
      // Try setPrices (batch)
      try {
        await sendTxn(
          vaultPriceFeed.setPrices(
            [link.address],
            [linkPrice]
          ),
          "Set prices (batch)"
        )
        console.log("✅ Batch price setting succeeded!")
        
      } catch (batchError) {
        console.log("❌ Batch price setting failed:", batchError.message)
        
        // Check if we need to find the actual price feed source
        console.log("\nChecking price feed source...")
        
        try {
          const linkPriceFeed = await vaultPriceFeed.priceFeeds(link.address)
          console.log("LINK price feed contract:", linkPriceFeed)
          
          // Try to interact with the Chainlink mock
          const mockPriceFeed = await contractAt("MockPriceFeed", linkPriceFeed)
          
          // Chainlink prices are typically 8 decimals
          const chainlinkPrice = expandDecimals(15, 8) // $15 with 8 decimals
          await sendTxn(
            mockPriceFeed.setAnswer(chainlinkPrice),
            "Set mock price feed answer"
          )
          console.log("✅ Mock price feed updated!")
          
        } catch (mockError) {
          console.log("❌ Mock price feed error:", mockError.message)
        }
      }
    }
    
    // Verify new prices
    console.log("\n=== Verifying New Prices ===")
    const newLinkPrice = await vault.getMinPrice(link.address)
    console.log("New LINK price:", ethers.utils.formatUnits(newLinkPrice, 30))
    
    if (newLinkPrice.gt(currentLinkPrice.mul(1000))) {
      console.log("✅ Price significantly increased - ready for position testing!")
      
      // Test position requirements with new price
      const collateralAmount = expandDecimals(2, 18) // 2 LINK
      const collateralValue = newLinkPrice.mul(collateralAmount).div(expandDecimals(1, 18))
      const liquidationFee = expandDecimals(2, 30) // 2 USD
      
      console.log("\n=== Position Viability Check ===")
      console.log("2 LINK collateral value:", ethers.utils.formatUnits(collateralValue, 30), "USD")
      console.log("Liquidation fee:", ethers.utils.formatUnits(liquidationFee, 30), "USD")
      console.log("Available for position:", ethers.utils.formatUnits(collateralValue.sub(liquidationFee), 30), "USD")
      
      if (collateralValue.gt(liquidationFee.mul(2))) {
        console.log("✅ Positions should now work!")
      } else {
        console.log("⚠️ May need more collateral or lower fees")
      }
      
    } else {
      console.log("❌ Price unchanged - may need different approach")
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
