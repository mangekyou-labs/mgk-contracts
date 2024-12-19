const { deployContract, contractAt, writeTmpAddresses, sendTxn } = require("../shared/helpers")

async function main() {
  const tokenManager = await deployContract("TokenManager", [1], "TokenManager")

  const signers = [
    "0xeD37FD0d6F0f69236E7472B36796e133D20EcC32", // Kyler
  ]

  await sendTxn(tokenManager.initialize(signers), "tokenManager.initialize")

  writeTmpAddresses({
    tokenManager: tokenManager.address
  })
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
