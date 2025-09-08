import { 
  type Address, 
  type Hex, 
  type Hash,
  type PublicClient, 
  type WalletClient,
  encodeAbiParameters, 
  encodePacked,
  keccak256,
  getAddress,
  decodeEventLog
} from 'viem'
import type { 
  CreateStaticAuctionParams, 
  CreateDynamicAuctionParams,
  MigrationConfig,
  SupportedPublicClient,
  TokenConfig,
  Doppler404TokenConfig,
  StandardTokenConfig,
  SupportedChainId,
  DynamicAuctionConfig,
  CreateParams
} from '../types'
import type { ModuleAddressOverrides } from '../types'
import { getAddresses } from '../addresses'
import { zeroAddress } from 'viem'
import { 
  ZERO_ADDRESS,
  BASIS_POINTS,
  DEFAULT_PD_SLUGS,
  DAY_SECONDS,
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
  DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD
} from '../constants'
import { airlockAbi, bundlerAbi, DERC20Bytecode, DopplerBytecode, DopplerDN404Bytecode } from '../abis'

export class DopplerFactory<C extends SupportedChainId = SupportedChainId> {
  private publicClient: SupportedPublicClient
  private walletClient?: WalletClient
  private chainId: C
  
  constructor(publicClient: SupportedPublicClient, walletClient: WalletClient | undefined, chainId: C) {
    this.publicClient = publicClient
    this.walletClient = walletClient
    this.chainId = chainId
  }

  encodeCreateStaticAuctionParams(params: CreateStaticAuctionParams<C>): CreateParams {
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
      const yearlyMintRate = tokenStd.yearlyMintRate ?? DEFAULT_V3_YEARLY_MINT_RATE
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
          params.vesting ? [params.userAddress] : [],
          params.vesting ? [params.sale.initialSupply - params.sale.numTokensToSell] : [],
          tokenStd.tokenURI,
        ]
      )
    }

    // 4. Encode governance factory data
    const governanceFactoryData = encodeAbiParameters(
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
    const useNoOpGovernance = params.governance.type === 'noOp'

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
    const salt = this.generateRandomSalt(params.userAddress)

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

    // Build the complete CreateParams for the V3-style ABI
    const createParams = {
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
      salt: salt,
    }

    return createParams;
  }

  /**
   * Simulate a static auction creation and return predicted addresses.
   * Useful for pre-buy flows (bundle) to know the token/pool before sending.
   */
  async simulateCreateStaticAuction(params: CreateStaticAuctionParams<C>): Promise<{
    createParams: CreateParams
    asset: Address
    pool: Address
  }> {
    const createParams = this.encodeCreateStaticAuctionParams(params)
    const addresses = getAddresses(this.chainId)

    const { result } = await this.publicClient.simulateContract({
      address: params.modules?.airlock ?? addresses.airlock,
      abi: airlockAbi,
      functionName: 'create',
      args: [{ ...createParams }],
      account: this.walletClient?.account,
    })

    if (!result || !Array.isArray(result) || result.length < 2) {
      throw new Error('Failed to simulate static auction create')
    }

    return {
      createParams,
      asset: result[0] as Address,
      pool: result[1] as Address,
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
    const createParams = this.encodeCreateStaticAuctionParams(params);

    const addresses = getAddresses(this.chainId)

    // Call the airlock contract to create the pool
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations')
    }
    
    const { request, result } = await this.publicClient.simulateContract({
      address: params.modules?.airlock ?? addresses.airlock,
      abi: airlockAbi,
      functionName: 'create',
      args: [{...createParams}],
      account: this.walletClient.account,
    })
    
    const gasOverride = params.gas ?? 13_500_000n
    const hash = await this.walletClient.writeContract({ ...request, gas: gasOverride })
    
    // Wait for transaction and get the receipt
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash, confirmations: 2 })
    
    // The create function returns [asset, pool, governance, timelock, migrationPool]
    // We can get these from the simulation result or parse from logs
    if (result && Array.isArray(result) && result.length >= 2) {
      return {
        poolAddress: result[1] as Address, // pool is the second element
        tokenAddress: result[0] as Address, // asset (token) is the first element
        transactionHash: hash
      }
    }
    
    // Fallback: Parse the Create event from logs
    const createEvent = receipt.logs.find(log => {
      try {
        const decoded = decodeEventLog({
          abi: airlockAbi,
          data: log.data,
          topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        })
        return decoded.eventName === 'Create'
      } catch {
        return false
      }
    })
    
    if (createEvent) {
      const decoded = decodeEventLog({
        abi: airlockAbi,
        data: createEvent.data,
        topics: createEvent.topics as [`0x${string}`, ...`0x${string}`[]],
      })
      
      if (decoded.eventName === 'Create') {
        return {
          poolAddress: (decoded.args as any).poolOrHook as Address,
          tokenAddress: (decoded.args as any).asset as Address,
          transactionHash: hash
        }
      }
    }
    
    throw new Error('Failed to get pool and token addresses from transaction')
  }
  
  /**
   * Generate a random salt based on user address
   */
  private generateRandomSalt(account: Address): Hex {
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

  async encodeCreateDynamicAuctionParams(params: CreateDynamicAuctionParams<C>): Promise<{
    createParams: CreateParams,
    hookAddress: Address,
    tokenAddress: Address
  }> {
     // Validate parameters
    this.validateDynamicAuctionParams(params)

    const addresses = getAddresses(this.chainId)

    // 1. Calculate gamma if not provided
    const gamma = params.auction.gamma ?? this.computeOptimalGamma(
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
      const latestBlock = await this.publicClient.getBlock({ blockTag: 'latest' })
      blockTimestamp = Number(latestBlock.timestamp)
    }

    // Use startTimeOffset if provided, otherwise default to 30 seconds
    const startTimeOffset = params.startTimeOffset ?? 30
    const startTime = blockTimestamp + startTimeOffset
    const endTime = blockTimestamp + params.auction.duration * DAY_SECONDS + startTimeOffset

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
          return {
            name: t.name,
            symbol: t.symbol,
            initialSupply: params.sale.initialSupply,
            airlock: addresses.airlock,
            yearlyMintRate: t.yearlyMintRate ?? DEFAULT_V4_YEARLY_MINT_RATE,
            vestingDuration: BigInt(vestingDuration),
            recipients: params.vesting ? [params.userAddress] : [],
            amounts: params.vesting ? [params.sale.initialSupply - params.sale.numTokensToSell] : [],
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

    // 7. Encode governance factory data
    const governanceFactoryData = encodeAbiParameters(
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
    const useNoOpGovernance = params.governance.type === 'noOp'

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

    const { createParams, hookAddress, tokenAddress } = await this.encodeCreateDynamicAuctionParams(params);

    const addresses = getAddresses(this.chainId)

    // Call the airlock contract to create the pool
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations')
    }
    
    const { request, result } = await this.publicClient.simulateContract({
      address: params.modules?.airlock ?? addresses.airlock,
      abi: airlockAbi,
      functionName: 'create',
      args: [{...createParams}],
      account: this.walletClient.account,
    })
    
    const gasOverride = params.gas ?? 13_500_000n
    const hash = await this.walletClient.writeContract({ ...request, gas: gasOverride })
    
    // Wait for transaction and get the receipt
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash })
    
    // Get actual addresses from the return value or event logs
    let actualHookAddress: Address = hookAddress
    let actualTokenAddress: Address = tokenAddress
    
    if (result && Array.isArray(result) && result.length >= 2) {
      // The create function returns [asset, pool, governance, timelock, migrationPool]
      actualTokenAddress = result[0] as Address
      actualHookAddress = result[1] as Address // For V4, pool is the hook address
    } else {
      // Fallback: Parse the Create event from logs
      const createEvent = receipt.logs.find(log => {
        try {
          const decoded = decodeEventLog({
            abi: airlockAbi,
            data: log.data,
            topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
          })
          return decoded.eventName === 'Create'
        } catch {
          return false
        }
      })
      
      if (createEvent) {
        const decoded = decodeEventLog({
          abi: airlockAbi,
          data: createEvent.data,
          topics: createEvent.topics as [`0x${string}`, ...`0x${string}`[]],
        })
        
        if (decoded.eventName === 'Create') {
          actualHookAddress = (decoded.args as any).poolOrHook as Address
          actualTokenAddress = (decoded.args as any).asset as Address
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

  private isDoppler404Token(token: TokenConfig): token is Doppler404TokenConfig {
    return (token as Doppler404TokenConfig).type === 'doppler404'
  }

  /**
   * Encode migration data based on the MigrationConfig
   * This replaces the manual encoding methods from the old SDKs
   */
  private encodeMigrationData(config: MigrationConfig): Hex {
    switch (config.type) {
      case 'uniswapV2':
        // V2 migrator expects empty data
        return '0x' as Hex
        
      case 'uniswapV3':
        // Encode V3 migration data: fee and tick spacing
        return encodeAbiParameters(
          [
            { type: 'uint24' }, // fee
            { type: 'int24' }   // tickSpacing
          ],
          [config.fee, config.tickSpacing]
        )
        
      case 'uniswapV4':
        // Encode V4 migration data with streamable fees config
        // The V4 migrator expects beneficiaries with shares in WAD (1e18) format
        const WAD = BigInt(1e18)
        const beneficiaryData: { beneficiary: Address; shares: bigint }[] = []
        
        // Convert percentage-based beneficiaries to shares-based
        for (const b of config.streamableFees.beneficiaries) {
          beneficiaryData.push({
            beneficiary: b.address,
            shares: (BigInt(b.percentage) * WAD) / BigInt(BASIS_POINTS)
          })
        }
        
        // Sort beneficiaries by address in ascending order (required by contract)
        beneficiaryData.sort((a, b) => {
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
            { type: 'uint32' },  // lockDuration
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
            config.streamableFees.lockDuration,
            beneficiaryData.map(b => ({
              beneficiary: b.beneficiary,
              shares: b.shares
            }))
          ]
        )
        
      default:
        throw new Error(`Unknown migration type: ${(config as any).type}`)
    }
  }

  /**
   * Validate static auction parameters
   */
  private validateStaticAuctionParams(params: CreateStaticAuctionParams): void {
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
      const vestedAmount = params.sale.initialSupply - params.sale.numTokensToSell
      if (vestedAmount <= BigInt(0)) {
        throw new Error('No tokens available for vesting')
      }
    }
    
    // Validate migration config
    if (params.migration.type === 'uniswapV4' && params.migration.streamableFees) {
      const beneficiaries = params.migration.streamableFees.beneficiaries
      if (beneficiaries.length === 0) {
        throw new Error('At least one beneficiary is required for V4 migration')
      }
      
      // Check that percentages sum to 100%
      const totalPercentage = beneficiaries.reduce((sum, b) => sum + b.percentage, 0)
      if (totalPercentage !== BASIS_POINTS) {
        throw new Error(`Beneficiary percentages must sum to ${BASIS_POINTS} (100%), but got ${totalPercentage}`)
      }
    }
  }

  /**
   * Validate dynamic auction parameters
   */
  private validateDynamicAuctionParams(params: CreateDynamicAuctionParams): void {
    // Validate token parameters
    if (!params.token.name || params.token.name.trim().length === 0) {
      throw new Error('Token name is required')
    }
    if (!params.token.symbol || params.token.symbol.trim().length === 0) {
      throw new Error('Token symbol is required')
    }
    
    // Validate tick range
    if (params.auction.startTick >= params.auction.endTick) {
      throw new Error('Start tick must be less than end tick')
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
    const totalDuration = params.auction.duration * DAY_SECONDS
    if (totalDuration % params.auction.epochLength !== 0) {
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
      
      // Check that percentages sum to 100%
      const totalPercentage = beneficiaries.reduce((sum, b) => sum + b.percentage, 0)
      if (totalPercentage !== BASIS_POINTS) {
        throw new Error(`Beneficiary percentages must sum to ${BASIS_POINTS} (100%), but got ${totalPercentage}`)
      }
    }
  }

  /**
   * Get the airlock contract address for the current chain
   */
  private getAirlockAddress(): Address {
    const addresses = getAddresses(this.chainId)
    return addresses.airlock
  }

  /**
   * Get the appropriate initializer address based on auction type
   */
  private getInitializerAddress(isStatic: boolean): Address {
    const addresses = getAddresses(this.chainId)
    return isStatic ? addresses.v3Initializer : addresses.v4Initializer
  }

  /**
   * Get the Bundler contract address for the current chain
   * Used to perform atomic create + swap ("bundle") flows for static auctions
   */
  private getBundlerAddress(): Address {
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
  private getMigratorAddress(config: MigrationConfig, overrides?: ModuleAddressOverrides): Address {
    const addresses = getAddresses(this.chainId)
    
    switch (config.type) {
      case 'uniswapV2':
        return overrides?.v2Migrator ?? addresses.v2Migrator
      case 'uniswapV3':
        return overrides?.v3Migrator ?? addresses.v3Migrator
      case 'uniswapV4':
        return overrides?.v4Migrator ?? addresses.v4Migrator
      default:
        throw new Error(`Unknown migration type: ${(config as any).type}`)
    }
  }

  // computeTicks moved to builders. No longer needed here.

  /**
   * Compute optimal gamma parameter based on price range and time parameters
   * Gamma determines how much the price can move per epoch during the sale.
   */
  private computeOptimalGamma(
    startTick: number,
    endTick: number,
    durationDays: number,
    epochLength: number,
    tickSpacing: number
  ): number {
    // Calculate total number of epochs
    const totalEpochs = (durationDays * DAY_SECONDS) / epochLength

    // Calculate required tick movement per epoch to cover the range
    const tickDelta = Math.abs(endTick - startTick)
    // Round up to nearest multiple of tick spacing
    let gamma = Math.ceil(tickDelta / totalEpochs) * tickSpacing
    // Ensure gamma is at least 1 tick spacing
    gamma = Math.max(tickSpacing, gamma)

    if (gamma % tickSpacing !== 0) {
      throw new Error('Computed gamma must be divisible by tick spacing')
    }

    return gamma
  }

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
    const { result } = await this.publicClient.simulateContract({
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
    const { result } = await this.publicClient.simulateContract({
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

  /**
   * Execute an atomic create + swap bundle through the Bundler
   * commands/inputs are Universal Router encoded values (e.g., from doppler-router)
   */
  async bundle(createParams: CreateParams, commands: Hex, inputs: Hex[], options?: { gas?: bigint; value?: bigint }): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations')
    }

    const bundler = this.getBundlerAddress()
    const { request } = await this.publicClient.simulateContract({
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
   * @private
   */
  private mineHookAddress(params: {
    airlock: Address
    poolManager: Address
    deployer: Address
    initialSupply: bigint
    numTokensToSell: bigint
    numeraire: Address
    tokenFactory: Address
    tokenFactoryData: any
    poolInitializer: Address
    poolInitializerData: any
    customDerc20Bytecode?: `0x${string}`
    tokenVariant?: 'standard' | 'doppler404'
  }): [Hash, Address, Address, Hex, Hex] {
    const isToken0 = params.numeraire !== zeroAddress

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
        [DopplerBytecode as Hex, hookInitHashData]
      )
    )

    const tokenFactoryData = (params.tokenVariant === 'doppler404')
      ? encodeAbiParameters(
          [
            { type: 'string' },
            { type: 'string' },
            { type: 'string' },
            { type: 'uint256' },
          ],
          [
            params.tokenFactoryData.name,
            params.tokenFactoryData.symbol,
            params.tokenFactoryData.baseURI,
            params.tokenFactoryData.unit ?? 1000n,
          ]
        )
      : (() => {
          const {
            name,
            symbol,
            yearlyMintRate,
            vestingDuration,
            recipients,
            amounts,
            tokenURI,
          } = params.tokenFactoryData
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
      const { name, symbol, baseURI } = params.tokenFactoryData
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
      const { name, symbol, yearlyMintRate, vestingDuration, recipients, amounts, tokenURI } = params.tokenFactoryData
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
   * @private
   */
  private computeCreate2Address(
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
  private computePoolId(poolKey: {
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
}
