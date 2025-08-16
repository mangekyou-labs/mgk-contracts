const { contractAt, readTmpAddresses, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');
const tokens = require('./tokens')[network];

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Read deployed addresses
  const addresses = readTmpAddresses()
  
  console.log("🚀 Testing Perpetual Positions - Simplified Version")
  console.log("Signer address:", signer.address)
  console.log("Vault address:", addresses.vault)
  
  try {
    // Get contracts
    const vault = await contractAt("Vault", addresses.vault)
    const { link, nativeToken } = tokens
    
    // Check current state
    console.log("\n=== Current State ===")
    const linkContract = await ethers.getContractAt("IERC20", link.address)
    const linkBalance = await linkContract.balanceOf(signer.address)
    const linkPrice = await vault.getMinPrice(link.address)
    const liquidationFee = await vault.liquidationFeeUsd()
    
    console.log("LINK wallet balance:", ethers.utils.formatEther(linkBalance))
    console.log("LINK price:", ethers.utils.formatUnits(linkPrice, 30), "USD")
    console.log("Liquidation fee:", ethers.utils.formatUnits(liquidationFee, 30), "USD")
    
    // Check vault pool amounts
    const linkPoolAmount = await vault.poolAmounts(link.address)
    console.log("LINK pool amount:", ethers.utils.formatEther(linkPoolAmount))
    
    if (linkBalance.eq(0)) {
      console.log("\n❌ No LINK balance available for testing")
      console.log("The wallet needs LINK tokens to test perpetual positions")
      console.log("Current LINK pool has:", ethers.utils.formatEther(linkPoolAmount), "LINK")
      
      // Try to buy some LINK using HBAR if available
      const hbarBalance = await ethers.provider.getBalance(signer.address)
      console.log("HBAR balance:", ethers.utils.formatEther(hbarBalance))
      
      if (hbarBalance.gt(0)) {
        console.log("\n=== Attempting to Buy LINK with HBAR ===")
        
        try {
          // Try to swap HBAR for LINK
          const swapAmount = expandDecimals(1, 18) // 1 HBAR
          console.log("Attempting to swap 1 HBAR for LINK...")
          
          await sendTxn(
            vault.swap(
              nativeToken.address, // tokenIn (HBAR)
              link.address,        // tokenOut (LINK)
              signer.address,      // receiver
              swapAmount          // amountIn
            ),
            "Swap HBAR for LINK"
          )
          
          console.log("✅ Successfully swapped HBAR for LINK!")
          
          // Check new balance
          const newLinkBalance = await linkContract.balanceOf(signer.address)
          console.log("New LINK balance:", ethers.utils.formatEther(newLinkBalance))
          
        } catch (swapError) {
          console.log("❌ Swap failed:", swapError.message)
          console.log("This might be due to insufficient liquidity or price impact")
        }
      }
      
      return
    }
    
    // If we have LINK, proceed with position testing
    console.log("\n🟢 === Testing Perpetual Position ===")
    
    // Calculate a safe position size
    const collateralAmount = linkBalance.div(2) // Use half of available LINK
    const collateralValue = linkPrice.mul(collateralAmount).div(expandDecimals(1, 18))
    
    console.log("Using collateral:", ethers.utils.formatEther(collateralAmount), "LINK")
    console.log("Collateral value:", ethers.utils.formatUnits(collateralValue, 30), "USD")
    
    if (collateralValue.lte(liquidationFee)) {
      console.log("❌ Collateral value too low compared to liquidation fee")
      console.log("Need more LINK or lower fees")
      return
    }
    
    // Calculate position size (slightly larger than collateral for leverage)
    const positionSize = collateralValue.add(liquidationFee).add(1) // Just enough to be leveraged
    
    console.log("Position size:", ethers.utils.formatUnits(positionSize, 30), "USD")
    console.log("Effective leverage:", ethers.utils.formatUnits(positionSize.div(collateralValue), 30), "x")
    
    // Transfer collateral to vault
    console.log("\nTransferring collateral to vault...")
    await sendTxn(
      linkContract.transfer(vault.address, collateralAmount),
      "Transfer LINK collateral to vault"
    )
    
    // Open long position
    console.log("Opening long position...")
    await sendTxn(
      vault.increasePosition(
        signer.address,     // account
        link.address,       // collateralToken
        link.address,       // indexToken 
        positionSize,       // sizeDelta
        true                // isLong
      ),
      "Open long position"
    )
    
    console.log("✅ Position opened successfully!")
    
    // Check the position
    const positionKey = ethers.utils.solidityKeccak256(
      ["address", "address", "address", "bool"],
      [signer.address, link.address, link.address, true]
    )
    
    const position = await vault.positions(positionKey)
    if (position[0].gt(0)) {
      console.log("\n=== Position Details ===")
      console.log("Position size:", ethers.utils.formatUnits(position[0], 30), "USD")
      console.log("Collateral:", ethers.utils.formatUnits(position[1], 30), "USD")
      console.log("Average price:", ethers.utils.formatUnits(position[2], 30))
      console.log("Entry funding rate:", position[3].toString())
      console.log("Reserve amount:", ethers.utils.formatEther(position[4]), "LINK")
      
      // Calculate actual leverage
      const actualLeverage = position[0].div(position[1])
      console.log("Actual leverage:", ethers.utils.formatUnits(actualLeverage, 30), "x")
      
      console.log("\n✅ Perpetual position test completed successfully!")
      
    } else {
      console.log("❌ No position created")
    }
    
  } catch (error) {
    console.log("❌ Error:", error.message)
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
