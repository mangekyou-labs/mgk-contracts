const { contractAt, readTmpAddresses, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');
const tokens = require('./tokens')[network];

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Read deployed addresses
  const addresses = readTmpAddresses()
  
  // Get vault contract
  const vault = await contractAt("Vault", addresses.vault)
  
  // Get token addresses
  const { nativeToken, link } = tokens
  
  console.log("Adding liquidity to vault (simplified)...")
  console.log("Signer address:", signer.address)
  console.log("Vault address:", vault.address)
  
  // Check balances first
  console.log("\n=== Checking Balances ===")
  const ethBalance = await ethers.provider.getBalance(signer.address)
  console.log("Native HBAR balance:", ethers.utils.formatEther(ethBalance))
  
  try {
    const linkContract = await ethers.getContractAt("IERC20", link.address)
    const linkBalance = await linkContract.balanceOf(signer.address)
    console.log("LINK token balance:", ethers.utils.formatEther(linkBalance))
    
    if (linkBalance.gt(0)) {
      console.log("\n=== Adding LINK Liquidity ===")
      
      // Use only 1 LINK to be safe
      const linkAmount = expandDecimals(1, 18)
      console.log(`Approving ${ethers.utils.formatEther(linkAmount)} LINK...`)
      
      await sendTxn(
        linkContract.approve(vault.address, linkAmount),
        "Approve LINK"
      )
      
      console.log("Transferring LINK to vault...")
      await sendTxn(
        linkContract.transfer(vault.address, linkAmount),
        "Transfer LINK to vault"
      )
      
      console.log("Calling directPoolDeposit...")
      await sendTxn(
        vault.directPoolDeposit(link.address),
        "Add LINK liquidity"
      )
      
      console.log("✅ LINK liquidity added!")
    } else {
      console.log("❌ No LINK tokens found in wallet")
    }
  } catch (error) {
    console.log("LINK error:", error.message)
  }
  
  // Check pool amounts
  console.log("\n=== Pool Amounts ===")
  console.log("LINK pool amount:", await vault.poolAmounts(link.address))
  
  console.log("\n✅ Liquidity addition completed!")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
