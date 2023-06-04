import { SafeAccountConfig, SafeFactory } from '@safe-global/protocol-kit'
import { EthersAdapter } from '@safe-global/protocol-kit'
import { ethers } from 'ethers'
import * as fs from 'fs';
import * as readline from 'readline';
import { SafeVersion } from '@safe-global/safe-core-sdk-types'


// This file can be used to play around with the Safe Core SDK

interface Config {
  RPC_URL: string
  DEPLOYER_ADDRESS_PRIVATE_KEY: string
  DEPLOY_SAFE: {
    OWNERS: string[]
    THRESHOLD: number
    SALT_NONCE: string
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const config: Config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

function askSafeVersion(): Promise<string> {
  return new Promise((resolve) => {
    rl.question('Which version do you want deploy? [1.3.0 | 1.2.0 | 1.1.1 | 1.0.0]', (input: string) => {
      resolve(input.trim());
    });
  });
}
function askFundSafe(): Promise<string> {
  return new Promise((resolve) => {
    rl.question('Do you want to send 0.0001 ETH to your safe? y/n ', (input: string) => {
      resolve(input.trim())
    });
  });
}

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(config.RPC_URL)
  const deployerSigner = new ethers.Wallet(config.DEPLOYER_ADDRESS_PRIVATE_KEY, provider)

  // Create EthAdapter instance
  const ethAdapter = new EthersAdapter({
    ethers,
    signerOrProvider: deployerSigner
  })

  var safeVersion: SafeVersion = await askSafeVersion() as SafeVersion;
  var isL1SafeMasterCopy: boolean;

  if (safeVersion != '1.3.0'){
    isL1SafeMasterCopy = true;
  }else{
    isL1SafeMasterCopy = false;
  }
  
  // Create SafeFactory instance
  const safeFactory = await SafeFactory.create({ ethAdapter, safeVersion, isL1SafeMasterCopy })

  // Config of the deployed Safe
  const safeAccountConfig: SafeAccountConfig = {
    owners: config.DEPLOY_SAFE.OWNERS,
    threshold: config.DEPLOY_SAFE.THRESHOLD
  }
  const saltNonce = config.DEPLOY_SAFE.SALT_NONCE

  // Predict deployed address
  const predictedDeploySafeAddress = await safeFactory.predictSafeAddress(
    safeAccountConfig,
    saltNonce
  )

  console.log('Predicted deployed Safe ',safeVersion.toString(),' address:', predictedDeploySafeAddress)

  function callback(txHash: string) {
    console.log('Transaction hash:', txHash)
  }

  // Deploy Safe
  const safe = await safeFactory.deploySafe({
    safeAccountConfig,
    saltNonce,
    callback
  })
  const deployedSafe = await safe.getAddress()
  console.log('Deployed Safe:', deployedSafe)
  
  if (await askFundSafe() == 'y'){
    const safeAmount = ethers.utils.parseUnits('0.0001', 'ether').toHexString()
    const transactionParameters = {
      to: deployedSafe,
      value: safeAmount
    }
    const tx = await deployerSigner.sendTransaction(transactionParameters)
    console.log("Sended 0.0001 ETH to your safe ", tx.hash)
  }
}

main()