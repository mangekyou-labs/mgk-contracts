const { contractAt, readTmpAddresses, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');
const tokens = require('./tokens')[network];

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Read deployed addresses
  const addresses = readTmpAddresses()
  
  // Get contracts
  const vault = await contractAt("Vault", addresses.vault)
  const router = await contractAt("Router", addresses.router)
  
  // Get token addresses
  const { nativeToken, link, usdc } = tokens
  
  console.log("🔥 Testing Perpetual Trading (Long/Short Positions) - FIXED")
  console.log("Signer address:", signer.address)
  console.log("Vault address:", vault.address)
  console.log("Router address:", router.address)
  
  // Check initial state
  console.log("\n=== Initial State ===")
  const linkContract = await ethers.getContractAt("IERC20", link.address)
  const linkBalance = await linkContract.balanceOf(signer.address)
  const linkPoolAmount = await vault.poolAmounts(link.address)
  
  console.log("LINK wallet balance:", ethers.utils.formatEther(linkBalance))
  console.log("LINK pool amount:", ethers.utils.formatEther(linkPoolAmount))
  
  // Get current LINK price (in 30 decimals)
  const linkPrice = await vault.getMinPrice(link.address)
  console.log("LINK price (raw):", linkPrice.toString())
  console.log("LINK price (formatted):", ethers.utils.formatUnits(linkPrice, 30))
  
  // Test 1: Open Long Position (LINK collateral, LINK index)
  try {
    console.log("\n🟢 === Test 1: Opening LONG Position on LINK ===")
    
    const collateralAmount = expandDecimals(2, 18) // 2 LINK as collateral
    // Calculate size in USD (30 decimals)
    // sizeDelta should be in USD value (price * amount * 30 decimals)
    const leverageMultiplier = 3 // 3x leverage
    const sizeInUsd = linkPrice.mul(collateralAmount).mul(leverageMultiplier).div(expandDecimals(1, 18))
    
    const isLong = true
    const acceptablePrice = linkPrice.mul(102).div(100) // 2% slippage
    
    console.log(`Opening LONG position:`)
    console.log(`- Collateral: ${ethers.utils.formatEther(collateralAmount)} LINK`)
    console.log(`- Size (USD): ${ethers.utils.formatUnits(sizeInUsd, 30)}`)
    console.log(`- Leverage: ${leverageMultiplier}x`)
    console.log(`- Acceptable price: ${ethers.utils.formatUnits(acceptablePrice, 30)}`)
    
    // Transfer collateral to vault first
    await sendTxn(
      linkContract.transfer(vault.address, collateralAmount),
      "Transfer LINK collateral to vault"
    )
    
    // Open long position
    await sendTxn(
      vault.increasePosition(
        signer.address,     // account
        link.address,       // collateralToken (LINK for longs)
        link.address,       // indexToken 
        sizeInUsd,         // sizeDelta (in USD with 30 decimals)
        isLong              // isLong
      ),
      "Open LONG position"
    )
    
    // Check position
    const positionKey = ethers.utils.solidityKeccak256(
      ["address", "address", "address", "bool"],
      [signer.address, link.address, link.address, isLong]
    )
    
    const position = await vault.positions(positionKey)
    console.log("✅ LONG Position opened:")
    console.log(`- Size: ${ethers.utils.formatUnits(position[0], 30)}`)
    console.log(`- Collateral: ${ethers.utils.formatUnits(position[1], 30)}`)
    console.log(`- Average Price: ${ethers.utils.formatUnits(position[2], 30)}`)
    console.log(`- Entry Funding Rate: ${position[3]}`)
    console.log(`- Reserve Amount: ${ethers.utils.formatEther(position[4])}`)
    
  } catch (error) {
    console.log("❌ Long position error:", error.message)
  }
  
  // Test 2: Add USDC for short positions (shorts need stable collateral)
  try {
    console.log("\n💰 === Setting up USDC for Short Positions ===")
    
    // First, we need some USDC - let's buy some with LINK
    const linkForUsdc = expandDecimals(1, 18) // 1 LINK
    console.log(`Converting ${ethers.utils.formatEther(linkForUsdc)} LINK to USDG...`)
    
    // Transfer LINK to vault
    await sendTxn(
      linkContract.transfer(vault.address, linkForUsdc),
      "Transfer LINK for USDG"
    )
    
    // Buy USDG with LINK
    await sendTxn(
      vault.buyUSDG(link.address, signer.address),
      "Buy USDG with LINK"
    )
    
    // Check USDG balance
    const usdgAddress = await vault.usdg()
    const usdgContract = await ethers.getContractAt("IERC20", usdgAddress)
    const usdgBalance = await usdgContract.balanceOf(signer.address)
    console.log("USDG balance:", ethers.utils.formatEther(usdgBalance))
    
  } catch (error) {
    console.log("❌ USDC setup error:", error.message)
  }
  
  // Test 3: Check what we can do with the vault
  try {
    console.log("\n📊 === Vault State Analysis ===")
    
    // Check reserved amounts for LINK
    const reservedAmounts = await vault.reservedAmounts(link.address)
    console.log("LINK reserved amounts:", ethers.utils.formatEther(reservedAmounts))
    
    // Check guaranteed USD
    const guaranteedUsd = await vault.guaranteedUsd(link.address)
    console.log("LINK guaranteed USD:", ethers.utils.formatUnits(guaranteedUsd, 30))
    
    // Check if there are any positions
    const longPositionKey = ethers.utils.solidityKeccak256(
      ["address", "address", "address", "bool"],
      [signer.address, link.address, link.address, true]
    )
    
    const longPosition = await vault.positions(longPositionKey)
    if (longPosition[0].gt(0)) {
      console.log("Found LONG position:")
      console.log(`- Size: ${ethers.utils.formatUnits(longPosition[0], 30)} USD`)
      console.log(`- Collateral: ${ethers.utils.formatUnits(longPosition[1], 30)} USD`)
      
      // Try to get position delta
      try {
        const delta = await vault.getPositionDelta(
          signer.address, link.address, link.address, true
        )
        console.log(`- Has profit: ${delta[0]}`)
        console.log(`- Delta: ${ethers.utils.formatUnits(delta[1], 30)} USD`)
      } catch (deltaError) {
        console.log("- Delta calculation failed:", deltaError.message)
      }
    } else {
      console.log("No LONG position found")
    }
    
  } catch (error) {
    console.log("❌ Analysis error:", error.message)
  }
  
  // Test 4: Try position closure
  try {
    console.log("\n🔄 === Testing Position Management ===")
    
    // Check if we have a position to close
    const longPositionKey = ethers.utils.solidityKeccak256(
      ["address", "address", "address", "bool"],
      [signer.address, link.address, link.address, true]
    )
    
    const longPosition = await vault.positions(longPositionKey)
    if (longPosition[0].gt(0)) {
      console.log("Attempting to partially close LONG position...")
      
      const closeSize = longPosition[0].div(2) // Close half the position
      const currentPrice = await vault.getMaxPrice(link.address)
      const minPrice = currentPrice.mul(98).div(100) // 2% slippage
      
      console.log(`- Closing size: ${ethers.utils.formatUnits(closeSize, 30)} USD`)
      console.log(`- Min acceptable price: ${ethers.utils.formatUnits(minPrice, 30)}`)
      
      await sendTxn(
        vault.decreasePosition(
          signer.address,     // account
          link.address,       // collateralToken
          link.address,       // indexToken
          0,                  // collateralDelta (0 = don't remove collateral)
          closeSize,          // sizeDelta
          true,               // isLong
          signer.address      // receiver
        ),
        "Partially close LONG position"
      )
      
      console.log("✅ Position partially closed!")
      
    } else {
      console.log("No position to close")
    }
    
  } catch (error) {
    console.log("❌ Position management error:", error.message)
  }
  
  // Final state
  console.log("\n=== Final State ===")
  const finalLinkBalance = await linkContract.balanceOf(signer.address)
  const finalPoolAmount = await vault.poolAmounts(link.address)
  const finalReserved = await vault.reservedAmounts(link.address)
  
  console.log("Final LINK wallet balance:", ethers.utils.formatEther(finalLinkBalance))
  console.log("Final LINK pool amount:", ethers.utils.formatEther(finalPoolAmount))
  console.log("Final LINK reserved amount:", ethers.utils.formatEther(finalReserved))
  
  console.log("\n🎯 Perpetual trading test completed!")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
