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
  const { nativeToken, link, usdc } = tokens
  
  console.log("Adding liquidity to vault...")
  console.log("Signer address:", signer.address)
  console.log("Vault address:", vault.address)
  
  // Add HBAR (native token) liquidity
  try {
    const hbarAmount = expandDecimals(1, 18) // 1 HBAR (reduced amount for testing)
    console.log(`Adding ${ethers.utils.formatEther(hbarAmount)} HBAR to vault...`)
    
    // Check HBAR balance first
    const hbarContract = await ethers.getContractAt("IERC20", nativeToken.address)
    const hbarBalance = await hbarContract.balanceOf(signer.address)
    console.log("Current HBAR balance:", ethers.utils.formatEther(hbarBalance))
    
    if (hbarBalance.gte(hbarAmount)) {
      // First transfer HBAR directly to vault
      console.log("Transferring HBAR to vault...")
      await sendTxn(
        hbarContract.transfer(vault.address, hbarAmount),
        "Transfer HBAR to vault"
      )
      
      // Then call directPoolDeposit to register the deposit
      await sendTxn(
        vault.directPoolDeposit(nativeToken.address),
        "Add HBAR liquidity"
      )
      
      console.log("✅ HBAR liquidity added!")
    } else {
      console.log("❌ Insufficient HBAR balance")
    }
  } catch (error) {
    console.log("HBAR liquidity error:", error.message)
  }
  
  // Add LINK liquidity
  try {
    const linkAmount = expandDecimals(1, 18) // 1 LINK (reduced amount for testing)
    console.log(`Adding ${ethers.utils.formatEther(linkAmount)} LINK to vault...`)
    
    // Check LINK balance first
    const linkContract = await ethers.getContractAt("IERC20", link.address)
    const linkBalance = await linkContract.balanceOf(signer.address)
    console.log("Current LINK balance:", ethers.utils.formatEther(linkBalance))
    
    if (linkBalance.gte(linkAmount)) {
      // First transfer LINK directly to vault
      console.log("Transferring LINK to vault...")
      await sendTxn(
        linkContract.transfer(vault.address, linkAmount),
        "Transfer LINK to vault"
      )
      
      // Then call directPoolDeposit to register the deposit
      await sendTxn(
        vault.directPoolDeposit(link.address),
        "Add LINK liquidity"
      )
      
      console.log("✅ LINK liquidity added!")
    } else {
      console.log("❌ Insufficient LINK balance")
    }
  } catch (error) {
    console.log("LINK liquidity error:", error.message)
  }
  
  // Check pool amounts after adding liquidity
  console.log("\n=== Pool Amounts After Adding Liquidity ===")
  console.log("HBAR pool amount:", await vault.poolAmounts(nativeToken.address))
  console.log("LINK pool amount:", await vault.poolAmounts(link.address))
  
  console.log("\n✅ Liquidity addition completed!")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
