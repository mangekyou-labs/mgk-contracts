const { contractAt, readTmpAddresses, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');
const tokens = require('./tokens')[network];

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Read deployed addresses
  const addresses = readTmpAddresses()
  
  console.log("🔧 Updating Chainlink Price Feeds")
  console.log("Network:", network)
  console.log("Signer:", signer.address)
  
  try {
    // Get the vault and price feed contracts
    const vault = await contractAt("Vault", addresses.vault)
    const vaultPriceFeed = await contractAt("VaultPriceFeed", addresses.vaultPriceFeed)
    
    console.log("Vault address:", vault.address)
    console.log("VaultPriceFeed address:", vaultPriceFeed.address)
    
    // Check current prices
    const { link, nativeToken } = tokens
    const currentLinkPrice = await vault.getMinPrice(link.address)
    console.log("Current LINK price:", ethers.utils.formatUnits(currentLinkPrice, 30))
    
    // Get the Chainlink price feed addresses
    const linkPriceFeedAddr = await vaultPriceFeed.priceFeeds(link.address)
    const hbarPriceFeedAddr = await vaultPriceFeed.priceFeeds(nativeToken.address)
    
    console.log("LINK Chainlink price feed:", linkPriceFeedAddr)
    console.log("HBAR Chainlink price feed:", hbarPriceFeedAddr)
    
    // Try to update the Chainlink price feeds directly
    console.log("\n=== Attempting to Update Chainlink Price Feeds ===")
    
    try {
      // Try to interact with the LINK price feed
      const linkPriceFeed = await contractAt("PriceFeed", linkPriceFeedAddr)
      
      // Check if this is a mock price feed
      try {
        const latestAnswer = await linkPriceFeed.latestAnswer()
        console.log("Current LINK Chainlink answer:", latestAnswer.toString())
        
        // Set a realistic LINK price ($15 with 8 decimals for Chainlink)
        const newLinkAnswer = expandDecimals(15, 8) // $15 with 8 decimals
        console.log("Setting LINK Chainlink answer to:", newLinkAnswer.toString())
        
        await sendTxn(
          linkPriceFeed.setLatestAnswer(newLinkAnswer),
          "Set LINK Chainlink answer"
        )
        console.log("✅ LINK Chainlink price updated!")
        
      } catch (answerError) {
        console.log("❌ Cannot update LINK Chainlink answer:", answerError.message)
      }
      
    } catch (linkError) {
      console.log("❌ LINK Chainlink interaction error:", linkError.message)
    }
    
    try {
      // Try to interact with the HBAR price feed
      const hbarPriceFeed = await contractAt("PriceFeed", hbarPriceFeedAddr)
      
      // Check if this is a mock price feed
      try {
        const latestAnswer = await hbarPriceFeed.latestAnswer()
        console.log("Current HBAR Chainlink answer:", latestAnswer.toString())
        
        // Set a realistic HBAR price ($0.05 with 8 decimals for Chainlink)
        const newHbarAnswer = expandDecimals(5, 6) // $0.05 with 8 decimals (5 * 10^6 = 0.05 * 10^8)
        console.log("Setting HBAR Chainlink answer to:", newHbarAnswer.toString())
        
        await sendTxn(
          hbarPriceFeed.setLatestAnswer(newHbarAnswer),
          "Set HBAR Chainlink answer"
        )
        console.log("✅ HBAR Chainlink price updated!")
        
      } catch (answerError) {
        console.log("❌ Cannot update HBAR Chainlink answer:", answerError.message)
      }
      
    } catch (hbarError) {
      console.log("❌ HBAR Chainlink interaction error:", hbarError.message)
    }
    
    // Verify new prices
    console.log("\n=== Verifying New Prices ===")
    const newLinkPrice = await vault.getMinPrice(link.address)
    const newHbarPrice = await vault.getMinPrice(nativeToken.address)
    
    console.log("New LINK price:", ethers.utils.formatUnits(newLinkPrice, 30))
    console.log("New HBAR price:", ethers.utils.formatUnits(newHbarPrice, 30))
    
    if (newLinkPrice.gt(currentLinkPrice.mul(1000))) {
      console.log("✅ LINK price significantly increased!")
      
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
      console.log("❌ LINK price unchanged - may need different approach")
      console.log("The Chainlink price feeds might not be mock contracts or need different permissions")
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
