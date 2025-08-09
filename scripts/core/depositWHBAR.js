const { contractAt, readTmpAddresses, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');
const tokens = require('./tokens')[network];

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Get WHBAR token address
  const { nativeToken } = tokens
  
  console.log("Depositing HBAR to get WHBAR...")
  console.log("Signer address:", signer.address)
  console.log("WHBAR contract address:", nativeToken.address)
  
  // Check current balances
  const nativeBalance = await ethers.provider.getBalance(signer.address)
  console.log("Native HBAR balance:", ethers.utils.formatEther(nativeBalance))
  
  // Amount to deposit (1 HBAR for testing)
  const depositAmount = expandDecimals(1, 18)
  console.log(`\nDepositing ${ethers.utils.formatEther(depositAmount)} HBAR to get WHBAR...`)

  try {
    // Try with a comprehensive ABI that includes both IWETH and ERC20 functions
    const whbarAbi = [
      "function deposit() external payable",
      "function withdraw(uint256) external",
      "function balanceOf(address) external view returns (uint256)",
      "function transfer(address to, uint256 value) external returns (bool)"
    ]
    const whbarContract = new ethers.Contract(nativeToken.address, whbarAbi, signer)
    
    // Check current WHBAR balance
    const whbarBalance = await whbarContract.balanceOf(signer.address)
    console.log("Current WHBAR balance:", ethers.utils.formatEther(whbarBalance))
    
    console.log("Calling deposit() function...")
    const tx = await whbarContract.deposit({ value: depositAmount })
    console.log("Transaction sent:", tx.hash)
    await tx.wait()
    console.log("✅ Transaction confirmed!")
    
    // Check balance after deposit
    const newWhbarBalance = await whbarContract.balanceOf(signer.address)
    console.log("\n=== After Deposit ===")
    console.log("New WHBAR balance:", ethers.utils.formatEther(newWhbarBalance))
    
    if (newWhbarBalance.gt(whbarBalance)) {
      console.log("✅ Successfully deposited HBAR and received WHBAR!")
      console.log("WHBAR received:", ethers.utils.formatEther(newWhbarBalance.sub(whbarBalance)))
    } else {
      console.log("❌ No WHBAR tokens received")
    }
    
  } catch (error) {
    console.log("❌ Deposit failed:", error.message)
    
    // Let's also try just sending ETH directly to see if it auto-converts
    console.log("\n=== Trying Direct Transfer (Auto-wrap) ===")
    try {
      const tx = await signer.sendTransaction({
        to: nativeToken.address,
        value: depositAmount
      })
      console.log("Direct transfer transaction sent:", tx.hash)
      await tx.wait()
      console.log("✅ Direct transfer confirmed!")
      
      // Check if balance increased
      const whbarContract = await ethers.getContractAt("IERC20", nativeToken.address)
      const finalBalance = await whbarContract.balanceOf(signer.address)
      console.log("Final WHBAR balance:", ethers.utils.formatEther(finalBalance))
      
    } catch (directError) {
      console.log("❌ Direct transfer also failed:", directError.message)
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
