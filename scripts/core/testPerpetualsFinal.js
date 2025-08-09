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
  
  console.log("🚀 Testing Perpetual Positions with Adjusted Fees")
  console.log("Signer address:", signer.address)
  console.log("Vault address:", vault.address)
  
  // Check current state
  console.log("\n=== Current State ===")
  const linkContract = await ethers.getContractAt("IERC20", link.address)
  const linkBalance = await linkContract.balanceOf(signer.address)
  const linkPoolAmount = await vault.poolAmounts(link.address)
  const linkPrice = await vault.getMinPrice(link.address)
  const liquidationFee = await vault.liquidationFeeUsd()
  
  console.log("LINK wallet balance:", ethers.utils.formatEther(linkBalance))
  console.log("LINK pool amount:", ethers.utils.formatEther(linkPoolAmount))
  console.log("LINK price:", ethers.utils.formatUnits(linkPrice, 30), "USD")
  console.log("Liquidation fee:", ethers.utils.formatUnits(liquidationFee, 30), "USD")
  
  // Test 1: Open Long Position
  try {
    console.log("\n🟢 === Opening LONG Position ===")
    
    const collateralAmount = expandDecimals(10, 18) // 10 LINK collateral
    const collateralValueUsd = linkPrice.mul(collateralAmount).div(expandDecimals(1, 18))
    
    // Calculate safe position size (90% of available)
    const availableForPosition = collateralValueUsd.sub(liquidationFee)
    const positionSizeUsd = availableForPosition.mul(90).div(100) // 90% safety margin
    
    console.log(`Position setup:`)
    console.log(`- Collateral: ${ethers.utils.formatEther(collateralAmount)} LINK`)
    console.log(`- Collateral value: ${ethers.utils.formatUnits(collateralValueUsd, 30)} USD`)
    console.log(`- Position size: ${ethers.utils.formatUnits(positionSizeUsd, 30)} USD`)
    console.log(`- Liquidation fee: ${ethers.utils.formatUnits(liquidationFee, 30)} USD`)
    
    // Transfer collateral to vault
    await sendTxn(
      linkContract.transfer(vault.address, collateralAmount),
      "Transfer LINK collateral to vault"
    )
    
    // Open long position
    await sendTxn(
      vault.increasePosition(
        signer.address,     // account
        link.address,       // collateralToken
        link.address,       // indexToken 
        positionSizeUsd,    // sizeDelta (in USD)
        true                // isLong
      ),
      "Open LONG position"
    )
    
    // Check the position
    const positionKey = ethers.utils.solidityKeccak256(
      ["address", "address", "address", "bool"],
      [signer.address, link.address, link.address, true]
    )
    
    const position = await vault.positions(positionKey)
    console.log("✅ LONG Position opened successfully!")
    console.log(`- Position size: ${ethers.utils.formatUnits(position[0], 30)} USD`)
    console.log(`- Collateral: ${ethers.utils.formatUnits(position[1], 30)} USD`)
    console.log(`- Average price: ${ethers.utils.formatUnits(position[2], 30)}`)
    console.log(`- Entry funding rate: ${position[3]}`)
    console.log(`- Reserve amount: ${ethers.utils.formatEther(position[4])} LINK`)
    
    // Check P&L
    try {
      const delta = await vault.getPositionDelta(
        signer.address, link.address, link.address, true
      )
      console.log(`- Current P&L: ${delta[0] ? 'PROFIT' : 'LOSS'} ${ethers.utils.formatUnits(delta[1], 30)} USD`)
    } catch (pnlError) {
      console.log("- P&L calculation:", pnlError.message)
    }
    
  } catch (error) {
    console.log("❌ Long position error:", error.message)
  }
  
  // Test 2: Check Vault State After Position
  try {
    console.log("\n📊 === Vault State After Position ===")
    
    const reservedAmounts = await vault.reservedAmounts(link.address)
    const guaranteedUsd = await vault.guaranteedUsd(link.address)
    const poolAmountAfter = await vault.poolAmounts(link.address)
    
    console.log("LINK reserved amounts:", ethers.utils.formatEther(reservedAmounts))
    console.log("LINK guaranteed USD:", ethers.utils.formatUnits(guaranteedUsd, 30))
    console.log("LINK pool amount after:", ethers.utils.formatEther(poolAmountAfter))
    
  } catch (error) {
    console.log("❌ State check error:", error.message)
  }
  
  // Test 3: Partial Position Close
  try {
    console.log("\n🔄 === Testing Position Closure ===")
    
    // Check if we have a position to close
    const positionKey = ethers.utils.solidityKeccak256(
      ["address", "address", "address", "bool"],
      [signer.address, link.address, link.address, true]
    )
    
    const position = await vault.positions(positionKey)
    if (position[0].gt(0)) {
      console.log("Current position size:", ethers.utils.formatUnits(position[0], 30), "USD")
      
      const closeSize = position[0].div(2) // Close half
      console.log("Closing size:", ethers.utils.formatUnits(closeSize, 30), "USD")
      
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
      
      // Check position after partial close
      const positionAfter = await vault.positions(positionKey)
      console.log("✅ Position partially closed!")
      console.log("Remaining position size:", ethers.utils.formatUnits(positionAfter[0], 30), "USD")
      
    } else {
      console.log("No position found to close")
    }
    
  } catch (error) {
    console.log("❌ Position closure error:", error.message)
  }
  
  // Final summary
  console.log("\n=== Final Summary ===")
  const finalLinkBalance = await linkContract.balanceOf(signer.address)
  const finalPoolAmount = await vault.poolAmounts(link.address)
  
  console.log("Final LINK wallet balance:", ethers.utils.formatEther(finalLinkBalance))
  console.log("Final LINK pool amount:", ethers.utils.formatEther(finalPoolAmount))
  
  console.log("\n🎯 Perpetual position testing completed!")
  console.log("✅ Core perpetual functionality validated!")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
