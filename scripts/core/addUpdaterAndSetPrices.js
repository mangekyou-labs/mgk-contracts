const { contractAt, readTmpAddresses, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');
const tokens = require('./tokens')[network];

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Read deployed addresses
  const addresses = readTmpAddresses()
  
  console.log("🔧 Adding Updater and Setting Realistic Prices via Pyth")
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
    
    // Check if signer is governance
    const gov = await fastPriceFeed.gov()
    console.log("Governance address:", gov)
    console.log("Signer is gov:", signer.address === gov)
    
    if (signer.address !== gov) {
      console.log("❌ Signer is not governance - cannot add as updater")
      return
    }
    
    // Add signer as updater
    console.log("\n=== Adding Signer as Updater ===")
    const isUpdater = await fastPriceFeed.isUpdater(signer.address)
    console.log("Current updater status:", isUpdater)
    
    if (!isUpdater) {
      await sendTxn(
        fastPriceFeed.setUpdater(signer.address, true),
        "Add signer as updater"
      )
      console.log("✅ Signer added as updater!")
    } else {
      console.log("✅ Signer is already an updater")
    }
    
    // Verify updater status
    const newUpdaterStatus = await fastPriceFeed.isUpdater(signer.address)
    console.log("New updater status:", newUpdaterStatus)
    
    // Get Pyth configuration
    const pythAddress = await fastPriceFeed.pyth()
    console.log("Pyth address:", pythAddress)
    
    // Get price feed IDs
    const linkPriceFeedId = await fastPriceFeed.priceFeedIds(link.address)
    const hbarPriceFeedId = await fastPriceFeed.priceFeedIds(nativeToken.address)
    
    console.log("LINK price feed ID:", linkPriceFeedId)
    console.log("HBAR price feed ID:", hbarPriceFeedId)
    
    // Try to get current Pyth prices
    const pyth = await ethers.getContractAt("IPyth", pythAddress)
    
    try {
      const linkPythPrice = await pyth.getPrice(linkPriceFeedId)
      console.log("LINK Pyth price:", linkPythPrice.price.toString())
      console.log("LINK Pyth exponent:", linkPythPrice.expo.toString())
      console.log("LINK Pyth publish time:", linkPythPrice.publishTime.toString())
      
      const hbarPythPrice = await pyth.getPrice(hbarPriceFeedId)
      console.log("HBAR Pyth price:", hbarPythPrice.price.toString())
      console.log("HBAR Pyth exponent:", hbarPythPrice.expo.toString())
      console.log("HBAR Pyth publish time:", hbarPythPrice.publishTime.toString())
      
    } catch (pythError) {
      console.log("❌ Error getting Pyth prices:", pythError.message)
      console.log("This might be because Pyth prices are not available or need to be updated")
    }
    
    // Try to update prices using Pyth
    console.log("\n=== Attempting to Update Prices via Pyth ===")
    
    // Create mock price update data (this is a simplified approach)
    // In a real scenario, you would get this data from Pyth network
    const mockUpdateData = [
      "0x0000000000000000000000000000000000000000000000000000000000000001" // Mock data
    ]
    
    try {
      // Get update fee
      const updateFee = await pyth.getUpdateFee(mockUpdateData)
      console.log("Update fee:", ethers.utils.formatEther(updateFee), "ETH")
      
      // Try to update prices
      await sendTxn(
        fastPriceFeed.setPricesWithData(mockUpdateData, { value: updateFee }),
        "Update prices via Pyth"
      )
      
      console.log("✅ Prices updated via Pyth!")
      
    } catch (updateError) {
      console.log("❌ Error updating prices via Pyth:", updateError.message)
      console.log("This might be because:")
      console.log("1. Mock update data is invalid")
      console.log("2. Pyth network is not available on Hedera testnet")
      console.log("3. Price feed IDs are incorrect")
      
      // Try alternative approach - use MockPyth if available
      console.log("\n=== Trying Alternative Approach ===")
      
      try {
        // Check if this is a MockPyth contract
        const mockPyth = await ethers.getContractAt("MockPyth", pythAddress)
        
        // Set realistic prices in MockPyth
        console.log("Setting realistic prices in MockPyth...")
        
        // LINK: $15 with 8 decimals (1500000000)
        await sendTxn(
          mockPyth.setPrice(linkPriceFeedId, 1500000000, -8, Math.floor(Date.now() / 1000)),
          "Set LINK price in MockPyth"
        )
        
        // HBAR: $0.05 with 8 decimals (5000000)
        await sendTxn(
          mockPyth.setPrice(hbarPriceFeedId, 5000000, -8, Math.floor(Date.now() / 1000)),
          "Set HBAR price in MockPyth"
        )
        
        console.log("✅ Prices set in MockPyth!")
        
        // Now try to update FastPriceFeed
        const emptyUpdateData = []
        const updateFee = await pyth.getUpdateFee(emptyUpdateData)
        
        await sendTxn(
          fastPriceFeed.setPricesWithData(emptyUpdateData, { value: updateFee }),
          "Update prices from MockPyth"
        )
        
        console.log("✅ Prices updated from MockPyth!")
        
      } catch (mockError) {
        console.log("❌ MockPyth approach failed:", mockError.message)
      }
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
