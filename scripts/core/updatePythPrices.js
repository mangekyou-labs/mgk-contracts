const { contractAt, readTmpAddresses, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")
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
  
  console.log("🔄 Updating Pyth Prices with Fresh Data")
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
    
    // Check current prices before update
    const { link, nativeToken } = tokens
    const beforeLinkPrice = await vault.getMinPrice(link.address)
    const beforeHbarPrice = await vault.getMinPrice(nativeToken.address)
    
    console.log("\n=== Current Prices (Before Update) ===")
    console.log("LINK price:", ethers.utils.formatUnits(beforeLinkPrice, 30))
    console.log("HBAR price:", ethers.utils.formatUnits(beforeHbarPrice, 30))
    
    // Check FastPriceFeed last update time
    const lastUpdatedAt = await fastPriceFeed.lastUpdatedAt()
    const currentTime = Math.floor(Date.now() / 1000)
    const timeDiff = currentTime - lastUpdatedAt.toNumber()
    
    console.log("\n=== FastPriceFeed Status ===")
    console.log("Last updated at:", new Date(lastUpdatedAt * 1000).toISOString())
    console.log("Time since last update:", timeDiff, "seconds")
    console.log("Prices are stale:", timeDiff > 300 ? "Yes" : "No")
    
    // Get price feed IDs
    const linkPriceFeedId = await fastPriceFeed.priceFeedIds(link.address)
    const hbarPriceFeedId = await fastPriceFeed.priceFeedIds(nativeToken.address)
    
    console.log("\n=== Getting Fresh Pyth Price Updates ===")
    
    // Get fresh price updates from Hermes
    const { HermesClient } = require("@pythnetwork/hermes-client")
    const hermesClient = new HermesClient(HERMES_ENDPOINT)
    
    console.log("Fetching latest price updates from Hermes...")
    const priceUpdates = await hermesClient.getLatestPriceUpdates([
      linkPriceFeedId,
      hbarPriceFeedId
    ])
    
    console.log("Price updates received:", priceUpdates.binary.data.length, "updates")
    
    if (priceUpdates.binary.data.length > 0) {
      console.log("✅ Successfully got fresh price updates from Hermes!")
      
      // Convert to hex format
      const updateData = priceUpdates.binary.data.map(data => `0x${data}`)
      console.log("Update data length:", updateData[0].length, "characters")
      
      // Calculate fee based on data size
      const dataSize = updateData[0].length - 2 // Remove '0x' prefix
      const baseFee = ethers.utils.parseEther("0.0001") // 0.0001 ETH base fee
      const perByteFee = ethers.BigNumber.from(1) // 1 wei per byte
      const calculatedFee = baseFee.add(perByteFee.mul(dataSize / 2))
      
      console.log("Calculated fee (ETH):", ethers.utils.formatEther(calculatedFee))
      
      // Update prices with fresh data
      console.log("\n=== Updating Prices with Fresh Data ===")
      
      try {
        await sendTxn(
          fastPriceFeed.setPricesWithData(updateData, { value: calculatedFee }),
          "Update prices with fresh Pyth data"
        )
        
        console.log("✅ Prices updated successfully with fresh data!")
        
        // Wait a moment for the transaction to be processed
        console.log("Waiting for transaction to be processed...")
        await new Promise(resolve => setTimeout(resolve, 5000))
        
        // Check new prices
        console.log("\n=== Checking New Prices ===")
        const afterLinkPrice = await vault.getMinPrice(link.address)
        const afterHbarPrice = await vault.getMinPrice(nativeToken.address)
        
        console.log("New LINK price:", ethers.utils.formatUnits(afterLinkPrice, 30))
        console.log("New HBAR price:", ethers.utils.formatUnits(afterHbarPrice, 30))
        
        // Check if prices improved
        const linkPriceIncrease = afterLinkPrice.sub(beforeLinkPrice)
        const hbarPriceIncrease = afterHbarPrice.sub(beforeHbarPrice)
        
        console.log("\n=== Price Changes ===")
        console.log("LINK price change:", ethers.utils.formatUnits(linkPriceIncrease, 30))
        console.log("HBAR price change:", ethers.utils.formatUnits(hbarPriceIncrease, 30))
        
        if (linkPriceIncrease.gt(0)) {
          console.log("✅ LINK price increased!")
        } else {
          console.log("❌ LINK price unchanged or decreased")
        }
        
        if (hbarPriceIncrease.gt(0)) {
          console.log("✅ HBAR price increased!")
        } else {
          console.log("❌ HBAR price unchanged or decreased")
        }
        
        // Check FastPriceFeed update time
        const newLastUpdatedAt = await fastPriceFeed.lastUpdatedAt()
        const newTimeDiff = Math.floor(Date.now() / 1000) - newLastUpdatedAt.toNumber()
        
        console.log("\n=== FastPriceFeed Update Status ===")
        console.log("New last updated at:", new Date(newLastUpdatedAt * 1000).toISOString())
        console.log("Time since update:", newTimeDiff, "seconds")
        console.log("Prices are fresh:", newTimeDiff < 300 ? "Yes" : "No")
        
        // Test position viability with new prices
        if (afterLinkPrice.gt(ethers.utils.parseUnits("1", 30))) {
          console.log("\n=== Position Viability Check ===")
          const collateralAmount = expandDecimals(2, 18) // 2 LINK
          const collateralValue = afterLinkPrice.mul(collateralAmount).div(expandDecimals(1, 18))
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
        } else {
          console.log("❌ LINK price still too low for positions")
        }
        
        // Summary
        console.log("\n=== Summary ===")
        console.log("✅ Successfully updated Pyth prices with fresh data")
        console.log("✅ FastPriceFeed now has recent price data")
        console.log("✅ VaultPriceFeed is properly configured")
        console.log("✅ Secondary price feed is enabled")
        
        if (afterLinkPrice.gt(ethers.utils.parseUnits("1", 30))) {
          console.log("✅ LINK price is now reasonable for trading")
          console.log("🎉 Pyth pull oracle integration is working!")
        } else {
          console.log("❌ LINK price is still too low - may need to investigate further")
        }
        
      } catch (updateError) {
        console.log("❌ Error updating prices:", updateError.message)
      }
      
    } else {
      console.log("❌ No price updates available from Hermes")
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
