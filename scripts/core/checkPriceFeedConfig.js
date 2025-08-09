const { contractAt, readTmpAddresses } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');
const tokens = require('./tokens')[network];

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Read deployed addresses
  const addresses = readTmpAddresses()
  
  // Get contracts
  const vault = await contractAt("Vault", addresses.vault)
  const priceFeed = await contractAt("VaultPriceFeed", addresses.vaultPriceFeed)
  
  const { link } = tokens
  
  console.log("🔍 Checking Price Feed Configuration")
  console.log("Vault address:", vault.address)
  console.log("Price feed address:", priceFeed.address)
  console.log("LINK address:", link.address)
  
  try {
    // Check vault price feed
    const vaultPriceFeedAddr = await vault.priceFeed()
    console.log("Vault's price feed address:", vaultPriceFeedAddr)
    
    // Check LINK price from different sources
    console.log("\n=== LINK Price Analysis ===")
    
    // From vault
    const linkMinPrice = await vault.getMinPrice(link.address)
    const linkMaxPrice = await vault.getMaxPrice(link.address)
    
    console.log("From vault:")
    console.log("- Min price:", linkMinPrice.toString(), "raw")
    console.log("- Min price:", ethers.utils.formatUnits(linkMinPrice, 30), "formatted")
    console.log("- Max price:", linkMaxPrice.toString(), "raw")
    console.log("- Max price:", ethers.utils.formatUnits(linkMaxPrice, 30), "formatted")
    
    // From price feed directly
    const priceFromFeed = await priceFeed.getPrice(link.address, true, true, true)
    console.log("From price feed:")
    console.log("- Price:", priceFromFeed.toString(), "raw")
    console.log("- Price:", ethers.utils.formatUnits(priceFromFeed, 30), "formatted")
    
    // Check token configuration in price feed
    console.log("\n=== Price Feed Token Config ===")
    
    try {
      const priceFeeds = await priceFeed.priceFeeds(link.address)
      console.log("LINK price feed address:", priceFeeds)
      
      const priceFeedDecimals = await priceFeed.priceFeedDecimals(link.address)
      console.log("Price feed decimals:", priceFeedDecimals.toString())
      
      const spreadBasisPoints = await priceFeed.spreadBasisPoints(link.address)
      console.log("Spread basis points:", spreadBasisPoints.toString())
      
    } catch (configError) {
      console.log("Price feed config error:", configError.message)
    }
    
    // Check what a realistic LINK price should be
    console.log("\n=== Expected vs Actual ===")
    console.log("Expected LINK price: ~$15-20 USD")
    console.log("Actual LINK price:", ethers.utils.formatUnits(linkMinPrice, 30), "USD")
    
    const expectedPrice = expandDecimals(15, 30) // $15 with 30 decimals
    console.log("Expected price (formatted):", ethers.utils.formatUnits(expectedPrice, 30))
    console.log("Price difference factor:", expectedPrice.div(linkMinPrice).toString())
    
    // Check if we can manually set a better price for testing
    console.log("\n=== Manual Price Test ===")
    console.log("If LINK was $15:")
    const testPrice = expandDecimals(15, 30)
    const collateralAmount = expandDecimals(2, 18) // 2 LINK
    const collateralValue = testPrice.mul(collateralAmount).div(expandDecimals(1, 18))
    console.log("- 2 LINK collateral value:", ethers.utils.formatUnits(collateralValue, 30), "USD")
    console.log("- Liquidation fee:", "2.0 USD")
    console.log("- Available for position:", ethers.utils.formatUnits(collateralValue.sub(expandDecimals(2, 30)), 30), "USD")
    
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
