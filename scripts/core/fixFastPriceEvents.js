const { contractAt, readTmpAddresses, sendTxn } = require("../shared/helpers")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Read deployed addresses
  const addresses = readTmpAddresses()
  
  console.log("🔧 Fixing FastPriceEvents Authorization")
  console.log("Network:", network)
  console.log("Signer:", signer.address)
  
  try {
    // Get contracts
    const fastPriceFeed = await contractAt("FastPriceFeed", addresses.secondaryPriceFeed)
    const fastPriceEvents = await contractAt("FastPriceEvents", addresses.fastPriceEvents)
    
    console.log("FastPriceFeed address:", fastPriceFeed.address)
    console.log("FastPriceEvents address:", fastPriceEvents.address)
    
    // Check if FastPriceFeed is authorized to emit events
    const isPriceFeed = await fastPriceEvents.isPriceFeed(fastPriceFeed.address)
    console.log("FastPriceFeed is authorized in FastPriceEvents:", isPriceFeed)
    
    // Check if signer is governance of FastPriceEvents
    const gov = await fastPriceEvents.gov()
    console.log("FastPriceEvents governance:", gov)
    console.log("Signer is governance:", signer.address === gov)
    
    if (signer.address === gov) {
      if (!isPriceFeed) {
        console.log("Adding FastPriceFeed as authorized price feed...")
        
        await sendTxn(
          fastPriceEvents.setIsPriceFeed(fastPriceFeed.address, true),
          "Add FastPriceFeed as authorized price feed"
        )
        
        console.log("✅ FastPriceFeed authorized in FastPriceEvents!")
      } else {
        console.log("✅ FastPriceFeed is already authorized in FastPriceEvents")
      }
    } else {
      console.log("❌ Signer is not governance of FastPriceEvents")
      console.log("Need governance access to authorize FastPriceFeed")
    }
    
    // Verify the authorization
    const newIsPriceFeed = await fastPriceEvents.isPriceFeed(fastPriceFeed.address)
    console.log("FastPriceFeed authorization status:", newIsPriceFeed)
    
    if (newIsPriceFeed) {
      console.log("✅ FastPriceEvents authorization fixed!")
      console.log("Now the Pyth price updates should work!")
    } else {
      console.log("❌ FastPriceEvents authorization still not fixed")
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
