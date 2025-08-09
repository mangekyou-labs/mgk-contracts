const { contractAt, readTmpAddresses, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');
const tokens = require('./tokens')[network];

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Get WHBAR token address
  const { nativeToken } = tokens
  
  console.log("Wrapping native HBAR to WHBAR...")
  console.log("Signer address:", signer.address)
  console.log("WHBAR contract address:", nativeToken.address)
  
  // Check current balances
  const nativeBalance = await ethers.provider.getBalance(signer.address)
  console.log("Native HBAR balance:", ethers.utils.formatEther(nativeBalance))
  
  try {
    // Get WHBAR contract
    const whbarContract = await ethers.getContractAt("IERC20", nativeToken.address)
    const whbarBalance = await whbarContract.balanceOf(signer.address)
    console.log("Current WHBAR balance:", ethers.utils.formatEther(whbarBalance))
    
    // Try to check if contract has deposit function (common for wrapped tokens)
    console.log("\n=== Attempting to wrap HBAR ===")
    
    // Amount to wrap (1 HBAR for testing)
    const wrapAmount = expandDecimals(1, 18)
    console.log(`Attempting to wrap ${ethers.utils.formatEther(wrapAmount)} HBAR...`)
    
    // Try different methods that wrapped tokens might use
    try {
      // Method 1: Try deposit() function (like WETH)
      const depositTx = await signer.sendTransaction({
        to: nativeToken.address,
        value: wrapAmount,
        data: "0xd0e30db0" // deposit() function selector
      })
      await depositTx.wait()
      console.log("✅ deposit() method worked! Transaction:", depositTx.hash)
    } catch (error1) {
      console.log("❌ deposit() method failed:", error1.message)
      
      try {
        // Method 2: Try sending ETH directly (some contracts auto-wrap on receive)
        const directTx = await signer.sendTransaction({
          to: nativeToken.address,
          value: wrapAmount
        })
        await directTx.wait()
        console.log("✅ Direct transfer worked! Transaction:", directTx.hash)
      } catch (error2) {
        console.log("❌ Direct transfer failed:", error2.message)
        
        try {
          // Method 3: Try mint() function with value
          const mintTx = await signer.sendTransaction({
            to: nativeToken.address,
            value: wrapAmount,
            data: "0x1249c58b" // mint() function selector
          })
          await mintTx.wait()
          console.log("✅ mint() method worked! Transaction:", mintTx.hash)
        } catch (error3) {
          console.log("❌ mint() method failed:", error3.message)
          console.log("📋 All wrap methods failed. This might be a precompiled contract with different interface.")
        }
      }
    }
    
    // Check balance after wrapping attempt
    const newWhbarBalance = await whbarContract.balanceOf(signer.address)
    console.log("\n=== After Wrapping Attempt ===")
    console.log("New WHBAR balance:", ethers.utils.formatEther(newWhbarBalance))
    
    if (newWhbarBalance.gt(whbarBalance)) {
      console.log("✅ Successfully wrapped HBAR!")
      console.log("Amount wrapped:", ethers.utils.formatEther(newWhbarBalance.sub(whbarBalance)))
    } else {
      console.log("❌ No WHBAR tokens received")
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
