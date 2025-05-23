const chalk = require('chalk')

class Deployer {
  constructor(
    logger,
    spinner,
    commandRunner,
    errorParser,
    backupManager,
    retryManager
  ) {
    this.logger = logger
    this.spinner = spinner
    this.commandRunner = commandRunner
    this.errorParser = errorParser
    this.backupManager = backupManager
    this.retryManager = retryManager
  }

  // Check if required dependencies are installed
  async checkDependencies(options = {}) {
    const { verbose = false } = options

    const spinner = this.spinner.start('Checking dependencies...', { verbose })

    try {
      await this.commandRunner.run('shopify', ['version'], { stdio: 'pipe' })
      this.spinner.stop('success', 'All dependencies are installed')
    } catch (error) {
      this.spinner.stop('error', 'Dependency check failed')
      this.logger.error('Shopify CLI is not installed or not accessible.')
      this.logger.error('Please install it first: npm install -g @shopify/cli')
      this.logger.error(`Error details: ${error.message}`)
      await this.logger.log(`DEPENDENCY_ERROR: ${error.message}`)
      process.exit(1)
    }
  }

  // Deploy to a single store with enhanced error handling
  async deployToStore(store, options = {}) {
    const { url, theme_id } = store
    const { continueOnError = false, verbose = false, dryRun = false } = options

    if (dryRun) {
      this.logger.info(
        `[DRY RUN] Would deploy to: ${url} (Theme ID: ${theme_id})`
      )
      await this.logger.log(`DRY_RUN - ${url} - Theme ID: ${theme_id}`)
      return true
    }

    const spinner = this.spinner.start(`Deploying to: ${url}`, { verbose })

    try {
      const args = [
        'theme',
        'push',
        '--store',
        url,
        '--theme',
        theme_id,
        '--force',
        '--json',
      ]

      if (verbose) {
        this.spinner.stop()
        this.logger.info(`Running command: shopify ${args.join(' ')}`)
        this.spinner.start(`Deploying to: ${url}`, { verbose })
      }

      const result = await this.commandRunner.run('shopify', args)

      this.spinner.stop('success', `Successfully deployed to ${url}`)
      await this.logger.log(`SUCCESS - ${url} - Theme ID: ${theme_id}`)

      if (verbose && result.stdout) {
        console.log(chalk.gray('Command output:'), result.stdout)
      }

      return true
    } catch (error) {
      const parsedError = this.errorParser.parse(error)

      this.spinner.stop('error', `Failed to deploy to ${url}`)
      this.logger.error(`Error type: ${parsedError.type}`)
      this.logger.error(`Message: ${parsedError.message}`)
      this.logger.warning(`Suggestion: ${parsedError.suggestion}`)

      // Log detailed error information
      await this.logger.log(`FAILED - ${url} - Theme ID: ${theme_id}`)
      await this.logger.log(`Error type: ${parsedError.type}`)
      await this.logger.log(`Error message: ${parsedError.message}`)
      await this.logger.log(`Command: ${error.command}`)
      await this.logger.log(`Exit code: ${error.exitCode}`)

      if (error.stderr) {
        await this.logger.log(`STDERR: ${error.stderr}`)
      }

      if (error.stdout) {
        await this.logger.log(`STDOUT: ${error.stdout}`)
      }

      await this.logger.log('---')

      // Show detailed error output if verbose mode is enabled
      if (verbose) {
        console.log(chalk.gray('\nDetailed error information:'))
        console.log(chalk.gray('Command:'), error.command)
        console.log(chalk.gray('Exit code:'), error.exitCode)

        if (error.stderr) {
          console.log(chalk.gray('STDERR:'), error.stderr)
        }

        if (error.stdout) {
          console.log(chalk.gray('STDOUT:'), error.stdout)
        }
      }

      // If not continuing on error and this is a single store deployment, exit
      if (!continueOnError && options.singleStore) {
        this.logger.error('Deployment failed. Use --verbose for more details.')
        process.exit(1)
      }

      return false
    }
  }

  // Deploy to a specific store
  async deployToSpecificStore(storesData, targetStoreUrl, options = {}) {
    const store = storesData.stores.find(s => s.url === targetStoreUrl)

    if (!store) {
      this.logger.error(`Store '${targetStoreUrl}' not found in configuration`)
      process.exit(1)
    }

    const {
      retry = 3,
      retryDelay = 1000,
      backup = false,
      backupDir = './backups',
      verbose = false,
      dryRun = false,
    } = options

    if (backup) {
      this.logger.info(
        `📦 Backup enabled - theme will be backed up to: ${backupDir}`
      )
    }

    if (retry > 0) {
      this.logger.info(
        `🔄 Auto-retry enabled - up to ${retry} retries with exponential backoff`
      )
    }

    const result = await this.retryWithBackoffForStore(store, {
      retryCount: retry,
      retryDelay,
      verbose,
      dryRun,
      backup,
      backupDir,
      continueOnError: false, // For single store, we want to exit on failure
    })

    if (!result.success) {
      this.logger.error('Deployment failed. Use --verbose for more details.')
      process.exit(1)
    }

    // Print summary for single store
    console.log('')
    this.logger.info('Deployment Summary:')
    this.logger.success(`Successfully deployed to: ${store.url}`)

    if (result.attempts > 1) {
      this.logger.info(`🔄 Succeeded after ${result.attempts - 1} retry(ies)`)
    }

    if (result.backupPath) {
      this.logger.info(`📦 Theme backed up to: ${result.backupPath}`)
    }
  }

  // Retry with backoff for a single store (includes backup)
  async retryWithBackoffForStore(store, options = {}) {
    const {
      backup = false,
      backupDir = './backups',
      dryRun = false,
      verbose = false,
    } = options

    let backupPath = null

    // Perform backup if requested
    if (backup && !dryRun) {
      backupPath = await this.backupManager.backupTheme(store, backupDir, {
        verbose,
        dryRun,
      })
      if (backupPath) {
        this.logger.info(`Backup completed for ${store.url}`)
      } else {
        this.logger.warning(
          `Backup failed for ${store.url}, continuing with deployment`
        )
      }
    }

    // Use retry manager for deployment
    const result = await this.retryManager.retryWithBackoff(
      this.deployToStore.bind(this),
      store,
      options
    )

    return {
      ...result,
      backupPath,
    }
  }

  // Deploy to all stores with enhanced error handling
  async deployToAllStores(storesData, options = {}) {
    const {
      continueOnError = false,
      verbose = false,
      dryRun = false,
      parallel = false,
      maxConcurrent = 3,
      retry = 3,
      retryDelay = 1000,
      backup = false,
      backupDir = './backups',
    } = options

    if (dryRun) {
      this.logger.info('🔍 DRY RUN MODE - Preview of deployment plan:')
      console.log('')
    } else {
      const mode = parallel
        ? `parallel (max ${maxConcurrent} concurrent)`
        : 'sequential'
      this.logger.info(`Starting ${mode} deployment to all stores...`)

      if (backup) {
        this.logger.info(
          `📦 Backup enabled - themes will be backed up to: ${backupDir}`
        )
      }

      if (retry > 0) {
        this.logger.info(
          `🔄 Auto-retry enabled - up to ${retry} retries with exponential backoff`
        )
      }
    }

    await this.logger.log(
      dryRun
        ? 'Starting dry run for all stores'
        : `Starting ${
            parallel ? 'parallel' : 'sequential'
          } deployment to all stores`
    )

    let successCount = 0
    let failureCount = 0
    let backupCount = 0
    let retryCount = 0
    const totalStores = storesData.stores.length
    const failedStores = []
    const deploymentResults = []

    // Filter out stores with missing required fields
    const validStores = storesData.stores.filter(store => {
      if (!store.url || !store.theme_id) {
        this.logger.warning(
          `Skipping store with missing required fields: ${
            store.url || 'Unknown'
          }`
        )
        failureCount++
        failedStores.push({
          store: store.url || 'Unknown',
          reason: 'Missing required fields',
        })
        return false
      }
      return true
    })

    if (parallel && validStores.length > 0) {
      // Parallel deployment
      this.logger.info(
        `🚀 Deploying to ${validStores.length} stores in parallel...`
      )

      const deploymentTasks = validStores.map(
        store => () =>
          this.retryWithBackoffForStore(store, {
            retryCount: retry,
            retryDelay,
            verbose,
            dryRun,
            backup,
            backupDir,
            continueOnError: true,
          })
      )

      const results = await this.retryManager.limitConcurrency(
        deploymentTasks,
        maxConcurrent
      )

      // Process results
      results.forEach((result, index) => {
        const store = validStores[index]

        if (result.status === 'fulfilled') {
          const { success, attempts, backupPath, error } = result.value

          deploymentResults.push({
            store: store.url,
            success,
            attempts,
            backupPath,
            error,
          })

          if (success) {
            successCount++
            if (attempts > 1) {
              retryCount += attempts - 1
            }
          } else {
            failureCount++
            failedStores.push({
              store: store.url,
              reason: error ? error.message : 'Deployment failed',
            })
          }

          if (backupPath) {
            backupCount++
          }
        } else {
          // Promise was rejected
          failureCount++
          failedStores.push({
            store: store.url,
            reason: 'Unexpected deployment error',
          })
        }
      })
    } else {
      // Sequential deployment (original behavior)
      for (const store of validStores) {
        const result = await this.retryWithBackoffForStore(store, {
          retryCount: retry,
          retryDelay,
          verbose,
          dryRun,
          backup,
          backupDir,
          continueOnError: true,
        })

        deploymentResults.push({
          store: store.url,
          success: result.success,
          attempts: result.attempts,
          backupPath: result.backupPath,
          error: result.error,
        })

        if (result.success) {
          successCount++
          if (result.attempts > 1) {
            retryCount += result.attempts - 1
          }
        } else {
          failureCount++
          failedStores.push({
            store: store.url,
            reason: result.error ? result.error.message : 'Deployment failed',
          })
        }

        if (result.backupPath) {
          backupCount++
        }

        // Add delay between deployments to avoid rate limiting (skip in dry run and parallel mode)
        if (
          !dryRun &&
          !parallel &&
          store !== validStores[validStores.length - 1]
        ) {
          await this.retryManager.sleep(2000)
        }
      }
    }

    // Print summary
    console.log('')
    this.logger.info(dryRun ? 'Dry Run Summary:' : 'Deployment Summary:')
    this.logger.success(
      `${
        dryRun ? 'Would deploy to' : 'Successful deployments'
      }: ${successCount}`
    )

    if (failureCount > 0) {
      this.logger.error(
        `${dryRun ? 'Would skip' : 'Failed deployments'}: ${failureCount}`
      )

      // List failed stores
      console.log('')
      this.logger.error(
        dryRun ? 'Stores that would be skipped:' : 'Failed stores:'
      )
      failedStores.forEach(({ store, reason }) => {
        console.log(`  • ${store} - ${reason}`)
      })
    } else {
      this.logger.success(
        `${dryRun ? 'Would skip' : 'Failed deployments'}: ${failureCount}`
      )
    }

    // Additional summary information
    if (backupCount > 0) {
      this.logger.info(`📦 Themes backed up: ${backupCount}`)
    }

    if (retryCount > 0) {
      this.logger.info(`🔄 Total retry attempts: ${retryCount}`)
    }

    this.logger.info(`Total stores: ${totalStores}`)

    if (dryRun) {
      console.log('')
      this.logger.info(
        '💡 This was a dry run. No actual deployments were made.'
      )
      this.logger.info('Remove --dry-run flag to perform actual deployment.')
    }

    await this.logger.log(
      `${
        dryRun ? 'Dry run' : 'Deployment'
      } completed - Success: ${successCount}, Failed: ${failureCount}, Backups: ${backupCount}, Retries: ${retryCount}`
    )

    // Exit with error code if any deployments failed and not continuing on error (skip in dry run)
    if (!dryRun && failureCount > 0 && !continueOnError) {
      this.logger.error(
        'Some deployments failed. Use --continue-on-error to ignore failures.'
      )
      process.exit(1)
    }
  }
}

module.exports = Deployer
