const { contractAt, readTmpAddresses, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');
const tokens = require('./tokens')[network];

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Read deployed addresses
  const addresses = readTmpAddresses()
  
  console.log("🔧 Setting Realistic Prices via Pyth Network")
  console.log("Network:", network)
  console.log("Signer:", signer.address)
  
  try {
    // Get contracts
    const vault = await contractAt("Vault", addresses.vault)
    const vaultPriceFeed = await contractAt("VaultPriceFeed", addresses.vaultPriceFeed)
    const secondaryPriceFeed = await contractAt("FastPriceFeed", addresses.secondaryPriceFeed)
    
    console.log("Vault address:", vault.address)
    console.log("VaultPriceFeed address:", vaultPriceFeed.address)
    console.log("Secondary price feed address:", secondaryPriceFeed.address)
    
    // Check current prices
    const { link, nativeToken } = tokens
    const currentLinkPrice = await vault.getMinPrice(link.address)
    const currentHbarPrice = await vault.getMinPrice(nativeToken.address)
    
    console.log("\n=== Current Prices ===")
    console.log("LINK price:", ethers.utils.formatUnits(currentLinkPrice, 30))
    console.log("HBAR price:", ethers.utils.formatUnits(currentHbarPrice, 30))
    
    // Check if secondary price feed is configured
    const secondaryPriceFeedAddr = await vaultPriceFeed.secondaryPriceFeed()
    console.log("Secondary price feed in VaultPriceFeed:", secondaryPriceFeedAddr)
    
    if (secondaryPriceFeedAddr === ethers.constants.AddressZero) {
      console.log("❌ Secondary price feed not configured in VaultPriceFeed")
      console.log("Configuring secondary price feed...")
      
      await sendTxn(
        vaultPriceFeed.setSecondaryPriceFeed(secondaryPriceFeed.address),
        "Set secondary price feed"
      )
      console.log("✅ Secondary price feed configured!")
    }
    
    // Check if secondary price feed is enabled
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
    
    // Check if we're an updater for the FastPriceFeed
    const isUpdater = await secondaryPriceFeed.isUpdater(signer.address)
    console.log("Signer is updater:", isUpdater)
    
    if (!isUpdater) {
      console.log("❌ Signer is not an updater for FastPriceFeed")
      console.log("This means we cannot update prices via Pyth")
      console.log("Need to be added as updater by governance")
      return
    }
    
    // Get Pyth configuration
    const pythAddress = await secondaryPriceFeed.pyth()
    console.log("Pyth address:", pythAddress)
    
    // Get price feed IDs
    const linkPriceFeedId = await secondaryPriceFeed.priceFeedIds(link.address)
    const hbarPriceFeedId = await secondaryPriceFeed.priceFeedIds(nativeToken.address)
    
    console.log("LINK price feed ID:", linkPriceFeedId)
    console.log("HBAR price feed ID:", hbarPriceFeedId)
    
    // Try to get current Pyth prices
    const pyth = await contractAt("IPyth", pythAddress)
    
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
        secondaryPriceFeed.setPricesWithData(mockUpdateData, { value: updateFee }),
        "Update prices via Pyth"
      )
      
      console.log("✅ Prices updated via Pyth!")
      
    } catch (updateError) {
      console.log("❌ Error updating prices via Pyth:", updateError.message)
      console.log("This might be because:")
      console.log("1. Mock update data is invalid")
      console.log("2. Pyth network is not available on Hedera testnet")
      console.log("3. Price feed IDs are incorrect")
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
