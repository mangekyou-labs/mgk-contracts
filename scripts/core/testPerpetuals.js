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
  const { nativeToken, link } = tokens
  
  console.log("🔥 Testing Perpetual Trading (Long/Short Positions)")
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
  
  // Get current LINK price
  const linkPrice = await vault.getMinPrice(link.address)
  console.log("LINK price:", ethers.utils.formatUnits(linkPrice, 30))
  
  // Test 1: Open Long Position (bullish on LINK)
  try {
    console.log("\n🟢 === Test 1: Opening LONG Position on LINK ===")
    
    const collateralAmount = expandDecimals(1, 18) // 1 LINK as collateral
    const sizeDelta = expandDecimals(5, 18)       // 5 LINK position size (5x leverage)
    const isLong = true
    const acceptablePrice = linkPrice.mul(101).div(100) // 1% slippage
    
    console.log(`Opening LONG position:`)
    console.log(`- Collateral: ${ethers.utils.formatEther(collateralAmount)} LINK`)
    console.log(`- Position size: ${ethers.utils.formatEther(sizeDelta)} LINK`)
    console.log(`- Leverage: ~5x`)
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
        link.address,       // collateralToken
        link.address,       // indexToken (same as collateral for simplicity)
        sizeDelta,          // sizeDelta
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
    console.log(`- Size: ${ethers.utils.formatEther(position[0])}`)
    console.log(`- Collateral: ${ethers.utils.formatEther(position[1])}`)
    console.log(`- Average Price: ${ethers.utils.formatUnits(position[2], 30)}`)
    console.log(`- Entry Funding Rate: ${position[3]}`)
    console.log(`- Reserve Amount: ${ethers.utils.formatEther(position[4])}`)
    
  } catch (error) {
    console.log("❌ Long position error:", error.message)
  }
  
  // Test 2: Open Short Position (bearish on LINK)
  try {
    console.log("\n🔴 === Test 2: Opening SHORT Position on LINK ===")
    
    const collateralAmount = expandDecimals(1, 18) // 1 LINK as collateral
    const sizeDelta = expandDecimals(3, 18)       // 3 LINK position size (3x leverage)
    const isLong = false
    const acceptablePrice = linkPrice.mul(99).div(100) // 1% slippage (lower for shorts)
    
    console.log(`Opening SHORT position:`)
    console.log(`- Collateral: ${ethers.utils.formatEther(collateralAmount)} LINK`)
    console.log(`- Position size: ${ethers.utils.formatEther(sizeDelta)} LINK`)
    console.log(`- Leverage: ~3x`)
    console.log(`- Acceptable price: ${ethers.utils.formatUnits(acceptablePrice, 30)}`)
    
    // Transfer collateral to vault first
    await sendTxn(
      linkContract.transfer(vault.address, collateralAmount),
      "Transfer LINK collateral to vault"
    )
    
    // Open short position
    await sendTxn(
      vault.increasePosition(
        signer.address,     // account
        link.address,       // collateralToken
        link.address,       // indexToken
        sizeDelta,          // sizeDelta
        isLong              // isLong (false = short)
      ),
      "Open SHORT position"
    )
    
    // Check position
    const positionKey = ethers.utils.solidityKeccak256(
      ["address", "address", "address", "bool"],
      [signer.address, link.address, link.address, isLong]
    )
    
    const position = await vault.positions(positionKey)
    console.log("✅ SHORT Position opened:")
    console.log(`- Size: ${ethers.utils.formatEther(position[0])}`)
    console.log(`- Collateral: ${ethers.utils.formatEther(position[1])}`)
    console.log(`- Average Price: ${ethers.utils.formatUnits(position[2], 30)}`)
    console.log(`- Entry Funding Rate: ${position[3]}`)
    console.log(`- Reserve Amount: ${ethers.utils.formatEther(position[4])}`)
    
  } catch (error) {
    console.log("❌ Short position error:", error.message)
  }
  
  // Test 3: Check Global Position Stats
  try {
    console.log("\n📊 === Global Position Statistics ===")
    
    const globalLongSizes = await vault.globalLongSizes(link.address)
    const globalShortSizes = await vault.globalShortSizes(link.address)
    const guaranteedUsd = await vault.guaranteedUsd(link.address)
    const reservedAmounts = await vault.reservedAmounts(link.address)
    
    console.log("Global long sizes:", ethers.utils.formatEther(globalLongSizes))
    console.log("Global short sizes:", ethers.utils.formatEther(globalShortSizes))
    console.log("Guaranteed USD:", ethers.utils.formatEther(guaranteedUsd))
    console.log("Reserved amounts:", ethers.utils.formatEther(reservedAmounts))
    
  } catch (error) {
    console.log("❌ Statistics error:", error.message)
  }
  
  // Test 4: Calculate Position P&L
  try {
    console.log("\n💰 === Position P&L Calculation ===")
    
    // Check long position P&L
    const longPositionKey = ethers.utils.solidityKeccak256(
      ["address", "address", "address", "bool"],
      [signer.address, link.address, link.address, true]
    )
    
    const longPnl = await vault.getPositionDelta(
      signer.address, link.address, link.address, true
    )
    
    console.log("LONG Position P&L:")
    console.log("- Has profit:", longPnl[0])
    console.log("- Delta:", ethers.utils.formatEther(longPnl[1]))
    
    // Check short position P&L
    const shortPnl = await vault.getPositionDelta(
      signer.address, link.address, link.address, false
    )
    
    console.log("SHORT Position P&L:")
    console.log("- Has profit:", shortPnl[0])
    console.log("- Delta:", ethers.utils.formatEther(shortPnl[1]))
    
  } catch (error) {
    console.log("❌ P&L calculation error:", error.message)
  }
  
  // Final state
  console.log("\n=== Final State ===")
  const finalLinkBalance = await linkContract.balanceOf(signer.address)
  const finalPoolAmount = await vault.poolAmounts(link.address)
  
  console.log("Final LINK wallet balance:", ethers.utils.formatEther(finalLinkBalance))
  console.log("Final LINK pool amount:", ethers.utils.formatEther(finalPoolAmount))
  
  console.log("\n🎯 Perpetual trading test completed!")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
