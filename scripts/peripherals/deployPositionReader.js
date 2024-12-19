const { deployContract, contractAt, writeTmpAddresses, sendTxn } = require("../shared/helpers")

async function main() {
  const contract = await deployContract("PositionRouterReader", [], "PositionRouterReader")

  writeTmpAddresses({
    positionRouterReader: contract.address
  })
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
