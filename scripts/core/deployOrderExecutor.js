const { deployContract, contractAt, sendTxn } = require("../shared/helpers")
const { expandDecimals } = require("../../test/shared/utilities")
const { toUsd } = require("../../test/shared/units")
const { errors } = require("../../test/core/Vault/helpers")

const network = (process.env.HARDHAT_NETWORK || 'mainnet');
const tokens = require('./tokens')[network];

async function main() {
  const vault = await contractAt("Vault", "0x2D641633FE39fAc1E79085dCAF91244EcBBda809")
  const orderBook = await contractAt("OrderBook", "0x9171bF1A725A6EDCCe44A8A124216775Eb324165")
  await deployContract("OrderExecutor", [vault.address, orderBook.address])

  writeTmpAddresses({
    orderExecutor: orderExecutor.address
  })
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
