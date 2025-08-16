const { contractAt, readTmpAddresses } = require("../shared/helpers")
const { createPublicClient, http } = require("viem")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');
const tokens = require('./tokens')[network];

// Hedera testnet configuration
const HEDERA_TESTNET_RPC = "https://pool.arkhia.io/hedera/testnet/json-rpc/v1/O9naeyykn6a90d7hfb4yOd5aeb3b024f"
const PYTH_CONTRACT_HEDERA = "0xa2aa501b19aff244d90cc15a4cf739d2725b5729"
const HERMES_ENDPOINT = "https://hermes.pyth.network"

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Read deployed addresses
  const addresses = readTmpAddresses()
  
  console.log("🔍 Checking Pyth Prices and Understanding the Issue")
  console.log("Network:", network)
  console.log("Signer:", signer.address)
  
  try {
    // Get contracts
    const vault = await contractAt("Vault", addresses.vault)
    const fastPriceFeed = await contractAt("FastPriceFeed", addresses.secondaryPriceFeed)
    const vaultPriceFeed = await contractAt("VaultPriceFeed", addresses.vaultPriceFeed)
    
    console.log("Vault address:", vault.address)
    console.log("FastPriceFeed address:", fastPriceFeed.address)
    console.log("VaultPriceFeed address:", vaultPriceFeed.address)
    console.log("Pyth contract address:", PYTH_CONTRACT_HEDERA)
    
    // Get price feed IDs
    const { link, nativeToken } = tokens
    const linkPriceFeedId = await fastPriceFeed.priceFeedIds(link.address)
    const hbarPriceFeedId = await fastPriceFeed.priceFeedIds(nativeToken.address)
    
    console.log("\n=== Price Feed IDs ===")
    console.log("LINK price feed ID:", linkPriceFeedId)
    console.log("HBAR price feed ID:", hbarPriceFeedId)
    
    // Get prices directly from Pyth contract
    console.log("\n=== Direct Pyth Contract Prices ===")
    
    try {
      const pyth = await ethers.getContractAt("IPyth", PYTH_CONTRACT_HEDERA)
      
      const linkPythPrice = await pyth.getPrice(linkPriceFeedId)
      console.log("LINK Pyth price:")
      console.log("  Price:", linkPythPrice.price.toString())
      console.log("  Confidence:", linkPythPrice.confidence.toString())
      console.log("  Expo:", linkPythPrice.expo)
      console.log("  Publish time:", new Date(linkPythPrice.publishTime * 1000).toISOString())
      
      const hbarPythPrice = await pyth.getPrice(hbarPriceFeedId)
      console.log("HBAR Pyth price:")
      console.log("  Price:", hbarPythPrice.price.toString())
      console.log("  Confidence:", hbarPythPrice.confidence.toString())
      console.log("  Expo:", hbarPythPrice.expo)
      console.log("  Publish time:", new Date(hbarPythPrice.publishTime * 1000).toISOString())
      
      // Calculate actual USD prices
      const linkUsdPrice = linkPythPrice.price.mul(ethers.BigNumber.from(10).pow(linkPythPrice.expo))
      const hbarUsdPrice = hbarPythPrice.price.mul(ethers.BigNumber.from(10).pow(hbarPythPrice.expo))
      
      console.log("\n=== Calculated USD Prices ===")
      console.log("LINK USD price:", ethers.utils.formatUnits(linkUsdPrice, 8), "USD")
      console.log("HBAR USD price:", ethers.utils.formatUnits(hbarUsdPrice, 8), "USD")
      
    } catch (pythError) {
      console.log("❌ Error getting prices from Pyth contract:", pythError.message)
    }
    
    // Get prices from Vault
    console.log("\n=== Vault Prices ===")
    const vaultLinkPrice = await vault.getMinPrice(link.address)
    const vaultHbarPrice = await vault.getMinPrice(nativeToken.address)
    
    console.log("Vault LINK price:", ethers.utils.formatUnits(vaultLinkPrice, 30))
    console.log("Vault HBAR price:", ethers.utils.formatUnits(vaultHbarPrice, 30))
    
    // Get prices from FastPriceFeed using the correct interface
    console.log("\n=== FastPriceFeed Prices ===")
    try {
      // FastPriceFeed doesn't have a direct getPrice function, but we can check if it has recent data
      const lastUpdatedAt = await fastPriceFeed.lastUpdatedAt()
      const lastUpdatedBlock = await fastPriceFeed.lastUpdatedBlock()
      
      console.log("FastPriceFeed last updated at:", new Date(lastUpdatedAt * 1000).toISOString())
      console.log("FastPriceFeed last updated block:", lastUpdatedBlock.toString())
      
      const currentTime = Math.floor(Date.now() / 1000)
      const timeDiff = currentTime - lastUpdatedAt.toNumber()
      console.log("Time since last update:", timeDiff, "seconds")
      
      if (timeDiff < 300) { // 5 minutes
        console.log("✅ FastPriceFeed has recent price data")
      } else {
        console.log("⚠️ FastPriceFeed price data may be stale")
      }
      
    } catch (fastPriceError) {
      console.log("❌ Error getting data from FastPriceFeed:", fastPriceError.message)
    }
    
    // Check VaultPriceFeed configuration
    console.log("\n=== VaultPriceFeed Configuration ===")
    
    const isSecondaryPriceEnabled = await vaultPriceFeed.isSecondaryPriceEnabled()
    const secondaryPriceFeed = await vaultPriceFeed.secondaryPriceFeed()
    
    console.log("Secondary price feed enabled:", isSecondaryPriceEnabled)
    console.log("Secondary price feed address:", secondaryPriceFeed)
    console.log("FastPriceFeed address:", fastPriceFeed.address)
    console.log("Addresses match:", secondaryPriceFeed === fastPriceFeed.address)
    
    // Check which price feed is being used
    console.log("\n=== Price Feed Usage Analysis ===")
    
    if (isSecondaryPriceEnabled && secondaryPriceFeed === fastPriceFeed.address) {
      console.log("✅ Secondary price feed (FastPriceFeed) is enabled and should be used")
      
      // Check if FastPriceFeed has recent prices
      const lastUpdatedAt = await fastPriceFeed.lastUpdatedAt()
      const currentTime = Math.floor(Date.now() / 1000)
      const timeDiff = currentTime - lastUpdatedAt.toNumber()
      
      console.log("Last updated at:", new Date(lastUpdatedAt * 1000).toISOString())
      console.log("Time since last update:", timeDiff, "seconds")
      
      if (timeDiff < 300) { // 5 minutes
        console.log("✅ FastPriceFeed has recent prices")
      } else {
        console.log("⚠️ FastPriceFeed prices may be stale")
      }
    } else {
      console.log("❌ Secondary price feed not properly configured")
    }
    
    // Check if we need to wait for price updates or if there's a configuration issue
    console.log("\n=== Diagnosis ===")
    
    if (vaultLinkPrice.lt(ethers.utils.parseUnits("1", 30))) {
      console.log("❌ LINK price is still very low in Vault")
      console.log("This suggests the Vault is still using the primary price feed (Chainlink)")
      console.log("The FastPriceFeed prices may not be taking effect")
    } else {
      console.log("✅ LINK price looks reasonable in Vault")
    }
    
    if (vaultHbarPrice.lt(ethers.utils.parseUnits("0.01", 30))) {
      console.log("❌ HBAR price is still very low in Vault")
      console.log("This suggests the Vault is still using the primary price feed (Chainlink)")
    } else {
      console.log("✅ HBAR price looks reasonable in Vault")
    }
    
    // Check if the Vault is actually using the VaultPriceFeed
    console.log("\n=== Vault Price Feed Check ===")
    const vaultPriceFeedAddress = await vault.priceFeed()
    console.log("Vault's price feed address:", vaultPriceFeedAddress)
    console.log("VaultPriceFeed address:", vaultPriceFeed.address)
    console.log("Vault is using VaultPriceFeed:", vaultPriceFeedAddress === vaultPriceFeed.address)
    
    if (vaultPriceFeedAddress === vaultPriceFeed.address) {
      console.log("✅ Vault is correctly using VaultPriceFeed")
      
      // Test getting price through VaultPriceFeed
      try {
        const vpfLinkPrice = await vaultPriceFeed.getPrice(link.address, false, false, false)
        console.log("VaultPriceFeed LINK price:", ethers.utils.formatUnits(vpfLinkPrice, 30))
        
        if (vpfLinkPrice.gt(ethers.utils.parseUnits("1", 30))) {
          console.log("✅ VaultPriceFeed is returning reasonable LINK price")
        } else {
          console.log("❌ VaultPriceFeed is still returning low LINK price")
        }
      } catch (vpfError) {
        console.log("❌ Error getting price from VaultPriceFeed:", vpfError.message)
      }
    } else {
      console.log("❌ Vault is not using VaultPriceFeed - this is the problem!")
    }
    
    console.log("\n=== Next Steps ===")
    console.log("1. The Pyth price update transaction succeeded")
    console.log("2. But the Vault is still showing low prices")
    console.log("3. This suggests the Vault may still be using the primary price feed")
    console.log("4. We may need to check the VaultPriceFeed logic or wait for price propagation")
    
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
