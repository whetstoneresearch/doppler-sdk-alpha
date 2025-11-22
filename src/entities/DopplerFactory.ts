import {
  type Address,
  type Hex,
  type Hash,
  type PublicClient,
  type WalletClient,
  type Account,
  encodeAbiParameters,
  encodePacked,
  keccak256,
  getAddress,
  decodeEventLog,
  toHex,
} from 'viem'
import type {
  CreateStaticAuctionParams,
  CreateDynamicAuctionParams,
  CreateMulticurveParams,
  MigrationConfig,
  SupportedPublicClient,
  TokenConfig,
  Doppler404TokenConfig,
  StandardTokenConfig,
  SupportedChainId,
  DynamicAuctionConfig,
  CreateParams,
  MulticurveBundleExactInResult,
  MulticurveBundleExactOutResult,
  V4PoolKey
} from '../types'
import type { ModuleAddressOverrides } from '../types'
import { CHAIN_IDS, getAddresses } from '../addresses'
import { zeroAddress } from 'viem'
import {
  ZERO_ADDRESS,
  BASIS_POINTS,
  WAD,
  DEFAULT_PD_SLUGS,
  FLAG_MASK,
  DEFAULT_V3_NUM_POSITIONS,
  DEFAULT_V3_YEARLY_MINT_RATE,
  DEFAULT_V3_MAX_SHARE_TO_BE_SOLD,
  DEFAULT_V4_YEARLY_MINT_RATE,
  DEFAULT_V3_INITIAL_VOTING_DELAY,
  DEFAULT_V3_INITIAL_VOTING_PERIOD,
  DEFAULT_V3_INITIAL_PROPOSAL_THRESHOLD,
  DEFAULT_V4_INITIAL_VOTING_DELAY,
  DEFAULT_V4_INITIAL_VOTING_PERIOD,
  DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD,
  DEFAULT_CREATE_GAS_LIMIT,
  DEFAULT_V3_FEE,
  TICK_SPACINGS,
} from '../constants'
import { computeOptimalGamma, MIN_TICK, MAX_TICK, isToken0Expected } from '../utils'
import { airlockAbi, bundlerAbi, DERC20Bytecode, DopplerBytecode, DopplerDN404Bytecode } from '../abis'
import { DopplerBytecodeBaseMainnet } from '@/abis/bytecodes'

// Type definition for the custom migration encoder function
export type MigrationEncoder = (config: MigrationConfig) => Hex

const MAX_UINT128 = (1n << 128n) - 1n

export class DopplerFactory<C extends SupportedChainId = SupportedChainId> {
  protected publicClient: SupportedPublicClient
  protected walletClient?: WalletClient
  protected chainId: C
  protected customMigrationEncoder?: MigrationEncoder

  protected multicurveBundlerSupport = new Map<Address, boolean>()

  constructor(publicClient: SupportedPublicClient, walletClient: WalletClient | undefined, chainId: C) {
    this.publicClient = publicClient
    this.walletClient = walletClient
    this.chainId = chainId
  }

  /**
   * Set a custom migration data encoder function
   * @param encoder Custom function to encode migration data
   * @returns The factory instance for method chaining
   */
  withCustomMigrationEncoder(encoder: MigrationEncoder): this {
    this.customMigrationEncoder = encoder
    return this
  }

  async encodeCreateStaticAuctionParams(params: CreateStaticAuctionParams<C>): Promise<CreateParams> {
    // Validate parameters
    this.validateStaticAuctionParams(params)

    const addresses = getAddresses(this.chainId)

    // 1. Encode pool initializer data
    // V3 initializer expects InitData struct with specific field order
    const poolInitializerData = encodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [
            { type: 'uint24', name: 'fee' },
            { type: 'int24', name: 'tickLower' },
            { type: 'int24', name: 'tickUpper' },
            { type: 'uint16', name: 'numPositions' },
            { type: 'uint256', name: 'maxShareToBeSold' }
          ]
        }
      ],
      [{
        fee: params.pool.fee,
        tickLower: params.pool.startTick,
        tickUpper: params.pool.endTick,
        numPositions: params.pool.numPositions ?? DEFAULT_V3_NUM_POSITIONS,
        maxShareToBeSold: params.pool.maxShareToBeSold ?? DEFAULT_V3_MAX_SHARE_TO_BE_SOLD
      }]
    )

    // 2. Encode migration data based on MigrationConfig
    const liquidityMigratorData = this.encodeMigrationData(params.migration)

    // 3. Encode token parameters (standard vs Doppler404)
    let tokenFactoryData: Hex
    if (this.isDoppler404Token(params.token)) {
      const token404 = params.token
      // Doppler404 expects: name, symbol, baseURI, unit
      const baseURI = token404.baseURI
      const unit = token404.unit !== undefined ? BigInt(token404.unit) : 1000n
      tokenFactoryData = encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'string' },
          { type: 'string' },
          { type: 'uint256' },
        ],
        [
          params.token.name,
          params.token.symbol,
          baseURI,
          unit,
        ]
      )
    } else {
      const tokenStd = params.token as StandardTokenConfig
      const vestingDuration = params.vesting?.duration ?? BigInt(0)
      const yearlyMintRate = tokenStd.yearlyMintRate ?? DEFAULT_V4_YEARLY_MINT_RATE

      // Handle vesting recipients and amounts
      let vestingRecipients: Address[] = []
      let vestingAmounts: bigint[] = []

      if (params.vesting) {
        if (params.vesting.recipients && params.vesting.amounts) {
          // Use provided recipients and amounts
          vestingRecipients = params.vesting.recipients
          vestingAmounts = params.vesting.amounts
        } else {
          // Default: vest all non-sold tokens to userAddress
          vestingRecipients = [params.userAddress]
          vestingAmounts = [params.sale.initialSupply - params.sale.numTokensToSell]
        }
      }

      tokenFactoryData = encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'string' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'address[]' },
          { type: 'uint256[]' },
          { type: 'string' },
        ],
        [
          tokenStd.name,
          tokenStd.symbol,
          yearlyMintRate,
          BigInt(vestingDuration),
          vestingRecipients,
          vestingAmounts,
          tokenStd.tokenURI,
        ]
      )
    }

    const useNoOpGovernance = params.governance.type === 'noOp'

    // 4. Encode governance factory data
    const governanceFactoryData: Hex = useNoOpGovernance
      ? ('0x' as Hex)
      : encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'uint48' },
          { type: 'uint32' },
          { type: 'uint256' },
        ],
        [
          params.token.name,
          params.governance.type === 'custom' ? params.governance.initialVotingDelay : DEFAULT_V3_INITIAL_VOTING_DELAY,
          params.governance.type === 'custom' ? params.governance.initialVotingPeriod : DEFAULT_V3_INITIAL_VOTING_PERIOD,
          params.governance.type === 'custom' ? params.governance.initialProposalThreshold : DEFAULT_V3_INITIAL_PROPOSAL_THRESHOLD
        ]
      )

    // 4.1 Choose governance factory

    const governanceFactoryAddress: Address = (() => {
      if (useNoOpGovernance) {
        // Prefer unified override; otherwise require chain's no-op governance factory
        const resolved = params.modules?.governanceFactory ?? (addresses.noOpGovernanceFactory ?? ZERO_ADDRESS)
        if (!resolved || resolved === ZERO_ADDRESS) {
          throw new Error('No-op governance requested, but no-op governanceFactory is not configured on this chain. Provide a governanceFactory override or use a supported chain.')
        }
        return resolved
      }
      const resolved = params.modules?.governanceFactory ?? addresses.governanceFactory
      if (!resolved || resolved === ZERO_ADDRESS) {
        throw new Error('Standard governance requested but governanceFactory is not deployed on this chain.')
      }
      return resolved
    })()

    // 5. Generate a unique salt
    // Resolve token factory with override priority
    const resolvedTokenFactory: Address | undefined =
      params.modules?.tokenFactory ?? (
        this.isDoppler404Token(params.token)
          ? (addresses.doppler404Factory as Address | undefined)
          : addresses.tokenFactory
      )

    if (!resolvedTokenFactory || resolvedTokenFactory === ZERO_ADDRESS) {
      throw new Error('Token factory address not configured. Provide an explicit address via builder.withTokenFactory(...) or ensure chain config includes a valid factory.')
    }

    // Build the base CreateParams for the V3-style ABI; salt will be mined below
    const baseCreateParams = {
      initialSupply: params.sale.initialSupply,
      numTokensToSell: params.sale.numTokensToSell,
      numeraire: params.sale.numeraire,
      tokenFactory: resolvedTokenFactory,
      tokenFactoryData: tokenFactoryData,
      governanceFactory: governanceFactoryAddress,
      governanceFactoryData: governanceFactoryData,
      poolInitializer: params.modules?.v3Initializer ?? addresses.v3Initializer,
      poolInitializerData: poolInitializerData,
      liquidityMigrator: this.getMigratorAddress(params.migration, params.modules),
      liquidityMigratorData: liquidityMigratorData,
      integrator: params.integrator ?? ZERO_ADDRESS,
    }

    const minedCreateParams = await this.mineTokenOrder({
      params,
      baseCreateParams,
      addresses,
    })

    return minedCreateParams
  }

  /**
   * Simulate a static auction creation and return predicted addresses.
   * Useful for pre-buy flows (bundle) to know the token/pool before sending.
   */
  async simulateCreateStaticAuction(params: CreateStaticAuctionParams<C>): Promise<{
    createParams: CreateParams
    asset: Address
    pool: Address
    gasEstimate?: bigint
  }> {
    const createParams = await this.encodeCreateStaticAuctionParams(params)
    const addresses = getAddresses(this.chainId)

    const airlockAddress = params.modules?.airlock ?? addresses.airlock
    const { request, result } = await (this.publicClient as PublicClient).simulateContract({
      address: airlockAddress,
      abi: airlockAbi,
      functionName: 'create',
      args: [{ ...createParams }],
      account: this.walletClient?.account,
    })
    const simResult = result as readonly unknown[] | undefined
    const gasEstimate = await this.resolveCreateGasEstimate({
      request,
      address: airlockAddress,
      createParams,
      account: this.walletClient?.account ?? params.userAddress,
    })

    if (!simResult || !Array.isArray(simResult) || simResult.length < 2) {
      throw new Error('Failed to simulate static auction create')
    }

    return {
      createParams,
      asset: simResult[0] as Address,
      pool: simResult[1] as Address,
      gasEstimate,
    }
  }

  /**
   * Create a new static auction (using Uniswap V3 for initial liquidity)
   * @param params Configuration for the static auction
   * @returns The address of the created pool and token
   */
  async createStaticAuction(params: CreateStaticAuctionParams<C>): Promise<{
    poolAddress: Address
    tokenAddress: Address
    transactionHash: string
  }> {
    const createParams = await this.encodeCreateStaticAuctionParams(params);

    const addresses = getAddresses(this.chainId)

    // Call the airlock contract to create the pool
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations')
    }
    
    const airlockAddress = params.modules?.airlock ?? addresses.airlock
    const { request, result } = await (this.publicClient as PublicClient).simulateContract({
      address: airlockAddress,
      abi: airlockAbi,
      functionName: 'create',
      args: [{ ...createParams }],
      account: this.walletClient.account,
    })
    const simResult = result as readonly unknown[] | undefined
    
    const gasEstimate = await this.resolveCreateGasEstimate({
      request,
      address: airlockAddress,
      createParams,
      account: this.walletClient.account,
    })
    const gasOverride = params.gas ?? gasEstimate ?? DEFAULT_CREATE_GAS_LIMIT
    const hash = await this.walletClient.writeContract({ ...request, gas: gasOverride })
    
    // Wait for transaction and get the receipt
    const receipt = await (this.publicClient as PublicClient).waitForTransactionReceipt({ hash, confirmations: 2 })
    
    // The create function returns [asset, pool, governance, timelock, migrationPool]
    // We can get these from the simulation result or parse from logs
    if (simResult && Array.isArray(simResult) && simResult.length >= 2) {
      return {
        tokenAddress: simResult[0] as Address, // asset
        poolAddress: simResult[1] as Address,  // pool
        transactionHash: hash
      }
    }
    
    // Fallback: Parse the Create event from logs
    const createEvent = (receipt.logs as readonly unknown[]).find((log: unknown) => {
      try {
        const decoded = decodeEventLog({
          abi: airlockAbi,
          data: (log as { data: Hex }).data,
          topics: (log as { topics: readonly `0x${string}`[] }).topics as [`0x${string}`, ...`0x${string}`[]],
        })
        return decoded.eventName === 'Create'
      } catch {
        return false
      }
    })
    
    if (createEvent) {
      const decoded = decodeEventLog({
        abi: airlockAbi,
        data: (createEvent as { data: Hex }).data,
        topics: (createEvent as { topics: readonly `0x${string}`[] }).topics as [`0x${string}`, ...`0x${string}`[]],
      })
      
      if (decoded.eventName === 'Create') {
        return {
          poolAddress: (decoded as { args: { poolOrHook: Address } }).args.poolOrHook,
          tokenAddress: (decoded as { args: { asset: Address } }).args.asset,
          transactionHash: hash
        }
      }
    }
    
    throw new Error('Failed to get pool and token addresses from transaction')
  }
  
  /**
   * Generate a random salt based on user address
   */
  protected generateRandomSalt(account: Address): Hex {
    // Use crypto.getRandomValues for secure random generation
    const array = new Uint8Array(32)
    
    // Try to use crypto API if available (Node.js or browser)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array)
    } else {
      // Fallback: use timestamp and account for deterministic generation
      const timestamp = Date.now()
      const timestampBytes = new Uint8Array(8)
      for (let i = 0; i < 8; i++) {
        timestampBytes[i] = (timestamp >> (i * 8)) & 0xff
      }
      
      // Fill array with timestamp and account-based entropy
      for (let i = 0; i < 32; i++) {
        if (i < 8) {
          array[i] = timestampBytes[i]
        } else {
          array[i] = i
        }
      }
    }
    
    // XOR with address bytes for additional entropy
    if (account) {
      const addressBytes = account.slice(2).padStart(40, '0')
      for (let i = 0; i < 20; i++) {
        const addressByte = parseInt(
          addressBytes.slice(i * 2, (i + 1) * 2),
          16
        )
        array[i] ^= addressByte
      }
    }
    
    return `0x${Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}` as Hex
  }

  /**
   * Iteratively mine a salt that ensures the newly created token sorts after the numeraire.
   * This mirrors the legacy SDK behaviour so tick configuration can assume the numeraire is token0.
   */
  protected async mineTokenOrder(args: {
    params: CreateStaticAuctionParams<C>
    baseCreateParams: Omit<CreateParams, 'salt'>
    addresses: ReturnType<typeof getAddresses>
  }): Promise<CreateParams> {
    const { params, baseCreateParams, addresses } = args

    const airlockAddress = params.modules?.airlock ?? addresses.airlock
    if (!airlockAddress || airlockAddress === ZERO_ADDRESS) {
      throw new Error('Airlock address not configured. Provide an explicit address via modules.airlock or ensure chain config includes a valid airlock.')
    }

    const accountForSimulation = this.walletClient?.account ?? params.userAddress
    const numeraireBigInt = BigInt(params.sale.numeraire)

    let attempt = 0n
    const maxAttempts = 256n
    let salt = this.generateRandomSalt(params.userAddress)

    while (attempt < maxAttempts) {
      const createParams = { ...baseCreateParams, salt } as CreateParams

      const { result } = await (this.publicClient as PublicClient).simulateContract({
        address: airlockAddress,
        abi: airlockAbi,
        functionName: 'create',
        args: [{ ...createParams }],
        account: accountForSimulation,
      })

      const simResult = result as readonly unknown[] | undefined
      if (!simResult || !Array.isArray(simResult) || simResult.length < 2) {
        throw new Error('Failed to simulate static auction create while mining token ordering')
      }

      const tokenAddress = simResult[0] as Address
      if (BigInt(tokenAddress) > numeraireBigInt) {
        return createParams
      }

      attempt += 1n
      const incrementedAccount = toHex(BigInt(params.userAddress) + attempt) as Address
      salt = this.generateRandomSalt(incrementedAccount)
    }

    throw new Error('Token mining exceeded iteration limit while trying to force token order. Try again or provide a different user address.')
  }

  async encodeCreateDynamicAuctionParams(params: CreateDynamicAuctionParams<C>): Promise<{
    createParams: CreateParams,
    hookAddress: Address,
    tokenAddress: Address
  }> {
     // Validate parameters
    this.validateDynamicAuctionParams(params)

    const addresses = getAddresses(this.chainId)

    // 1. Calculate gamma if not provided
    const gamma = params.auction.gamma ?? computeOptimalGamma(
      params.auction.startTick,
      params.auction.endTick,
      params.auction.duration,
      params.auction.epochLength,
      params.pool.tickSpacing
    )

    // 2. Prepare time parameters
    // Use provided block timestamp or fetch the latest
    let blockTimestamp: number
    if (params.blockTimestamp !== undefined) {
      blockTimestamp = params.blockTimestamp
    } else {
      const latestBlock = await (this.publicClient as PublicClient).getBlock({ blockTag: 'latest' })
      blockTimestamp = Number((latestBlock as { timestamp: bigint | number }).timestamp)
    }

    // Use startTimeOffset if provided, otherwise default to 30 seconds
    const startTimeOffset = params.startTimeOffset ?? 30
    const startTime = blockTimestamp + startTimeOffset
    const endTime = blockTimestamp + params.auction.duration + startTimeOffset

    // 3. Prepare hook initialization data
    const dopplerData = {
      minimumProceeds: params.auction.minProceeds,
      maximumProceeds: params.auction.maxProceeds,
      startingTime: BigInt(startTime),
      endingTime: BigInt(endTime),
      startingTick: params.auction.startTick,
      endingTick: params.auction.endTick,
      epochLength: BigInt(params.auction.epochLength),
      gamma,
      isToken0: false, // Will be determined during mining
      numPDSlugs: BigInt(params.auction.numPdSlugs ?? DEFAULT_PD_SLUGS),
      fee: params.pool.fee,
      tickSpacing: params.pool.tickSpacing
    }

    // 4. Prepare token parameters (standard vs Doppler404)
    if (this.isDoppler404Token(params.token)) {
      if (!addresses.doppler404Factory || addresses.doppler404Factory === ZERO_ADDRESS) {
        throw new Error('Doppler404 factory address not configured for this chain')
      }
    }

    const vestingDuration = params.vesting?.duration ?? BigInt(0)
    const tokenFactoryData = this.isDoppler404Token(params.token)
      ? (() => {
          const t = params.token as Doppler404TokenConfig
          return {
            name: t.name,
            symbol: t.symbol,
            baseURI: t.baseURI,
            unit: t.unit !== undefined ? BigInt(t.unit) : 1000n,
          }
        })()
      : (() => {
          const t = params.token as StandardTokenConfig

          // Handle vesting recipients and amounts
          let vestingRecipients: Address[] = []
          let vestingAmounts: bigint[] = []

          if (params.vesting) {
            if (params.vesting.recipients && params.vesting.amounts) {
              // Use provided recipients and amounts
              vestingRecipients = params.vesting.recipients
              vestingAmounts = params.vesting.amounts
            } else {
              // Default: vest all non-sold tokens to userAddress
              vestingRecipients = [params.userAddress]
              vestingAmounts = [params.sale.initialSupply - params.sale.numTokensToSell]
            }
          }

          return {
            name: t.name,
            symbol: t.symbol,
            initialSupply: params.sale.initialSupply,
            airlock: addresses.airlock,
            yearlyMintRate: t.yearlyMintRate ?? DEFAULT_V4_YEARLY_MINT_RATE,
            vestingDuration: BigInt(vestingDuration),
            recipients: vestingRecipients,
            amounts: vestingAmounts,
            tokenURI: t.tokenURI,
          }
        })()

    // 5. Mine hook address with appropriate flags
    // Resolve token factory with override priority (works for both standard and doppler404 variants)
    const resolvedTokenFactoryDyn: Address | undefined =
      params.modules?.tokenFactory ?? (
        this.isDoppler404Token(params.token)
          ? (addresses.doppler404Factory as Address | undefined)
          : addresses.tokenFactory
      )

    if (!resolvedTokenFactoryDyn || resolvedTokenFactoryDyn === ZERO_ADDRESS) {
      throw new Error('Token factory address not configured. Provide an explicit address via builder.withTokenFactory(...) or ensure chain config includes a valid factory.')
    }

    const [salt, hookAddress, tokenAddress, poolInitializerData, encodedTokenFactoryData] = this.mineHookAddress({
      airlock: params.modules?.airlock ?? addresses.airlock,
      poolManager: params.modules?.poolManager ?? addresses.poolManager,
      deployer: params.modules?.dopplerDeployer ?? addresses.dopplerDeployer,
      initialSupply: params.sale.initialSupply,
      numTokensToSell: params.sale.numTokensToSell,
      numeraire: params.sale.numeraire,
      tokenFactory: resolvedTokenFactoryDyn,
      tokenFactoryData: tokenFactoryData,
      poolInitializer: params.modules?.v4Initializer ?? addresses.v4Initializer,
      poolInitializerData: dopplerData,
      tokenVariant: this.isDoppler404Token(params.token) ? 'doppler404' : 'standard'
    })

    // 6. Encode migration data
    const liquidityMigratorData = this.encodeMigrationData(params.migration)

    const useNoOpGovernance = params.governance.type === 'noOp'

    // 7. Encode governance factory data
    const governanceFactoryData: Hex = useNoOpGovernance
      ? ('0x' as Hex)
      : encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'uint48' },
          { type: 'uint32' },
          { type: 'uint256' },
        ],
        [
          params.token.name,
          params.governance.type === 'custom' ? params.governance.initialVotingDelay : DEFAULT_V4_INITIAL_VOTING_DELAY,
          params.governance.type === 'custom' ? params.governance.initialVotingPeriod : DEFAULT_V4_INITIAL_VOTING_PERIOD,
          params.governance.type === 'custom' ? params.governance.initialProposalThreshold : DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD
        ]
      )

    // 7.1 Choose governance factory

    const governanceFactoryAddress: Address = (() => {
      if (useNoOpGovernance) {
        // Prefer unified override; otherwise require chain's no-op governance factory
        const resolved = params.modules?.governanceFactory ?? (addresses.noOpGovernanceFactory ?? ZERO_ADDRESS)
        if (!resolved || resolved === ZERO_ADDRESS) {
          throw new Error('No-op governance requested, but no-op governanceFactory is not configured on this chain. Provide a governanceFactory override or use a supported chain.')
        }
        return resolved
      }
      const resolved = params.modules?.governanceFactory ?? addresses.governanceFactory
      if (!resolved || resolved === ZERO_ADDRESS) {
        throw new Error('Standard governance requested but governanceFactory is not deployed on this chain.')
      }
      return resolved
    })()

    // 8. Build the complete CreateParams for the V4-style ABI
    const createParams = {
      initialSupply: params.sale.initialSupply,
      numTokensToSell: params.sale.numTokensToSell,
      numeraire: params.sale.numeraire,
      tokenFactory: resolvedTokenFactoryDyn,
      tokenFactoryData: encodedTokenFactoryData,
      governanceFactory: governanceFactoryAddress,
      governanceFactoryData: governanceFactoryData,
      poolInitializer: params.modules?.v4Initializer ?? addresses.v4Initializer,
      poolInitializerData: poolInitializerData,
      liquidityMigrator: this.getMigratorAddress(params.migration, params.modules),
      liquidityMigratorData: liquidityMigratorData,
      integrator: params.integrator ?? ZERO_ADDRESS,
      salt: salt,
    }

    return { createParams, hookAddress, tokenAddress }
  }

  /**
   * Create a new dynamic auction (using Uniswap V4 hook for gradual Dutch auction)
   * @param params Configuration for the dynamic auction
   * @returns The address of the created hook and token
   */
  async createDynamicAuction(params: CreateDynamicAuctionParams<C>): Promise<{
    hookAddress: Address
    tokenAddress: Address
    poolId: string
    transactionHash: string
  }> {
    const addresses = getAddresses(this.chainId)

    const { createParams, hookAddress, tokenAddress } = await this.encodeCreateDynamicAuctionParams(params);


    // Call the airlock contract to create the pool
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations')
    }
    
    const airlockAddress = params.modules?.airlock ?? addresses.airlock
    const { request, result } = await (this.publicClient as PublicClient).simulateContract({
      address: airlockAddress,
      abi: airlockAbi,
      functionName: 'create',
      args: [{ ...createParams }],
      account: this.walletClient.account,
    })
    const simResult = result as readonly unknown[] | undefined
    
    const gasEstimate = await this.resolveCreateGasEstimate({
      request,
      address: airlockAddress,
      createParams,
      account: this.walletClient.account,
    })
    const gasOverride = params.gas ?? gasEstimate ?? DEFAULT_CREATE_GAS_LIMIT
    const hash = await this.walletClient.writeContract({ ...request, gas: gasOverride })
    
    // Wait for transaction and get the receipt
    const receipt = await (this.publicClient as PublicClient).waitForTransactionReceipt({ hash })
    
    // Get actual addresses from the return value or event logs
    let actualHookAddress: Address = hookAddress
    let actualTokenAddress: Address = tokenAddress
    
    if (simResult && Array.isArray(simResult) && simResult.length >= 2) {
      // Tests expect [asset, poolOrHook]
      actualTokenAddress = simResult[0] as Address
      actualHookAddress = simResult[1] as Address
    } else {
      // Fallback: Parse the Create event from logs
      const createEvent = (receipt.logs as readonly unknown[]).find((log: unknown) => {
        try {
          const decoded = decodeEventLog({
            abi: airlockAbi,
            data: (log as { data: Hex }).data,
            topics: (log as { topics: readonly `0x${string}`[] }).topics as [`0x${string}`, ...`0x${string}`[]],
          })
          return decoded.eventName === 'Create'
        } catch {
          return false
        }
      })
      
      if (createEvent) {
        const decoded = decodeEventLog({
          abi: airlockAbi,
          data: (createEvent as { data: Hex }).data,
          topics: (createEvent as { topics: readonly `0x${string}`[] }).topics as [`0x${string}`, ...`0x${string}`[]],
        })
        
        if (decoded.eventName === 'Create') {
          actualHookAddress = (decoded as { args: { poolOrHook: Address } }).args.poolOrHook
          actualTokenAddress = (decoded as { args: { asset: Address } }).args.asset
        }
      }
    }
    
    // Calculate pool ID for V4 using actual addresses
    const poolId = this.computePoolId({
      currency0: actualTokenAddress < params.sale.numeraire ? actualTokenAddress : params.sale.numeraire,
      currency1: actualTokenAddress < params.sale.numeraire ? params.sale.numeraire : actualTokenAddress,
      fee: params.pool.fee,
      tickSpacing: params.pool.tickSpacing,
      hooks: actualHookAddress
    })
    
    return {
      hookAddress: actualHookAddress,
      tokenAddress: actualTokenAddress,
      poolId,
      transactionHash: hash
    }
  }

  /**
   * Simulate a dynamic auction creation and return predicted addresses and poolId.
   * Useful for clients that need the hook/token/poolId before submitting the tx.
   */
  async simulateCreateDynamicAuction(params: CreateDynamicAuctionParams<C>): Promise<{
    createParams: CreateParams
    hookAddress: Address
    tokenAddress: Address
    poolId: string
    gasEstimate?: bigint
  }> {
    const { createParams } = await this.encodeCreateDynamicAuctionParams(params)
    const addresses = getAddresses(this.chainId)

    const airlockAddress = params.modules?.airlock ?? addresses.airlock
    const { request, result } = await (this.publicClient as PublicClient).simulateContract({
      address: airlockAddress,
      abi: airlockAbi,
      functionName: 'create',
      args: [{ ...createParams }],
      account: this.walletClient?.account,
    })
    const simResult = result as readonly unknown[] | undefined
    const gasEstimate = await this.resolveCreateGasEstimate({
      request,
      address: airlockAddress,
      createParams,
      account: this.walletClient?.account ?? params.userAddress,
    })

    if (!simResult || !Array.isArray(simResult) || simResult.length < 2) {
      throw new Error('Failed to simulate dynamic auction create')
    }

    const tokenAddress = simResult[0] as Address
    const hookAddress = simResult[1] as Address

    const poolId = this.computePoolId({
      currency0: tokenAddress < params.sale.numeraire ? tokenAddress : params.sale.numeraire,
      currency1: tokenAddress < params.sale.numeraire ? params.sale.numeraire : tokenAddress,
      fee: params.pool.fee,
      tickSpacing: params.pool.tickSpacing,
      hooks: hookAddress,
    })

    return { createParams, hookAddress, tokenAddress, poolId, gasEstimate }
  }

  protected async resolveCreateGasEstimate(args: {
    request?: unknown
    address: Address
    createParams: CreateParams
    account?: Address | Account
  }): Promise<bigint | undefined> {
    const { request, address, createParams, account } = args
    const gasFromRequest =
      request && typeof request === 'object' && 'gas' in (request as Record<string, unknown>)
        ? (request as { gas?: bigint }).gas
        : undefined

    if (gasFromRequest) {
      return gasFromRequest
    }

    try {
      const estimated = await (this.publicClient as PublicClient).estimateContractGas({
        address,
        abi: airlockAbi,
        functionName: 'create',
        args: [{ ...createParams }],
        account,
      })
      return estimated
    } catch {
      return undefined
    }
  }

  protected isDoppler404Token(token: TokenConfig): token is Doppler404TokenConfig {
    return (token as Doppler404TokenConfig).type === 'doppler404'
  }

  /**
   * Encode migration data based on the MigrationConfig
   * This replaces the manual encoding methods from the old SDKs
   */
  protected encodeMigrationData(config: MigrationConfig): Hex {
    // Use custom encoder if available
    if (this.customMigrationEncoder) {
      return this.customMigrationEncoder(config)
    }

    switch (config.type) {
      case 'uniswapV2':
        // V2 migrator expects empty data
        return '0x' as Hex

      case 'noOp':
        // NoOp migrator expects empty data
        return '0x' as Hex

      case 'uniswapV3':
        // Encode V3 migration data: fee and tick spacing
        const expectedSpacing = (TICK_SPACINGS as Record<number, number>)[config.fee]
        if (expectedSpacing !== undefined && config.tickSpacing === expectedSpacing) {
          // Match legacy behaviour: default configuration emits empty payload
          return '0x'
        }
        return encodeAbiParameters(
          [
            { type: 'uint24' }, // fee
            { type: 'int24' }   // tickSpacing
          ],
          [config.fee, config.tickSpacing]
        )

      case 'uniswapV4':
        // Encode V4 migration data with optional streamable fees config
        // When streamableFees is omitted, mirror legacy SDK behaviour by emitting an empty payload
        const streamableFees = config.streamableFees
        if (!streamableFees) {
          // Default V4 migrator behaviour: no additional payload required
          return '0x'
        }

        // Copy beneficiaries and sort by address in ascending order (required by contract)
        const beneficiaryData = [...streamableFees.beneficiaries].sort((a, b) => {
          const addrA = a.beneficiary.toLowerCase()
          const addrB = b.beneficiary.toLowerCase()
          return addrA < addrB ? -1 : addrA > addrB ? 1 : 0
        })

        // Note: The contract will validate that the airlock owner gets at least 5%
        // If not present, the SDK user should add it manually

        return encodeAbiParameters(
          [
            { type: 'uint24' },  // fee
            { type: 'int24' },   // tickSpacing
            { type: 'uint32' },  // lockDuration (0 if no streamableFees)
            {
              type: 'tuple[]',
              components: [
                { type: 'address', name: 'beneficiary' },
                { type: 'uint96', name: 'shares' }
              ]
            }
          ],
          [
            config.fee,
            config.tickSpacing,
            streamableFees.lockDuration,
            beneficiaryData
          ]
        )


      default:
        throw new Error('Unknown migration type')
    }
  }

  /**
   * Encode create params for Uniswap V4 Multicurve initializer/migrator flow
   */
  encodeCreateMulticurveParams(params: CreateMulticurveParams<C>): CreateParams {
    // Basic validation
    if (!params.pool || params.pool.curves.length === 0) {
      throw new Error('Multicurve pool must include at least one curve')
    }

    const normalizedCurves = this.normalizeMulticurveCurves(params.pool.curves, params.pool.tickSpacing)

    const addresses = getAddresses(this.chainId)

    // Pool initializer data: (fee, tickSpacing, curves[], beneficiaries[])
    const sortedBeneficiaries = (params.pool.beneficiaries ?? []).slice().sort((a: NonNullable<typeof params.pool.beneficiaries>[number], b: NonNullable<typeof params.pool.beneficiaries>[number]) => {
      const aAddr = a.beneficiary.toLowerCase()
      const bAddr = b.beneficiary.toLowerCase()
      return aAddr < bAddr ? -1 : aAddr > bAddr ? 1 : 0
    })

    const useScheduledInitializer = params.schedule !== undefined

    let scheduleStartTime: number | undefined
    if (useScheduledInitializer) {
      scheduleStartTime = Number(params.schedule!.startTime)
      if (!Number.isFinite(scheduleStartTime) || !Number.isInteger(scheduleStartTime)) {
        throw new Error('Scheduled multicurve startTime must be an integer number of seconds since Unix epoch')
      }
      if (scheduleStartTime < 0) {
        throw new Error('Scheduled multicurve startTime cannot be negative')
      }
      const UINT32_MAX = 0xffffffff
      if (scheduleStartTime > UINT32_MAX) {
        throw new Error('Scheduled multicurve startTime must fit within uint32 (seconds since Unix epoch up to year 2106)')
      }
    }

    const poolInitializerTupleComponents = [
      { name: 'fee', type: 'uint24' },
      { name: 'tickSpacing', type: 'int24' },
      {
        name: 'curves',
        type: 'tuple[]',
        components: [
          { type: 'int24', name: 'tickLower' },
          { type: 'int24', name: 'tickUpper' },
          { type: 'uint16', name: 'numPositions' },
          { type: 'uint256', name: 'shares' }
        ]
      },
      {
        name: 'beneficiaries',
        type: 'tuple[]',
        components: [
          { type: 'address', name: 'beneficiary' },
          { type: 'uint96', name: 'shares' }
        ]
      }
    ]

    if (useScheduledInitializer) {
      poolInitializerTupleComponents.push({ name: 'startingTime', type: 'uint32' })
    }

    const baseInitializerParams = {
      fee: params.pool.fee,
      tickSpacing: params.pool.tickSpacing,
      curves: normalizedCurves.map((c: typeof normalizedCurves[number]) => ({
        tickLower: c.tickLower,
        tickUpper: c.tickUpper,
        numPositions: c.numPositions,
        shares: c.shares
      })),
      beneficiaries: sortedBeneficiaries.map((b: NonNullable<typeof params.pool.beneficiaries>[number]) => ({
        beneficiary: b.beneficiary,
        shares: b.shares
      }))
    }

    const poolInitializerValue = useScheduledInitializer
      ? { ...baseInitializerParams, startingTime: scheduleStartTime! }
      : baseInitializerParams

    const poolInitializerData = encodeAbiParameters(
      [{ type: 'tuple', components: poolInitializerTupleComponents }],
      [poolInitializerValue]
    )

    // Token factory data (standard vs 404)
    let tokenFactoryData: Hex
    if (this.isDoppler404Token(params.token)) {
      const token404 = params.token
      const unit = token404.unit !== undefined ? BigInt(token404.unit) : 1000n
      tokenFactoryData = encodeAbiParameters(
        [ { type: 'string' }, { type: 'string' }, { type: 'string' }, { type: 'uint256' } ],
        [ token404.name, token404.symbol, token404.baseURI, unit ]
      )
    } else {
      const tokenStd = params.token as StandardTokenConfig
      const vestingDuration = params.vesting?.duration ?? BigInt(0)
      const yearlyMintRate = tokenStd.yearlyMintRate ?? DEFAULT_V3_YEARLY_MINT_RATE

      // Handle vesting recipients and amounts
      let vestingRecipients: Address[] = []
      let vestingAmounts: bigint[] = []

      if (params.vesting) {
        if (params.vesting.recipients && params.vesting.amounts) {
          // Use provided recipients and amounts
          vestingRecipients = params.vesting.recipients
          vestingAmounts = params.vesting.amounts
        } else {
          // Default: vest all non-sold tokens to userAddress
          vestingRecipients = [params.userAddress]
          vestingAmounts = [params.sale.initialSupply - params.sale.numTokensToSell]
        }
      }

      tokenFactoryData = encodeAbiParameters(
        [ { type: 'string' }, { type: 'string' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'address[]' }, { type: 'uint256[]' }, { type: 'string' } ],
        [ tokenStd.name, tokenStd.symbol, yearlyMintRate, BigInt(vestingDuration), vestingRecipients, vestingAmounts, tokenStd.tokenURI ]
      )
    }

    const useNoOpGovernance = params.governance.type === 'noOp'

    // Governance factory data
    const governanceFactoryData: Hex = useNoOpGovernance
      ? ('0x' as Hex)
      : encodeAbiParameters(
        [ { type: 'string' }, { type: 'uint48' }, { type: 'uint32' }, { type: 'uint256' } ],
        [
          params.token.name,
          params.governance.type === 'custom' ? params.governance.initialVotingDelay : DEFAULT_V4_INITIAL_VOTING_DELAY,
          params.governance.type === 'custom' ? params.governance.initialVotingPeriod : DEFAULT_V4_INITIAL_VOTING_PERIOD,
          params.governance.type === 'custom' ? params.governance.initialProposalThreshold : DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD
        ]
      )

    // Resolve module addresses
    const salt = this.generateRandomSalt(params.userAddress)
    const resolvedTokenFactory: Address | undefined = params.modules?.tokenFactory ?? (
      this.isDoppler404Token(params.token) ? (addresses.doppler404Factory as Address | undefined) : addresses.tokenFactory
    )
    if (!resolvedTokenFactory || resolvedTokenFactory === ZERO_ADDRESS) {
      throw new Error('Token factory address not configured. Provide an explicit address or ensure chain config includes a valid factory.')
    }

    const resolvedInitializer: Address | undefined = (() => {
      if (useScheduledInitializer) {
        return params.modules?.v4ScheduledMulticurveInitializer ?? addresses.v4ScheduledMulticurveInitializer
      }
      return params.modules?.v4MulticurveInitializer ?? addresses.v4MulticurveInitializer
    })()
    if (!resolvedInitializer || resolvedInitializer === ZERO_ADDRESS) {
      throw new Error(
        useScheduledInitializer
          ? 'Scheduled multicurve initializer address not configured on this chain. Override via builder or update chain config.'
          : 'Multicurve initializer address not configured on this chain. Override via builder or update chain config.'
      )
    }

    // When beneficiaries are provided, use NoOpMigrator with empty data
    // The beneficiaries will be handled by the multicurve initializer, not the migrator
    const hasBeneficiaries = params.pool.beneficiaries && params.pool.beneficiaries.length > 0

    let liquidityMigratorData: Hex
    let resolvedMigrator: Address | undefined

    if (hasBeneficiaries) {
      // Use NoOpMigrator with empty data when beneficiaries are provided
      liquidityMigratorData = '0x' as Hex
      resolvedMigrator = params.modules?.noOpMigrator ?? addresses.noOpMigrator
      if (!resolvedMigrator || resolvedMigrator === ZERO_ADDRESS) {
        throw new Error('NoOpMigrator address not configured on this chain. Override via modules.noOpMigrator or update chain config.')
      }
    } else {
      // Use standard migration flow when no beneficiaries
      liquidityMigratorData = this.encodeMigrationData(params.migration)
      resolvedMigrator = this.getMigratorAddress(params.migration, params.modules)
      if (!resolvedMigrator || resolvedMigrator === ZERO_ADDRESS) {
        throw new Error('Migrator address not configured on this chain. Override via builder or update chain config.')
      }
    }

    const governanceFactoryAddress: Address = (() => {
      if (useNoOpGovernance) {
        const resolved = params.modules?.governanceFactory ?? (addresses.noOpGovernanceFactory ?? ZERO_ADDRESS)
        if (!resolved || resolved === ZERO_ADDRESS) {
          throw new Error('No-op governance requested, but no-op governanceFactory is not configured on this chain.')
        }
        return resolved
      }
      const resolved = params.modules?.governanceFactory ?? addresses.governanceFactory
      if (!resolved || resolved === ZERO_ADDRESS) {
        throw new Error('Standard governance requested but governanceFactory is not deployed on this chain.')
      }
      return resolved
    })()

    const createParams: CreateParams = {
      initialSupply: params.sale.initialSupply,
      numTokensToSell: params.sale.numTokensToSell,
      numeraire: params.sale.numeraire,
      tokenFactory: resolvedTokenFactory,
      tokenFactoryData,
      governanceFactory: governanceFactoryAddress,
      governanceFactoryData,
      poolInitializer: resolvedInitializer,
      poolInitializerData,
      liquidityMigrator: resolvedMigrator,
      liquidityMigratorData,
      integrator: params.integrator ?? ZERO_ADDRESS,
      salt,
    }

    return createParams
  }

  async simulateCreateMulticurve(params: CreateMulticurveParams<C>): Promise<{
    createParams: CreateParams
    asset: Address
    pool: Address
    gasEstimate?: bigint
  }> {
    const createParams = this.encodeCreateMulticurveParams(params)
    const addresses = getAddresses(this.chainId)
    const airlockAddress = params.modules?.airlock ?? addresses.airlock
    const { request, result } = await (this.publicClient as PublicClient).simulateContract({
      address: airlockAddress,
      abi: airlockAbi,
      functionName: 'create',
      args: [{ ...createParams }],
      account: this.walletClient?.account,
    })
    const simResult = result as readonly unknown[] | undefined
    const gasEstimate = await this.resolveCreateGasEstimate({
      request,
      address: airlockAddress,
      createParams,
      account: this.walletClient?.account ?? params.userAddress,
    })
    if (!simResult || !Array.isArray(simResult) || simResult.length < 2) {
      throw new Error('Failed to simulate multicurve create')
    }
    return {
      createParams,
      asset: simResult[0] as Address,
      pool: simResult[1] as Address,
      gasEstimate,
    }
  }

  async createMulticurve(params: CreateMulticurveParams<C>): Promise<{ poolAddress: Address; tokenAddress: Address; transactionHash: string }> {
    const createParams = this.encodeCreateMulticurveParams(params)
    const addresses = getAddresses(this.chainId)
    if (!this.walletClient) throw new Error('Wallet client required for write operations')
    const airlockAddress = params.modules?.airlock ?? addresses.airlock
    const { request, result } = await (this.publicClient as PublicClient).simulateContract({
      address: airlockAddress,
      abi: airlockAbi,
      functionName: 'create',
      args: [{ ...createParams }],
      account: this.walletClient.account,
    })
    const simResult = result as readonly unknown[] | undefined
    const gasEstimate = await this.resolveCreateGasEstimate({
      request,
      address: airlockAddress,
      createParams,
      account: this.walletClient.account,
    })
    const gas = params.gas ?? gasEstimate ?? DEFAULT_CREATE_GAS_LIMIT
    const hash = await this.walletClient.writeContract({ ...request, gas })
    await (this.publicClient as PublicClient).waitForTransactionReceipt({ hash, confirmations: 2 })
    if (simResult && Array.isArray(simResult) && simResult.length >= 2) {
      return { tokenAddress: simResult[0] as Address, poolAddress: simResult[1] as Address, transactionHash: hash }
    }
    throw new Error('Failed to get pool/token addresses from multicurve create')
  }

  /**
   * Normalize user-provided multicurve positions and ensure they satisfy SDK constraints
   */
  protected normalizeMulticurveCurves(
    curves: CreateMulticurveParams['pool']['curves'],
    tickSpacing: number
  ): CreateMulticurveParams['pool']['curves'] {
    if (tickSpacing <= 0) {
      throw new Error('Tick spacing must be positive')
    }
    if (!curves.length) {
      throw new Error('Multicurve pool must include at least one curve')
    }

    let totalShares = 0n
    let mostPositiveTickUpper: number | undefined

    const sanitizedCurves = curves.map(curve => {
      const sanitized = { ...curve }

      if (!Number.isFinite(sanitized.tickLower) || !Number.isFinite(sanitized.tickUpper)) {
        throw new Error('Multicurve ticks must be finite numbers')
      }
      if (sanitized.tickLower >= sanitized.tickUpper) {
        throw new Error('Multicurve curve tickLower must be less than tickUpper')
      }
      if (sanitized.tickLower <= 0 || sanitized.tickUpper <= 0) {
        console.warn('Warning: Using negative or zero ticks in multicurve configuration. Please verify this is intentional before proceeding.')
      }
      if (!Number.isInteger(sanitized.numPositions) || sanitized.numPositions <= 0) {
        throw new Error('Multicurve curve numPositions must be a positive integer')
      }
      if (sanitized.shares <= 0n) {
        throw new Error('Multicurve curve shares must be positive')
      }

      totalShares += sanitized.shares
      if (totalShares > WAD) {
        throw new Error('Total multicurve shares cannot exceed 100% (1e18)')
      }

      if (mostPositiveTickUpper === undefined || sanitized.tickUpper > mostPositiveTickUpper) {
        mostPositiveTickUpper = sanitized.tickUpper
      }

      return sanitized
    })

    if (totalShares === WAD) {
      return sanitizedCurves
    }

    const missingShare = WAD - totalShares
    if (missingShare <= 0n) {
      return sanitizedCurves
    }

    const fallbackTickLower = mostPositiveTickUpper
    if (fallbackTickLower === undefined) {
      throw new Error('Unable to determine fallback multicurve tick range')
    }

    const fallbackTickUpper = this.roundMaxTickDown(tickSpacing)

    const fallbackCurve = {
      // Extend from the most positive user tick out to the maximum supported tick bucket
      tickLower: fallbackTickLower,
      tickUpper: fallbackTickUpper,
      numPositions: sanitizedCurves[sanitizedCurves.length - 1]?.numPositions ?? 1,
      shares: missingShare,
    }

    return [...sanitizedCurves, fallbackCurve]
  }

  protected roundMaxTickDown(tickSpacing: number): number {
    if (tickSpacing <= 0) {
      throw new Error('Tick spacing must be positive')
    }

    const rounded = Math.floor(MAX_TICK / tickSpacing) * tickSpacing
    return rounded
  }

  protected validateStaticAuctionParams(params: CreateStaticAuctionParams): void {
    // Validate token parameters
    if (!params.token.name || params.token.name.trim().length === 0) {
      throw new Error('Token name is required')
    }
    if (!params.token.symbol || params.token.symbol.trim().length === 0) {
      throw new Error('Token symbol is required')
    }
    
    // Validate tick range
    if (params.pool.startTick >= params.pool.endTick) {
      throw new Error('Start tick must be less than end tick')
    }

    const tickSpacing = (TICK_SPACINGS as Record<number, number>)[params.pool.fee]
    if (tickSpacing === undefined) {
      throw new Error(`Unsupported fee tier ${params.pool.fee} for static auctions`)
    }

    if (params.pool.startTick < MIN_TICK || params.pool.endTick > MAX_TICK) {
      throw new Error(`Ticks must be within the allowed range (${MIN_TICK} to ${MAX_TICK})`)
    }

    const startTickAligned = params.pool.startTick % tickSpacing === 0
    const endTickAligned = params.pool.endTick % tickSpacing === 0
    if (!startTickAligned || !endTickAligned) {
      throw new Error(`Pool ticks must be multiples of tick spacing ${tickSpacing} for fee tier ${params.pool.fee}`)
    }
    
    // Validate sale config
    if (params.sale.initialSupply <= BigInt(0)) {
      throw new Error('Initial supply must be positive')
    }
    if (params.sale.numTokensToSell <= BigInt(0)) {
      throw new Error('Number of tokens to sell must be positive')
    }
    if (params.sale.numTokensToSell > params.sale.initialSupply) {
      throw new Error('Cannot sell more tokens than initial supply')
    }
    
    // Validate vesting if provided
    if (params.vesting) {
      // Validate recipients and amounts arrays match
      if (params.vesting.recipients && params.vesting.amounts) {
        if (params.vesting.recipients.length !== params.vesting.amounts.length) {
          throw new Error('Vesting recipients and amounts arrays must have the same length')
        }
        if (params.vesting.recipients.length === 0) {
          throw new Error('Vesting recipients array cannot be empty')
        }
        // Validate total vested amount doesn't exceed available tokens
        const totalVested = params.vesting.amounts.reduce((sum, amt) => sum + amt, BigInt(0))
        const availableForVesting = params.sale.initialSupply - params.sale.numTokensToSell
        if (totalVested > availableForVesting) {
          throw new Error(`Total vesting amount (${totalVested}) exceeds available tokens (${availableForVesting})`)
        }
      } else {
        // Default case: validate there are tokens available for vesting
        const vestedAmount = params.sale.initialSupply - params.sale.numTokensToSell
        if (vestedAmount <= BigInt(0)) {
          throw new Error('No tokens available for vesting')
        }
      }
    }
    
    // Validate migration config
    if (params.migration.type === 'uniswapV4' && params.migration.streamableFees) {
      const beneficiaries = params.migration.streamableFees.beneficiaries
      if (beneficiaries.length === 0) {
        throw new Error('At least one beneficiary is required for V4 migration')
      }
      
      // Check that shares sum to 100% (WAD)
      const totalShares = beneficiaries.reduce((sum, b) => sum + b.shares, 0n)
      if (totalShares !== WAD) {
        throw new Error(`Beneficiary shares must sum to ${WAD} (100%), but got ${totalShares}`)
      }
    }
  }

  /**
   * Validate dynamic auction parameters
   */
  protected validateDynamicAuctionParams(params: CreateDynamicAuctionParams): void {
    // Validate token parameters
    if (!params.token.name || params.token.name.trim().length === 0) {
      throw new Error('Token name is required')
    }
    if (!params.token.symbol || params.token.symbol.trim().length === 0) {
      throw new Error('Token symbol is required')
    }
    
    // Validate tick range
    const isToken0 = isToken0Expected(params.sale.numeraire)
    if (isToken0 && params.auction.startTick <= params.auction.endTick) {
      throw new Error('Start tick must be greater than end tick if base token is currency0')
    }
    if (!isToken0 && params.auction.startTick >= params.auction.endTick) {
      throw new Error('Start tick must be less than end tick if base token is currency1')
    }

    // Validate sale config
    if (params.sale.initialSupply <= BigInt(0)) {
      throw new Error('Initial supply must be positive')
    }
    if (params.sale.numTokensToSell <= BigInt(0)) {
      throw new Error('Number of tokens to sell must be positive')
    }
    if (params.sale.numTokensToSell > params.sale.initialSupply) {
      throw new Error('Cannot sell more tokens than initial supply')
    }
    
    // Validate auction parameters
    if (params.auction.duration <= 0) {
      throw new Error('Auction duration must be positive')
    }
    if (params.auction.epochLength <= 0) {
      throw new Error('Epoch length must be positive')
    }
    if (params.pool.tickSpacing <= 0) {
      throw new Error('Tick spacing must be positive')
    }
    
    // Validate that total duration is divisible by epoch length
    if (params.auction.duration % params.auction.epochLength !== 0) {
      throw new Error('Epoch length must divide total duration evenly')
    }
    
    // Validate gamma if provided
    if (params.auction.gamma !== undefined) {
      if (params.auction.gamma % params.pool.tickSpacing !== 0) {
        throw new Error('Gamma must be divisible by tick spacing')
      }
    }
    
    // Validate migration config
    if (params.migration.type === 'uniswapV4' && params.migration.streamableFees) {
      const beneficiaries = params.migration.streamableFees.beneficiaries
      if (beneficiaries.length === 0) {
        throw new Error('At least one beneficiary is required for V4 migration')
      }
      
      // Check that shares sum to 100% (WAD)
      const totalShares = beneficiaries.reduce((sum, b) => sum + b.shares, 0n)
      if (totalShares !== WAD) {
        throw new Error(`Beneficiary shares must sum to ${WAD} (100%), but got ${totalShares}`)
      }
    }
  }

  /**
   * Get the airlock contract address for the current chain
   */
  protected getAirlockAddress(): Address {
    const addresses = getAddresses(this.chainId)
    return addresses.airlock
  }

  /**
   * Get the appropriate initializer address based on auction type
   */
  protected getInitializerAddress(isStatic: boolean): Address {
    const addresses = getAddresses(this.chainId)
    return isStatic ? addresses.v3Initializer : addresses.v4Initializer
  }

  /**
   * Get the Bundler contract address for the current chain
   * Used to perform atomic create + swap ("bundle") flows for static auctions
   */
  protected getBundlerAddress(): Address {
    const addresses = getAddresses(this.chainId)
    const addr = addresses.bundler
    if (!addr || addr === zeroAddress) {
      throw new Error('Bundler address not configured for this chain')
    }
    return addr
  }

  /**
   * Get the appropriate migrator address based on migration config
   * Allows override via ModuleAddressOverrides when provided in params.
   */
  protected getMigratorAddress(config: MigrationConfig, overrides?: ModuleAddressOverrides): Address {
    const addresses = getAddresses(this.chainId)

    switch (config.type) {
      case 'uniswapV2':
        return overrides?.v2Migrator ?? addresses.v2Migrator
      case 'uniswapV3':
        return overrides?.v3Migrator ?? addresses.v3Migrator
      case 'uniswapV4':
        return overrides?.v4Migrator ?? addresses.v4Migrator
      case 'noOp': {
        const noOpAddress = overrides?.noOpMigrator ?? addresses.noOpMigrator
        if (!noOpAddress) {
          throw new Error('NoOpMigrator not configured on this chain. Provide override via modules.noOpMigrator or update chain config.')
        }
        return noOpAddress
      }

      default:
        throw new Error('Unknown migration type')
    }
  }

  // computeTicks moved to builders. No longer needed here.
  // computeOptimalGamma moved to utils.

  // -----------------------------
  // Bundler helpers (Static/V3)
  // -----------------------------

  /**
   * Simulate a bundle with exact input on Uniswap V3 as part of create
   * Returns the expected output amount for the provided exact input.
   */
  async simulateBundleExactInput(createParams: CreateParams, params: {
    tokenIn: Address
    tokenOut: Address
    amountIn: bigint
    fee: number
    sqrtPriceLimitX96: bigint
  }): Promise<bigint> {
    const bundler = this.getBundlerAddress()
    const { result } = await (this.publicClient as PublicClient).simulateContract({
      address: bundler,
      abi: bundlerAbi,
      functionName: 'simulateBundleExactIn',
      args: [
        { ...createParams },
        {
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut,
          amountIn: params.amountIn,
          fee: params.fee,
          sqrtPriceLimitX96: params.sqrtPriceLimitX96,
        },
      ],
    })
    return result as unknown as bigint
  }

  /**
   * Simulate a bundle with exact output on Uniswap V3 as part of create
   * Returns the required input amount for the provided exact output.
   */
  async simulateBundleExactOutput(createParams: CreateParams, params: {
    tokenIn: Address
    tokenOut: Address
    amount: bigint
    fee: number
    sqrtPriceLimitX96: bigint
  }): Promise<bigint> {
    const bundler = this.getBundlerAddress()
    const { result } = await (this.publicClient as PublicClient).simulateContract({
      address: bundler,
      abi: bundlerAbi,
      functionName: 'simulateBundleExactOut',
      args: [
        { ...createParams },
        {
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut,
          amount: params.amount,
          fee: params.fee,
          sqrtPriceLimitX96: params.sqrtPriceLimitX96,
        },
      ],
    })
    return result as unknown as bigint
  }

  // Bundler helpers (Multicurve/V4)
  async simulateMulticurveBundleExactOut(
    createParams: CreateParams,
    params?: {
      exactAmountOut?: bigint
    }
  ): Promise<MulticurveBundleExactOutResult> {
    const bundler = this.getBundlerAddress()
    await this.ensureMulticurveBundlerSupport(bundler)
    const exactAmountOut = params?.exactAmountOut ?? 0n
    this.ensureUint128(exactAmountOut, 'exactAmountOut', { allowZero: true })
    const hookData = '0x' as Hex

    const { result } = await (this.publicClient as PublicClient).simulateContract({
      address: bundler,
      abi: bundlerAbi,
      functionName: 'simulateMulticurveBundleExactOut',
      args: [
        { ...createParams },
        exactAmountOut,
        hookData,
      ],
    })

    const { asset, poolKey, amount, gasEstimate } = this.parseMulticurveBundleResult(result)

    return {
      asset,
      poolKey,
      amountIn: amount,
      gasEstimate,
    }
  }

  async simulateMulticurveBundleExactIn(
    createParams: CreateParams,
    params: {
      exactAmountIn: bigint
    }
  ): Promise<MulticurveBundleExactInResult> {
    const bundler = this.getBundlerAddress()
    await this.ensureMulticurveBundlerSupport(bundler)
    if (params.exactAmountIn === undefined) {
      throw new Error('exactAmountIn is required for multicurve bundle simulations')
    }
    const exactAmountIn = params.exactAmountIn
    this.ensureUint128(exactAmountIn, 'exactAmountIn')
    const hookData = '0x' as Hex

    const { result } = await (this.publicClient as PublicClient).simulateContract({
      address: bundler,
      abi: bundlerAbi,
      functionName: 'simulateMulticurveBundleExactIn',
      args: [
        { ...createParams },
        exactAmountIn,
        hookData,
      ],
    })

    const { asset, poolKey, amount, gasEstimate } = this.parseMulticurveBundleResult(result)

    return {
      asset,
      poolKey,
      amountOut: amount,
      gasEstimate,
    }
  }

  /**
   * Execute an atomic create + swap bundle through the Bundler
   * commands/inputs are Universal Router encoded values (e.g., from doppler-router)
   */
  async bundle(createParams: CreateParams, commands: Hex, inputs: Hex[], options?: { gas?: bigint; value?: bigint }): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations')
    }

    const bundler = this.getBundlerAddress()
    const { request } = await (this.publicClient as PublicClient).simulateContract({
      address: bundler,
      abi: bundlerAbi,
      functionName: 'bundle',
      args: [
        { ...createParams },
        commands,
        inputs,
      ],
      account: this.walletClient.account,
      value: options?.value ?? 0n,
    })
    const gas = options?.gas ?? undefined
    const tx = await this.walletClient.writeContract(gas ? { ...request, gas } : request)
    return tx
  }


  protected ensureUint128(value: bigint, paramName: string, options: { allowZero?: boolean } = {}): void {
    const { allowZero = false } = options
    if (value < 0n) {
      throw new Error(`${paramName} cannot be negative`)
    }
    if (!allowZero && value === 0n) {
      throw new Error(`${paramName} must be greater than zero`)
    }
    if (value > MAX_UINT128) {
      throw new Error(`${paramName} exceeds uint128 range`)
    }
  }

  protected parseMulticurveBundleResult(result: unknown): { asset: Address; poolKey: V4PoolKey; amount: bigint; gasEstimate: bigint } {
    let asset: Address | undefined
    let poolKeyRaw: unknown
    let amount: bigint | undefined
    let gasEstimate: bigint | undefined

    if (Array.isArray(result)) {
      if (result.length < 4) {
        throw new Error('Unexpected multicurve bundle simulation result shape')
      }
      asset = result[0] as Address
      poolKeyRaw = result[1]
      amount = result[2] as bigint
      gasEstimate = result[3] as bigint
    } else if (result && typeof result === 'object') {
      const obj = result as Record<string, unknown>
      asset = obj.asset as Address | undefined
      poolKeyRaw = obj.poolKey
      amount = (obj.amountIn ?? obj.amountOut ?? obj.amount) as bigint | undefined
      gasEstimate = obj.gasEstimate as bigint | undefined
    } else {
      throw new Error('Unexpected multicurve bundle simulation result format')
    }

    if (asset === undefined || poolKeyRaw === undefined || amount === undefined || gasEstimate === undefined) {
      throw new Error('Incomplete multicurve bundle simulation result')
    }

    return {
      asset,
      poolKey: this.normalizePoolKey(poolKeyRaw),
      amount,
      gasEstimate,
    }
  }

  protected normalizePoolKey(value: any): V4PoolKey {
    if (Array.isArray(value)) {
      const [currency0, currency1, feeRaw, tickSpacingRaw, hooks] = value as [Address, Address, number | bigint, number | bigint, Address]
      const feeValue = Number(feeRaw)
      const tickSpacingValue = Number(tickSpacingRaw)
      if (!Number.isFinite(feeValue) || !Number.isFinite(tickSpacingValue)) {
        throw new Error('Invalid pool key numeric fields in multicurve bundle simulation result')
      }
      return {
        currency0: currency0 as Address,
        currency1: currency1 as Address,
        fee: feeValue,
        tickSpacing: tickSpacingValue,
        hooks: hooks as Address,
      }
    }
    if (value && typeof value === 'object') {
      const { currency0, currency1, fee, tickSpacing, hooks } = value as Record<string, unknown>
      const feeValue = Number(fee)
      const tickSpacingValue = Number(tickSpacing)
      if (!Number.isFinite(feeValue) || !Number.isFinite(tickSpacingValue)) {
        throw new Error('Invalid pool key numeric fields in multicurve bundle simulation result')
      }
      return {
        currency0: currency0 as Address,
        currency1: currency1 as Address,
        fee: feeValue,
        tickSpacing: tickSpacingValue,
        hooks: hooks as Address,
      }
    }
    throw new Error('Unable to normalize PoolKey from multicurve bundle simulation result')
  }
  /**
   * Mines a salt and hook address with the appropriate flags
   * 
   * This method iterates through possible salt values to find a combination that:
   * - Produces a hook address with required Doppler flags
   * - Maintains proper token ordering relative to numeraire
   * - Ensures deterministic deployment addresses
   * 
   * @param params - Parameters for hook address mining
   * @returns Tuple of [salt, hook address, token address, pool data, token data]
   * @throws {Error} If no valid salt can be found within the search limit
   * @protected
   */
  protected mineHookAddress(params: {
    airlock: Address
    poolManager: Address
    deployer: Address
    initialSupply: bigint
    numTokensToSell: bigint
    numeraire: Address
    tokenFactory: Address
    tokenFactoryData:
      | {
          name: string
          symbol: string
          baseURI: string
          unit?: bigint
        }
      | {
          name: string
          symbol: string
          initialSupply: bigint
          airlock: Address
          yearlyMintRate: bigint
          vestingDuration: bigint
          recipients: Address[]
          amounts: bigint[]
          tokenURI: string
        }
    poolInitializer: Address
    poolInitializerData: {
      minimumProceeds: bigint
      maximumProceeds: bigint
      startingTime: bigint
      endingTime: bigint
      startingTick: number
      endingTick: number
      epochLength: bigint
      gamma: number
      numPDSlugs: bigint
      fee: number
      tickSpacing: number
    }
    customDerc20Bytecode?: `0x${string}`
    tokenVariant?: 'standard' | 'doppler404'
  }): [Hash, Address, Address, Hex, Hex] {
    const addresses = getAddresses(this.chainId)

    const isToken0 = isToken0Expected(params.numeraire)

    const {
      minimumProceeds,
      maximumProceeds,
      startingTime,
      endingTime,
      startingTick,
      endingTick,
      epochLength,
      gamma,
      numPDSlugs,
      fee,
      tickSpacing,
    } = params.poolInitializerData

    const poolInitializerData = encodeAbiParameters(
      [
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'int24' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'bool' },
        { type: 'uint256' },
        { type: 'uint24' },
        { type: 'int24' },
      ],
      [
        minimumProceeds,
        maximumProceeds,
        startingTime,
        endingTime,
        startingTick,
        endingTick,
        epochLength,
        gamma,
        isToken0,
        numPDSlugs,
        fee,
        tickSpacing,
      ]
    )

    const isBase = this.chainId === CHAIN_IDS.BASE

    const { poolManager, numTokensToSell, poolInitializer } = params

    const hookInitHashData = encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'int24' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'bool' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'uint24' },
      ],
      [
        poolManager,
        numTokensToSell,
        minimumProceeds,
        maximumProceeds,
        startingTime,
        endingTime,
        startingTick,
        endingTick,
        epochLength,
        gamma,
        isToken0,
        numPDSlugs,
        poolInitializer,
        fee,
      ]
    )

    const hookInitHash = keccak256(
      encodePacked(
        ['bytes', 'bytes'],
        [isBase ? (DopplerBytecodeBaseMainnet as Hex) : (DopplerBytecode as Hex), hookInitHashData]
      )
    )

    const tokenFactoryData = (params.tokenVariant === 'doppler404')
      ? (() => {
          const t = params.tokenFactoryData as {
            name: string
            symbol: string
            baseURI: string
            unit?: bigint
          }
          return encodeAbiParameters(
          [
            { type: 'string' },
            { type: 'string' },
            { type: 'string' },
            { type: 'uint256' },
          ],
          [t.name, t.symbol, t.baseURI, t.unit ?? 1000n]
        )
        })()
      : (() => {
          const {
            name,
            symbol,
            yearlyMintRate,
            vestingDuration,
            recipients,
            amounts,
            tokenURI,
          } = params.tokenFactoryData as {
            name: string
            symbol: string
            initialSupply: bigint
            airlock: Address
            yearlyMintRate: bigint
            vestingDuration: bigint
            recipients: Address[]
            amounts: bigint[]
            tokenURI: string
          }
          return encodeAbiParameters(
            [
              { type: 'string' },
              { type: 'string' },
              { type: 'uint256' },
              { type: 'uint256' },
              { type: 'address[]' },
              { type: 'uint256[]' },
              { type: 'string' },
            ],
            [
              name,
              symbol,
              yearlyMintRate,
              vestingDuration,
              recipients,
              amounts,
              tokenURI,
            ]
          )
        })()

    const { airlock, initialSupply } = params

    // Compute token init hash; use DN404 bytecode if tokenVariant is doppler404
    let tokenInitHash: Hash | undefined
    if (params.tokenVariant === 'doppler404') {
      const { name, symbol, baseURI } = params.tokenFactoryData as {
        name: string
        symbol: string
        baseURI: string
        unit?: bigint
      }
      const { airlock, initialSupply } = params
      // DN404 constructor: (name, symbol, initialSupply, recipient, owner, baseURI)
      const initHashData = encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'string' },
          { type: 'uint256' },
          { type: 'address' },
          { type: 'address' },
          { type: 'string' },
        ],
        [
          name,
          symbol,
          initialSupply,
          airlock,
          airlock,
          baseURI,
        ]
      )
      tokenInitHash = keccak256(
        encodePacked(['bytes', 'bytes'], [DopplerDN404Bytecode as Hex, initHashData])
      )
    } else {
      const { name, symbol, yearlyMintRate, vestingDuration, recipients, amounts, tokenURI } =
        params.tokenFactoryData as {
          name: string
          symbol: string
          initialSupply: bigint
          airlock: Address
          yearlyMintRate: bigint
          vestingDuration: bigint
          recipients: Address[]
          amounts: bigint[]
          tokenURI: string
        }
      const { airlock, initialSupply } = params
      const initHashData = encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'string' },
          { type: 'uint256' },
          { type: 'address' },
          { type: 'address' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'address[]' },
          { type: 'uint256[]' },
          { type: 'string' },
        ],
        [
          name,
          symbol,
          initialSupply,
          airlock,
          airlock,
          yearlyMintRate,
          vestingDuration,
          recipients,
          amounts,
          tokenURI,
        ]
      )
      tokenInitHash = keccak256(
        encodePacked(['bytes', 'bytes'], [params.customDerc20Bytecode as Hex ?? DERC20Bytecode as Hex, initHashData])
      )
    }

    // Use the exact flags from V4 SDK
    const flags = BigInt(
      (1 << 13) | // BEFORE_INITIALIZE_FLAG
      (1 << 12) | // AFTER_INITIALIZE_FLAG
      (1 << 11) | // BEFORE_ADD_LIQUIDITY_FLAG
      (1 << 7) |  // BEFORE_SWAP_FLAG
      (1 << 6) |  // AFTER_SWAP_FLAG
      (1 << 5)    // BEFORE_DONATE_FLAG
    )

    for (let salt = BigInt(0); salt < BigInt(1_000_000); salt++) {
      const saltBytes = `0x${salt.toString(16).padStart(64, '0')}` as Hash
      const hook = this.computeCreate2Address(
        saltBytes,
        hookInitHash,
        params.deployer
      )
      const hookBigInt = BigInt(hook)
      if (tokenInitHash) {
        const token = this.computeCreate2Address(
          saltBytes,
          tokenInitHash,
          params.tokenFactory
        )
        const tokenBigInt = BigInt(token)
        const numeraireBigInt = BigInt(params.numeraire)
        if (
          (hookBigInt & FLAG_MASK) === flags &&
          ((isToken0 && tokenBigInt < numeraireBigInt) ||
            (!isToken0 && tokenBigInt > numeraireBigInt))
        ) {
          return [saltBytes, hook, token, poolInitializerData, tokenFactoryData]
        }
      }
    }

    throw new Error('AirlockMiner: could not find salt')
  }

  /**
   * Computes the CREATE2 address for a contract deployment
   * @param salt - The salt used for deployment
   * @param initCodeHash - Hash of the initialization code
   * @param deployer - Address of the deploying contract
   * @returns The computed contract address
   * @protected
   */
  protected computeCreate2Address(
    salt: Hash,
    initCodeHash: Hash,
    deployer: Address
  ): Address {
    const encoded = encodePacked(
      ['bytes1', 'address', 'bytes32', 'bytes32'],
      ['0xff', deployer, salt, initCodeHash]
    )
    return getAddress(`0x${keccak256(encoded).slice(-40)}`)
  }

  /**
   * Compute V4 pool ID from pool key components
   */
  protected computePoolId(poolKey: {
    currency0: Address
    currency1: Address  
    fee: number
    tickSpacing: number
    hooks: Address
  }): string {
    // V4 pools are identified by the hash of their PoolKey
    const encoded = encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'address' },
        { type: 'uint24' },
        { type: 'int24' },
        { type: 'address' }
      ],
      [
        poolKey.currency0,
        poolKey.currency1,
        poolKey.fee,
        poolKey.tickSpacing,
        poolKey.hooks
      ]
    )
    return keccak256(encoded)
  }

  protected async ensureMulticurveBundlerSupport(bundler: Address): Promise<void> {
    if (this.multicurveBundlerSupport.get(bundler)) {
      return
    }

    const client = this.publicClient as PublicClient
    if (!client || typeof client.getBytecode !== 'function') {
      // If we cannot check support, optimistically assume true.
      this.multicurveBundlerSupport.set(bundler, true)
      return
    }

    const bytecode = await client.getBytecode({ address: bundler })
    const supports = Boolean(bytecode && MULTICURVE_BUNDLER_SELECTORS.every(selector => bytecode.includes(selector.slice(2))))

    if (!supports) {
      throw new Error(
        `Bundler at ${bundler} does not support multicurve bundling. Ensure the Doppler Bundler has been upgraded and update chain addresses.`
      )
    }

    this.multicurveBundlerSupport.set(bundler, true)
  }
}

const MULTICURVE_BUNDLER_SELECTORS = ['0xe2e9faa1', '0x07087b06'] as const
