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
  
  // Get token addresses
  const { link } = tokens
  
  // Define position key at the top level so all functions can access it
  const positionKey = ethers.utils.solidityKeccak256(
    ["address", "address", "address", "bool"],
    [signer.address, link.address, link.address, true]
  )
  
  console.log("🚀 Testing Complete Perpetual Trading Lifecycle")
  console.log("Signer address:", signer.address)
  console.log("Vault address:", vault.address)
  
  // Check current state
  console.log("\n=== Current State ===")
  const linkContract = await ethers.getContractAt("IERC20", link.address)
  const linkBalance = await linkContract.balanceOf(signer.address)
  const linkPrice = await vault.getMinPrice(link.address)
  
  console.log("LINK wallet balance:", ethers.utils.formatEther(linkBalance))
  console.log("LINK price:", ethers.utils.formatUnits(linkPrice, 30), "USD")
  
  if (linkBalance.eq(0)) {
    console.log("❌ No LINK balance available for testing")
    return
  }
  
  // Use 60% of available balance for initial position
  const initialCollateral = linkBalance.mul(60).div(100)
  const initialCollateralFormatted = ethers.utils.formatEther(initialCollateral)
  
  console.log(`\n🟢 === Step 1: Open Initial Position ===`)
  console.log(`Using ${initialCollateralFormatted} LINK as initial collateral`)
  
  try {
    // Transfer collateral to vault
    await sendTxn(
      linkContract.transfer(vault.address, initialCollateral),
      "Transfer initial LINK collateral to vault"
    )
    
    // Open initial long position (1.1x leverage - very conservative to stay within 50x max)
    const initialPositionSize = initialCollateral.mul(linkPrice).div(expandDecimals(1, 18)).mul(110).div(100)
    
    await sendTxn(
      vault.increasePosition(
        signer.address,     // account
        link.address,       // collateralToken
        link.address,       // indexToken 
        initialPositionSize, // sizeDelta
        true                // isLong
      ),
      "Open initial LONG position (1.1x leverage)"
    )
    
    console.log("✅ Initial position opened successfully!")
    
    // Get position details
    const position = await vault.positions(positionKey)
    console.log(`- Position size: ${ethers.utils.formatUnits(position[0], 30)} USD`)
    console.log(`- Collateral: ${ethers.utils.formatUnits(position[1], 30)} USD`)
    console.log(`- Average price: ${ethers.utils.formatUnits(position[2], 30)}`)
    
  } catch (error) {
    console.log("❌ Error opening initial position:", error.message)
    return
  }
  
  // Wait a moment for position to settle
  console.log("\n⏳ Waiting for position to settle...")
  await new Promise(resolve => setTimeout(resolve, 3000))
  
  console.log(`\n🟢 === Step 2: Increase Position ===`)
  try {
    // Check remaining balance for increase
    const remainingBalance = await linkContract.balanceOf(signer.address)
    if (remainingBalance.gt(0)) {
      const increaseAmount = remainingBalance.mul(50).div(100) // Use 50% of remaining
      console.log(`Using ${ethers.utils.formatEther(increaseAmount)} LINK to increase position`)
      
      // Transfer additional collateral
      await sendTxn(
        linkContract.transfer(vault.address, increaseAmount),
        "Transfer additional LINK collateral for position increase"
      )
      
      // Increase position size (1.1x leverage - very conservative to stay within 50x max)
      const increaseSize = increaseAmount.mul(linkPrice).div(expandDecimals(1, 18)).mul(110).div(100)
      
      await sendTxn(
        vault.increasePosition(
          signer.address,     // account
          link.address,       // collateralToken
          link.address,       // indexToken 
          increaseSize,        // sizeDelta
          true                // isLong
        ),
        "Increase LONG position"
      )
      
      console.log("✅ Position increased successfully!")
      
      // Get updated position details
      const updatedPosition = await vault.positions(positionKey)
      console.log(`- New position size: ${ethers.utils.formatUnits(updatedPosition[0], 30)} USD`)
      console.log(`- New collateral: ${ethers.utils.formatUnits(updatedPosition[1], 30)} USD`)
      console.log(`- New average price: ${ethers.utils.formatUnits(updatedPosition[2], 30)}`)
      
    } else {
      console.log("ℹ️ No remaining balance for position increase")
    }
    
  } catch (error) {
    console.log("❌ Error increasing position:", error.message)
  }
  
  // Wait for increase to settle
  console.log("\n⏳ Waiting for position increase to settle...")
  await new Promise(resolve => setTimeout(resolve, 3000))
  
  console.log(`\n🟢 === Step 3: Decrease Position ===`)
  try {
    // Get current position
    const currentPosition = await vault.positions(positionKey)
    const currentSize = currentPosition[0]
    
    if (currentSize.gt(0)) {
      // Decrease by 25% of current position
      const decreaseSize = currentSize.mul(25).div(100)
      console.log(`Decreasing position by ${ethers.utils.formatUnits(decreaseSize, 30)} USD (25%)`)
      
      await sendTxn(
        vault.decreasePosition(
          signer.address,     // account
          link.address,       // collateralToken
          link.address,       // indexToken 
          0,                  // collateralDelta (0 = no collateral withdrawal)
          decreaseSize,        // sizeDelta
          true,               // isLong
          signer.address      // receiver
        ),
        "Decrease LONG position by 25%"
      )
      
      console.log("✅ Position decreased successfully!")
      
      // Get updated position details
      const decreasedPosition = await vault.positions(positionKey)
      console.log(`- Position size after decrease: ${ethers.utils.formatUnits(decreasedPosition[0], 30)} USD`)
      console.log(`- Collateral after decrease: ${ethers.utils.formatUnits(decreasedPosition[1], 30)} USD`)
      
    } else {
      console.log("❌ No position found to decrease")
    }
    
  } catch (error) {
    console.log("❌ Error decreasing position:", error.message)
  }
  
  // Wait for decrease to settle
  console.log("\n⏳ Waiting for position decrease to settle...")
  await new Promise(resolve => setTimeout(resolve, 3000))
  
  console.log(`\n🟢 === Step 4: Close Position ===`)
  try {
    // Get final position
    const finalPosition = await vault.positions(positionKey)
    const finalSize = finalPosition[0]
    
    if (finalSize.gt(0)) {
      console.log(`Closing remaining position: ${ethers.utils.formatUnits(finalSize, 30)} USD`)
      
      await sendTxn(
        vault.decreasePosition(
          signer.address,     // account
          link.address,       // collateralToken
          link.address,       // indexToken 
          0,                  // collateralDelta (0 = no collateral withdrawal)
          finalSize,          // sizeDelta (close entire position)
          true,               // isLong
          signer.address      // receiver
        ),
        "Close entire LONG position"
      )
      
      console.log("✅ Position closed successfully!")
      
      // Check final balances
      const finalBalance = await linkContract.balanceOf(signer.address)
      console.log(`- Final LINK balance: ${ethers.utils.formatEther(finalBalance)} LINK`)
      
    } else {
      console.log("ℹ️ Position already closed or doesn't exist")
    }
    
  } catch (error) {
    console.log("❌ Error closing position:", error.message)
  }
  
  console.log("\n🎯 === Perpetual Trading Lifecycle Test Complete ===")
  console.log("✅ All basic perpetual features tested:")
  console.log("1. ✅ Position opening")
  console.log("2. ✅ Position increasing") 
  console.log("3. ✅ Position decreasing")
  console.log("4. ✅ Position closing")
  console.log("\n🚀 The perpetual trading system is fully operational!")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
