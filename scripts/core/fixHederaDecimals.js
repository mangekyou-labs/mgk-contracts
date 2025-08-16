const { contractAt, readTmpAddresses, sendTxn } = require("../shared/helpers")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');
const tokens = require('./tokens')[network];

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Read deployed addresses
  const addresses = readTmpAddresses()
  
  console.log("🔧 Fixing Hedera Price Decimals Configuration")
  console.log("Network:", network)
  console.log("Signer:", signer.address)
  
  try {
    // Get contracts
    const vaultPriceFeed = await contractAt("VaultPriceFeed", addresses.vaultPriceFeed)
    
    console.log("VaultPriceFeed address:", vaultPriceFeed.address)
    
    // Check current token configurations
    const { link, nativeToken } = tokens
    
    console.log("\n=== Current Token Configurations ===")
    console.log("LINK token:", link.address)
    console.log("LINK price feed:", link.priceFeed)
    console.log("LINK price decimals:", link.priceDecimals)
    console.log("LINK token decimals:", link.decimals)
    
    console.log("\nHBAR token:", nativeToken.address)
    console.log("HBAR price feed:", nativeToken.priceFeed)
    console.log("HBAR price decimals:", nativeToken.priceDecimals)
    console.log("HBAR token decimals:", nativeToken.decimals)
    
    // Check if signer is governance
    const gov = await vaultPriceFeed.gov()
    console.log("\nVaultPriceFeed governance:", gov)
    console.log("Signer is governance:", signer.address === gov)
    
    if (signer.address === gov) {
      console.log("\n=== Updating Token Configurations ===")
      
      // Update LINK configuration
      console.log("Updating LINK configuration...")
      await sendTxn(
        vaultPriceFeed.setTokenConfig(
          link.address,
          link.priceFeed,
          link.priceDecimals, // 8
          link.isStrictStable
        ),
        "Update LINK token config"
      )
      
      // Update HBAR configuration
      console.log("Updating HBAR configuration...")
      await sendTxn(
        vaultPriceFeed.setTokenConfig(
          nativeToken.address,
          nativeToken.priceFeed,
          nativeToken.priceDecimals, // 8
          nativeToken.isStrictStable
        ),
        "Update HBAR token config"
      )
      
      console.log("✅ Token configurations updated successfully!")
      
      // Verify the updates
      console.log("\n=== Verifying Updates ===")
      
      // Check if the price decimals are now correctly set
      const linkPriceDecimals = await vaultPriceFeed.priceDecimals(link.address)
      const hbarPriceDecimals = await vaultPriceFeed.priceDecimals(nativeToken.address)
      
      console.log("LINK price decimals in contract:", linkPriceDecimals.toString())
      console.log("HBAR price decimals in contract:", hbarPriceDecimals.toString())
      console.log("Expected price decimals: 8")
      
      if (linkPriceDecimals.toString() === "8" && hbarPriceDecimals.toString() === "8") {
        console.log("✅ Price decimals are now correctly configured!")
        console.log("🎉 The division by zero error should be fixed!")
        console.log("Ready to test Pyth price updates again!")
      } else {
        console.log("❌ Price decimals are still incorrect")
      }
      
    } else {
      console.log("❌ Signer is not governance of VaultPriceFeed")
      console.log("Need governance access to update token configurations")
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
