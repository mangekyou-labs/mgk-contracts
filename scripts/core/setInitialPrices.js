const { contractAt, readTmpAddresses, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');
const tokens = require('./tokens')[network];

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Read deployed addresses
  const addresses = readTmpAddresses()
  
  console.log("🔧 Setting Initial Prices in FastPriceFeed")
  console.log("Network:", network)
  console.log("Signer:", signer.address)
  
  try {
    // Get contracts
    const fastPriceFeed = await contractAt("FastPriceFeed", addresses.secondaryPriceFeed)
    const vault = await contractAt("Vault", addresses.vault)
    
    console.log("FastPriceFeed address:", fastPriceFeed.address)
    console.log("Vault address:", vault.address)
    
    // Check current prices
    const { link, nativeToken } = tokens
    const currentLinkPrice = await vault.getMinPrice(link.address)
    const currentHbarPrice = await vault.getMinPrice(nativeToken.address)
    
    console.log("\n=== Current Vault Prices ===")
    console.log("LINK price:", ethers.utils.formatUnits(currentLinkPrice, 30))
    console.log("HBAR price:", ethers.utils.formatUnits(currentHbarPrice, 30))
    
    // Check if signer is updater
    const isUpdater = await fastPriceFeed.isUpdater(signer.address)
    console.log("Signer is updater:", isUpdater)
    
    if (!isUpdater) {
      console.log("❌ Signer is not an updater - cannot set prices")
      return
    }
    
    // Check if FastPriceFeed has any prices set
    console.log("\n=== Checking FastPriceFeed State ===")
    
    try {
      // Try to get the last updated time
      const lastUpdatedAt = await fastPriceFeed.lastUpdatedAt()
      console.log("Last updated at:", new Date(lastUpdatedAt * 1000).toISOString())
      
      if (lastUpdatedAt.toNumber() === 0) {
        console.log("✅ FastPriceFeed has never been updated - this is the first time")
      } else {
        console.log("⚠️ FastPriceFeed has been updated before")
      }
    } catch (error) {
      console.log("❌ Error checking FastPriceFeed state:", error.message)
    }
    
    // Try to set initial prices using the setPrices function
    console.log("\n=== Attempting to Set Initial Prices ===")
    
    try {
      // Create a simple price update with current prices
      const tokens = [link.address, nativeToken.address]
      const prices = [currentLinkPrice, currentHbarPrice]
      
      console.log("Setting prices for tokens:", tokens)
      console.log("Setting prices:", prices.map(p => ethers.utils.formatUnits(p, 30)))
      
      // Try to call setPrices directly
      await sendTxn(
        fastPriceFeed.setPrices(tokens, prices),
        "Set initial prices in FastPriceFeed"
      )
      
      console.log("✅ Initial prices set successfully!")
      
    } catch (setPricesError) {
      console.log("❌ Error with setPrices:", setPricesError.message)
      
      // Try alternative approach - check if there's a different function
      console.log("\n=== Trying Alternative Approach ===")
      
      try {
        // Check if there's a setPrice function for individual tokens
        console.log("Checking if individual setPrice function exists...")
        
        // Try to set prices one by one
        await sendTxn(
          fastPriceFeed.setPrice(link.address, currentLinkPrice),
          "Set LINK price"
        )
        
        await sendTxn(
          fastPriceFeed.setPrice(nativeToken.address, currentHbarPrice),
          "Set HBAR price"
        )
        
        console.log("✅ Individual prices set successfully!")
        
      } catch (individualError) {
        console.log("❌ Error with individual setPrice:", individualError.message)
        
        console.log("\n=== Analysis ===")
        console.log("The FastPriceFeed contract doesn't have a simple setPrices function")
        console.log("It only supports setPricesWithData for Pyth updates")
        console.log("The division by zero error occurs because there are no initial prices")
        console.log("We need to find a way to initialize the prices first")
        
        // Check what functions are available
        console.log("\n=== Available Functions ===")
        console.log("FastPriceFeed contract functions:")
        console.log("- setPricesWithData(bytes[]): For Pyth updates")
        console.log("- setPrice(address, uint256): Individual price setting")
        console.log("- setUpdater(address, bool): Add/remove updaters")
        console.log("- setSigner(address, bool): Add/remove signers")
      }
    }
    
    // Check if prices were set
    console.log("\n=== Verifying Price Updates ===")
    
    try {
      const newLastUpdatedAt = await fastPriceFeed.lastUpdatedAt()
      console.log("New last updated at:", new Date(newLastUpdatedAt * 1000).toISOString())
      
      if (newLastUpdatedAt.toNumber() > 0) {
        console.log("✅ FastPriceFeed has been updated!")
        console.log("Ready to try Pyth price updates again!")
      } else {
        console.log("❌ FastPriceFeed still not updated")
      }
    } catch (verifyError) {
      console.log("❌ Error verifying updates:", verifyError.message)
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
