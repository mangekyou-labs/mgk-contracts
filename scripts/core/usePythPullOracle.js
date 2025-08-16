const { contractAt, readTmpAddresses, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")
const { fillPythUpdate, getUpdateFee } = require("@pythnetwork/pyth-evm-js")
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
  
  console.log("🔧 Using Pyth Pull Oracle to Get Real Prices")
  console.log("Network:", network)
  console.log("Signer:", signer.address)
  console.log("Pyth Contract:", PYTH_CONTRACT_HEDERA)
  console.log("Hermes Endpoint:", HERMES_ENDPOINT)
  
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
    
    // Check if signer is updater
    const isUpdater = await fastPriceFeed.isUpdater(signer.address)
    console.log("Signer is updater:", isUpdater)
    
    if (!isUpdater) {
      console.log("❌ Signer is not an updater - cannot update prices")
      return
    }
    
    // Get price feed IDs
    const linkPriceFeedId = await fastPriceFeed.priceFeedIds(link.address)
    const hbarPriceFeedId = await fastPriceFeed.priceFeedIds(nativeToken.address)
    
    console.log("LINK price feed ID:", linkPriceFeedId)
    console.log("HBAR price feed ID:", hbarPriceFeedId)
    
    // Create Viem client for Hedera testnet
    const client = createPublicClient({
      transport: http(HEDERA_TESTNET_RPC),
    })
    
    console.log("\n=== Getting Pyth Price Updates ===")
    
    // Method 1: Try to get price updates directly from Hermes
    try {
      const { HermesClient } = require("@pythnetwork/hermes-client")
      const hermesClient = new HermesClient(HERMES_ENDPOINT)
      
      console.log("Fetching latest price updates from Hermes...")
      const priceUpdates = await hermesClient.getLatestPriceUpdates([
        linkPriceFeedId,
        hbarPriceFeedId
      ])
      
      console.log("Price updates received:", priceUpdates)
      console.log("Number of updates:", priceUpdates.binary.data.length)
      
      if (priceUpdates.binary.data.length > 0) {
        console.log("✅ Successfully got price updates from Hermes!")
        
        // Convert to hex format
        const updateData = priceUpdates.binary.data.map(data => `0x${data}`)
        console.log("Update data:", updateData)
        
        // Get update fee
        const updateFee = await getUpdateFee(client, PYTH_CONTRACT_HEDERA, updateData)
        console.log("Update fee:", ethers.utils.formatEther(updateFee), "ETH")
        
        // Update prices in FastPriceFeed
        console.log("\n=== Updating Prices in FastPriceFeed ===")
        await sendTxn(
          fastPriceFeed.setPricesWithData(updateData, { value: updateFee }),
          "Update prices via Pyth pull oracle"
        )
        
        console.log("✅ Prices updated via Pyth pull oracle!")
        
      } else {
        console.log("❌ No price updates available from Hermes")
      }
      
    } catch (hermesError) {
      console.log("❌ Error getting price updates from Hermes:", hermesError.message)
    }
    
    // Method 2: Try to use fillPythUpdate for a dummy transaction
    console.log("\n=== Trying fillPythUpdate Method ===")
    
    try {
      // Create a dummy call to test fillPythUpdate
      const dummyCall = {
        to: fastPriceFeed.address,
        data: "0x", // Empty data
        from: signer.address,
      }
      
      console.log("Using fillPythUpdate to get required price updates...")
      const pythUpdate = await fillPythUpdate(
        client,
        dummyCall,
        PYTH_CONTRACT_HEDERA,
        HERMES_ENDPOINT,
        {
          method: "trace_callMany",
          maxIter: 3,
        }
      )
      
      if (pythUpdate) {
        console.log("✅ fillPythUpdate found required price updates!")
        console.log("Update data:", pythUpdate.updateData)
        console.log("Update fee:", ethers.utils.formatEther(pythUpdate.updateFee), "ETH")
        
        // Update prices in FastPriceFeed
        await sendTxn(
          fastPriceFeed.setPricesWithData(pythUpdate.updateData, { value: pythUpdate.updateFee }),
          "Update prices via fillPythUpdate"
        )
        
        console.log("✅ Prices updated via fillPythUpdate!")
        
      } else {
        console.log("❌ No Pyth updates needed for this transaction")
      }
      
    } catch (fillError) {
      console.log("❌ Error with fillPythUpdate:", fillError.message)
      console.log("This might be because Hedera testnet doesn't support trace_callMany")
    }
    
    // Method 3: Try to get prices directly from Pyth contract
    console.log("\n=== Getting Prices Directly from Pyth Contract ===")
    
    try {
      const pyth = await ethers.getContractAt("IPyth", PYTH_CONTRACT_HEDERA)
      
      // Try to get current prices
      const linkPythPrice = await pyth.getPrice(linkPriceFeedId)
      console.log("LINK Pyth price:", linkPythPrice.price.toString())
      console.log("LINK Pyth exponent:", linkPythPrice.expo.toString())
      console.log("LINK Pyth publish time:", linkPythPrice.publishTime.toString())
      
      const hbarPythPrice = await pyth.getPrice(hbarPriceFeedId)
      console.log("HBAR Pyth price:", hbarPythPrice.price.toString())
      console.log("HBAR Pyth exponent:", hbarPythPrice.expo.toString())
      console.log("HBAR Pyth publish time:", hbarPythPrice.publishTime.toString())
      
      // Check if prices are recent
      const currentTime = Math.floor(Date.now() / 1000)
      const linkAge = currentTime - linkPythPrice.publishTime
      const hbarAge = currentTime - hbarPythPrice.publishTime
      
      console.log("LINK price age:", linkAge, "seconds")
      console.log("HBAR price age:", hbarAge, "seconds")
      
      if (linkAge < 300 && hbarAge < 300) { // 5 minutes
        console.log("✅ Prices are recent!")
      } else {
        console.log("⚠️ Prices are stale, need to update")
      }
      
    } catch (pythError) {
      console.log("❌ Error getting prices from Pyth contract:", pythError.message)
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
    
    // Summary
    console.log("\n=== Summary ===")
    console.log("Pyth pull oracle integration attempted with:")
    console.log("1. Direct Hermes API calls")
    console.log("2. fillPythUpdate method")
    console.log("3. Direct Pyth contract calls")
    console.log("")
    console.log("If prices are still low, it might be because:")
    console.log("- Hedera testnet doesn't have active Pyth price feeds")
    console.log("- Price feed IDs are incorrect")
    console.log("- Network doesn't support required RPC methods")
    
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
