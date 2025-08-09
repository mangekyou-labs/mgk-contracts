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
  
  // Get token info
  const { nativeToken } = tokens
  
  console.log("Adding HBAR liquidity via Router pattern...")
  console.log("Signer address:", signer.address)
  console.log("Vault address:", vault.address)
  console.log("Router address:", router.address)
  console.log("WHBAR address:", nativeToken.address)
  
  // Check current balances
  const nativeBalance = await ethers.provider.getBalance(signer.address)
  console.log("Native HBAR balance:", ethers.utils.formatEther(nativeBalance))
  
  try {
    // Get WHBAR contract (as ERC20)
    const whbarContract = await ethers.getContractAt("IERC20", nativeToken.address)
    const whbarBalanceBefore = await whbarContract.balanceOf(signer.address)
    console.log("WHBAR balance before:", ethers.utils.formatEther(whbarBalanceBefore))
    
    // Amount to deposit (1 HBAR for testing)
    const depositAmount = expandDecimals(1, 18)
    console.log(`\nDepositing ${ethers.utils.formatEther(depositAmount)} HBAR...`)
    
    // Step 1: Follow Router's pattern - wrap HBAR to WHBAR manually
    console.log("Step 1: Wrapping HBAR to WHBAR using Router's internal pattern...")
    
    // Get WETH interface to use deposit function
    const wethInterface = await ethers.getContractAt("IWETH", nativeToken.address)
    
    try {
      await sendTxn(
        wethInterface.deposit({ value: depositAmount }),
        "Wrap HBAR to WHBAR"
      )
      
      // Check if we got WHBAR
      const whbarBalanceAfterWrap = await whbarContract.balanceOf(signer.address)
      console.log("WHBAR balance after wrap:", ethers.utils.formatEther(whbarBalanceAfterWrap))
      
      if (whbarBalanceAfterWrap.gt(whbarBalanceBefore)) {
        console.log("✅ HBAR successfully wrapped to WHBAR!")
        
        // Step 2: Transfer WHBAR to vault
        console.log("Step 2: Transferring WHBAR to vault...")
        const wrapAmount = whbarBalanceAfterWrap.sub(whbarBalanceBefore)
        await sendTxn(
          whbarContract.transfer(vault.address, wrapAmount),
          "Transfer WHBAR to vault"
        )
        
        // Step 3: Call directPoolDeposit
        console.log("Step 3: Calling directPoolDeposit...")
        await sendTxn(
          vault.directPoolDeposit(nativeToken.address),
          "Register WHBAR in pool"
        )
        
        console.log("✅ HBAR liquidity successfully added!")
        
      } else {
        console.log("❌ HBAR wrapping failed - trying alternative method...")
        
        // Alternative: Use Router's directPoolDeposit with pre-wrapped tokens
        // First we need to get some WHBAR somehow
        console.log("Alternative: Manual transfer + directPoolDeposit...")
        
        // Send HBAR directly to the WHBAR contract address
        const directTx = await signer.sendTransaction({
          to: nativeToken.address,
          value: depositAmount
        })
        await directTx.wait()
        console.log("Direct HBAR transfer transaction:", directTx.hash)
        
        // Check balance
        const balanceAfterDirect = await whbarContract.balanceOf(signer.address)
        console.log("WHBAR balance after direct transfer:", ethers.utils.formatEther(balanceAfterDirect))
      }
      
    } catch (wrapError) {
      console.log("❌ WHBAR wrapping failed:", wrapError.message)
      
      // Last resort: Try using Router's directPoolDeposit with WHBAR we already have
      console.log("Last resort: Check if we have any WHBAR to use...")
      if (whbarBalanceBefore.gt(0)) {
        console.log("Using existing WHBAR balance...")
        const useAmount = whbarBalanceBefore.gt(depositAmount) ? depositAmount : whbarBalanceBefore
        
        await sendTxn(
          whbarContract.transfer(vault.address, useAmount),
          "Transfer existing WHBAR to vault"
        )
        
        await sendTxn(
          vault.directPoolDeposit(nativeToken.address),
          "Register existing WHBAR in pool"
        )
        
        console.log("✅ Used existing WHBAR for liquidity!")
      }
    }
    
    // Check final pool amounts
    console.log("\n=== Final Pool Status ===")
    const poolAmount = await vault.poolAmounts(nativeToken.address)
    console.log("WHBAR pool amount:", ethers.utils.formatEther(poolAmount))
    
    const finalWhbarBalance = await whbarContract.balanceOf(signer.address)
    console.log("Final WHBAR balance:", ethers.utils.formatEther(finalWhbarBalance))
    
  } catch (error) {
    console.log("❌ Overall error:", error.message)
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
