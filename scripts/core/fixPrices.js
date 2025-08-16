const { contractAt, readTmpAddresses, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');
const tokens = require('./tokens')[network];

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Read deployed addresses
  const addresses = readTmpAddresses()
  
  console.log("🔧 Fixing Price Feed Issues")
  console.log("Network:", network)
  console.log("Signer:", signer.address)
  
  try {
    // Get the vault and price feed contracts
    const vault = await contractAt("Vault", addresses.vault)
    const vaultPriceFeed = await contractAt("VaultPriceFeed", addresses.vaultPriceFeed)
    
    console.log("Vault address:", vault.address)
    console.log("VaultPriceFeed address:", vaultPriceFeed.address)
    
    // Check if there's a secondary price feed
    const secondaryPriceFeedAddr = await vaultPriceFeed.secondaryPriceFeed()
    console.log("Secondary price feed address:", secondaryPriceFeedAddr)
    
    if (secondaryPriceFeedAddr !== ethers.constants.AddressZero) {
      console.log("✅ Found secondary price feed!")
      
      const secondaryPriceFeed = await contractAt("FastPriceFeed", secondaryPriceFeedAddr)
      
      // Check current prices
      const { link, nativeToken } = tokens
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
        
        // Try alternative approach - check if we can update the Chainlink mock directly
        console.log("\nTrying to update Chainlink mock directly...")
        
        try {
          const linkPriceFeedAddr = await vaultPriceFeed.priceFeeds(link.address)
          console.log("LINK Chainlink price feed:", linkPriceFeedAddr)
          
          // Try to interact with the Chainlink price feed
          const chainlinkPriceFeed = await contractAt("PriceFeed", linkPriceFeedAddr)
          
          // Check if this is a mock price feed
          try {
            const latestAnswer = await chainlinkPriceFeed.latestAnswer()
            console.log("Current Chainlink answer:", latestAnswer.toString())
            
            // Try to set a new answer if it's a mock
            const newAnswer = expandDecimals(15, 8) // $15 with 8 decimals for Chainlink
            await sendTxn(
              chainlinkPriceFeed.setLatestAnswer(newAnswer),
              "Set Chainlink mock answer"
            )
            console.log("✅ Chainlink mock updated!")
            
          } catch (answerError) {
            console.log("❌ Cannot update Chainlink answer:", answerError.message)
          }
          
        } catch (chainlinkError) {
          console.log("❌ Chainlink interaction error:", chainlinkError.message)
        }
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
      }
      
    } else {
      console.log("❌ No secondary price feed found")
      console.log("This means the system is using only Chainlink price feeds")
      console.log("You may need to deploy a FastPriceFeed or update the Chainlink mocks")
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
