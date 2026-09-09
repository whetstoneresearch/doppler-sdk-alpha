import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getAddress, parseEther } from 'viem'
import {
  DAY_SECONDS,
  CHAIN_IDS,
  DopplerSDK,
  WAD,
  getAddresses,
  rehypeDopplerHookInitializerAbi,
  verifyPreparedCreateExecution,
  type BeneficiaryData,
} from '../../../../src/evm'
import {
  getAnvilManager,
  getForkClients,
  isAnvilForkEnabled,
  type ForkClients,
} from '../../utils'

const chainId = CHAIN_IDS.BSC
const hasForkRpc = Boolean(
  process.env.BSC_RPC_URL || process.env.ALCHEMY_API_KEY,
)
const fixedSalt = `0x${'42'.repeat(32)}` as const

describe('BNB Smart Chain multicurve Rehype fork launch', () => {
  if (!isAnvilForkEnabled()) {
    it.skip('requires ANVIL_FORK_ENABLED=true')
    return
  }

  if (!hasForkRpc) {
    it.skip('requires BSC_RPC_URL or ALCHEMY_API_KEY')
    return
  }

  const addresses = getAddresses(chainId)
  const anvilManager = getAnvilManager()
  let clients: ForkClients

  beforeAll(async () => {
    await anvilManager.start(chainId)
    clients = getForkClients(chainId, 0, { timeout: 90_000 })
  }, 90_000)

  afterAll(async () => {
    await anvilManager.stop(chainId)
  })

  it(
    'performs a multicurve Rehype launch using the latest example configuration',
    async () => {
      const rehypeHook = addresses.rehypeDopplerHookInitializer
      if (!rehypeHook) {
        throw new Error('BSC Rehype hook initializer is required')
      }

      const sdk = new DopplerSDK({
        publicClient: clients.publicClient,
        chainId,
      })
      const poolFeeBeneficiaries = [await sdk.getAirlockBeneficiary(WAD)]
      const rehypeFeeBeneficiaries: [
        BeneficiaryData,
        ...BeneficiaryData[],
      ] = [
        { beneficiary: clients.account.address, shares: WAD / 5n },
        {
          beneficiary: getAddress('0x0000000000000000000000000000000000000001'),
          shares: (WAD * 3n) / 10n,
        },
        {
          beneficiary: getAddress('0x0000000000000000000000000000000000000002'),
          shares: WAD / 2n,
        },
      ]
      const day = BigInt(DAY_SECONDS)

      const params = sdk
        .buildMulticurveAuction()
        .tokenConfig({
          name: 'TEST BSC Multicurve Rehype Fork',
          symbol: 'TESTBMRF',
          tokenURI: 'ipfs://bsc-multicurve-rehype-fork.json',
          maxBalanceLimit: parseEther('25000'),
          balanceLimitEnd: Math.floor(Date.now() / 1000) + DAY_SECONDS,
          controller: clients.account.address,
          excludedFromBalanceLimit: [clients.account.address],
        })
        .saleConfig({
          initialSupply: 1_000_000n * WAD,
          numTokensToSell: 900_000n * WAD,
          numeraire: addresses.weth,
        })
        .withCurves({
          numerairePrice: 600,
          fee: 0,
          tickSpacing: 8,
          beneficiaries: poolFeeBeneficiaries,
          curves: [
            {
              marketCap: { start: 500_000, end: 2_000_000 },
              numPositions: 8,
              shares: parseEther('0.4'),
            },
            {
              marketCap: { start: 2_000_000, end: 8_000_000 },
              numPositions: 12,
              shares: parseEther('0.35'),
            },
            {
              marketCap: { start: 8_000_000, end: 'max' },
              numPositions: 16,
              shares: parseEther('0.25'),
            },
          ],
        })
        .withVesting({
          allocations: [
            {
              recipient: clients.account.address,
              amount: parseEther('40000'),
              schedule: {
                duration: 180n * day,
                cliffDuration: 30 * DAY_SECONDS,
              },
            },
            {
              recipient: clients.account.address,
              amount: parseEther('20000'),
              schedule: {
                duration: 365n * day,
                cliffDuration: 90 * DAY_SECONDS,
              },
            },
            {
              recipient: clients.account.address,
              amount: parseEther('15000'),
              schedule: {
                duration: 730n * day,
                cliffDuration: 180 * DAY_SECONDS,
              },
            },
          ],
        })
        .withRehypeDopplerHookInitializer({
          hookAddress: rehypeHook,
          feeBeneficiaries: rehypeFeeBeneficiaries,
          startFee: 12_000,
          endFee: 12_000,
          durationSeconds: 0,
          feeDistributionInfo: {
            assetFeesToAssetBuybackWad: 0n,
            assetFeesToNumeraireBuybackWad: WAD,
            assetFeesToBeneficiaryWad: 0n,
            assetFeesToLpWad: 0n,
            numeraireFeesToAssetBuybackWad: 0n,
            numeraireFeesToNumeraireBuybackWad: 0n,
            numeraireFeesToBeneficiaryWad: WAD,
            numeraireFeesToLpWad: 0n,
          },
          integratorFeeConfig: {
            integrator: clients.account.address,
            feeShare: 200_000,
            assetFeesToNumeraireRatio: 500_000_000,
            numeraireFeesToAssetRatio: 250_000_000,
            automaticPayout: false,
          },
        })
        .withFeeDistributionController(clients.account.address)
        .withGovernance({ type: 'noOp' })
        .withMigration({ type: 'noOp' })
        .withUserAddress(clients.account.address)
        .withSalt(fixedSalt)
        .build()

      const prepared = await sdk.factory.prepareCreateMulticurve(params, {
        account: clients.account.address,
      })
      const hash = await clients.walletClient.sendTransaction({
        account: clients.account,
        chain: clients.chain,
        ...prepared.transaction,
        ...(prepared.gasEstimate.status === 'estimated'
          ? { gas: prepared.gasEstimate.gas }
          : {}),
      })
      const receipt = await clients.publicClient.waitForTransactionReceipt({
        hash,
      })
      const verified = await verifyPreparedCreateExecution({
        prepared,
        receipt,
        publicClient: clients.publicClient,
      })

      expect(verified.receiptIdentity.tokenAddress).toBe(
        prepared.prediction.tokenAddress,
      )
      expect(verified.receiptIdentity.poolOrHookAddress).toBe(
        prepared.prediction.poolOrHookAddress,
      )
      expect(verified.preparedIdentity.poolKey.hooks).toBe(
        addresses.dopplerHookInitializer,
      )
      expect(verified.preparedIdentity.poolId).toBe(prepared.prediction.poolId)

      const [routing, feeShare] = await Promise.all([
        clients.publicClient.readContract({
          address: rehypeHook,
          abi: rehypeDopplerHookInitializerAbi,
          functionName: 'getIntegratorRoutingConfig',
          args: [verified.preparedIdentity.poolId],
        }),
        clients.publicClient.readContract({
          address: rehypeHook,
          abi: rehypeDopplerHookInitializerAbi,
          functionName: 'getIntegratorFeeShare',
          args: [verified.preparedIdentity.poolId],
        }),
      ])
      expect(getAddress(routing[0])).toBe(getAddress(clients.account.address))
      expect(routing[1]).toBe(500_000_000)
      expect(routing[2]).toBe(250_000_000)
      expect(routing[3]).toBe(false)
      expect(feeShare).toBe(200_000)
    },
    180_000,
  )
})
