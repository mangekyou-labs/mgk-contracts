const { contractAt, readTmpAddresses } = require("../shared/helpers")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Read deployed addresses
  const addresses = readTmpAddresses()
  
  console.log("🔍 Checking FastPriceFeed Configuration")
  console.log("Network:", network)
  console.log("Signer:", signer.address)
  
  try {
    // Get the FastPriceFeed contract
    const fastPriceFeed = await contractAt("FastPriceFeed", addresses.secondaryPriceFeed)
    
    console.log("FastPriceFeed address:", fastPriceFeed.address)
    
    // Check if it's initialized
    const isInitialized = await fastPriceFeed.isInitialized()
    console.log("Is initialized:", isInitialized)
    
    if (!isInitialized) {
      console.log("❌ FastPriceFeed is not initialized")
      return
    }
    
    // Check governance
    const gov = await fastPriceFeed.gov()
    console.log("Governance address:", gov)
    console.log("Signer is gov:", signer.address === gov)
    
    // Check token manager
    const tokenManager = await fastPriceFeed.tokenManager()
    console.log("Token manager:", tokenManager)
    
    // Check if signer is updater
    const isUpdater = await fastPriceFeed.isUpdater(signer.address)
    console.log("Signer is updater:", isUpdater)
    
    // Check if signer is signer (for governance)
    const isSigner = await fastPriceFeed.isSigner(signer.address)
    console.log("Signer is signer:", isSigner)
    
    // Get min authorizations
    const minAuthorizations = await fastPriceFeed.minAuthorizations()
    console.log("Min authorizations:", minAuthorizations.toString())
    
    // Get tokens array
    const tokens = await fastPriceFeed.tokens(0)
    console.log("First token:", tokens)
    
    // Get price feed IDs
    const tokensLength = await fastPriceFeed.tokens.length
    console.log("Number of tokens:", tokensLength)
    
    // Try to get specific tokens
    try {
      const token0 = await fastPriceFeed.tokens(0)
      const token1 = await fastPriceFeed.tokens(1)
      console.log("Token 0:", token0)
      console.log("Token 1:", token1)
      
      // Get price feed IDs for these tokens
      const priceFeedId0 = await fastPriceFeed.priceFeedIds(token0)
      const priceFeedId1 = await fastPriceFeed.priceFeedIds(token1)
      console.log("Price feed ID 0:", priceFeedId0)
      console.log("Price feed ID 1:", priceFeedId1)
      
    } catch (tokenError) {
      console.log("Error getting tokens:", tokenError.message)
    }
    
    // Check current prices
    try {
      const price0 = await fastPriceFeed.prices(tokens)
      console.log("Price for token 0:", price0.toString())
    } catch (priceError) {
      console.log("Error getting price:", priceError.message)
    }
    
    // Check Pyth configuration
    const pyth = await fastPriceFeed.pyth()
    console.log("Pyth address:", pyth)
    
    // Check price duration
    const priceDuration = await fastPriceFeed.priceDuration()
    console.log("Price duration:", priceDuration.toString(), "seconds")
    
    // Check max price update delay
    const maxPriceUpdateDelay = await fastPriceFeed.maxPriceUpdateDelay()
    console.log("Max price update delay:", maxPriceUpdateDelay.toString(), "seconds")
    
    // Check last updated
    const lastUpdatedAt = await fastPriceFeed.lastUpdatedAt()
    const lastUpdatedBlock = await fastPriceFeed.lastUpdatedBlock()
    console.log("Last updated at:", lastUpdatedAt.toString())
    console.log("Last updated block:", lastUpdatedBlock.toString())
    
    // Check if we can add ourselves as updater
    if (signer.address === gov) {
      console.log("\n✅ Signer is governance - can add as updater")
      console.log("To add as updater, call: fastPriceFeed.setUpdater(signer.address, true)")
    } else {
      console.log("\n❌ Signer is not governance - cannot add as updater")
      console.log("Need governance access to modify updaters")
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
