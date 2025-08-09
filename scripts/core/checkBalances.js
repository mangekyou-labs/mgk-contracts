const { contractAt, readTmpAddresses } = require("../shared/helpers")

const network = (process.env.HARDHAT_NETWORK || 'hederaTestnet');
const tokens = require('./tokens')[network];

async function main() {
  const [signer] = await ethers.getSigners()
  
  // Get token addresses
  const { nativeToken, link, usdc } = tokens
  
  console.log("Checking token balances...")
  console.log("Signer address:", signer.address)
  console.log("Native token address:", nativeToken.address)
  console.log("Link token address:", link.address)
  
  // Check native balance (ETH-style balance)
  const ethBalance = await ethers.provider.getBalance(signer.address)
  console.log("ETH/HBAR balance:", ethers.utils.formatEther(ethBalance))
  
  // Check wrapped HBAR balance
  try {
    const hbarContract = await ethers.getContractAt("IERC20", nativeToken.address)
    const hbarBalance = await hbarContract.balanceOf(signer.address)
    console.log("Wrapped HBAR balance:", ethers.utils.formatEther(hbarBalance))
  } catch (error) {
    console.log("Wrapped HBAR error:", error.message)
  }
  
  // Check LINK balance
  try {
    const linkContract = await ethers.getContractAt("IERC20", link.address)
    const linkBalance = await linkContract.balanceOf(signer.address)
    console.log("LINK balance:", ethers.utils.formatEther(linkBalance))
  } catch (error) {
    console.log("LINK error:", error.message)
  }
  
  // Check USDC balance
  try {
    const usdcContract = await ethers.getContractAt("IERC20", usdc.address)
    const usdcBalance = await usdcContract.balanceOf(signer.address)
    console.log("USDC balance:", ethers.utils.formatUnits(usdcBalance, 6))
  } catch (error) {
    console.log("USDC error:", error.message)
  }
  
  console.log("\n✅ Balance check completed!")
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
