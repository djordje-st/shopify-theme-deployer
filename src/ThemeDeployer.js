const { Command } = require('commander')
const chalk = require('chalk')

// Utilities
const Logger = require('./utils/Logger')
const Spinner = require('./utils/Spinner')
const CommandRunner = require('./utils/CommandRunner')
const ErrorParser = require('./utils/ErrorParser')

// Core modules
const StoreValidator = require('./core/StoreValidator')
const BackupManager = require('./core/BackupManager')
const RetryManager = require('./core/RetryManager')
const Deployer = require('./core/Deployer')

class ThemeDeployer {
  constructor() {
    this.storesFile = 'stores.json'
    this.logFile = `deployment-${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, -5)}.log`

    this.program = new Command()

    // Initialize utilities
    this.logger = new Logger(this.logFile)
    this.spinner = new Spinner()
    this.commandRunner = new CommandRunner()
    this.errorParser = new ErrorParser()

    // Initialize core modules
    this.storeValidator = new StoreValidator(this.logger, this.spinner)
    this.backupManager = new BackupManager(
      this.logger,
      this.spinner,
      this.commandRunner,
      this.errorParser
    )
    this.retryManager = new RetryManager(
      this.logger,
      this.spinner,
      this.errorParser
    )
    this.deployer = new Deployer(
      this.logger,
      this.spinner,
      this.commandRunner,
      this.errorParser,
      this.backupManager,
      this.retryManager
    )

    this.setupCommander()
    this.setupProcessHandlers()
  }

  setupCommander() {
    this.program
      .name('shopify-deploy')
      .description(
        'Deploy Shopify theme code to multiple stores simultaneously'
      )
      .version('1.0.0')
      .option('-f, --file <path>', 'specify stores file', 'stores.json')
      .option('-l, --list', 'list all stores in the configuration')
      .option('-s, --store <url>', 'deploy to a specific store by URL')
      .option('-v, --verbose', 'enable verbose logging')
      .option('--init', 'create example stores.json file')
      .option(
        '--continue-on-error',
        'continue deploying to other stores even if one fails'
      )
      .option('--dry-run', 'preview deployment without actually deploying')
      .option(
        '--parallel',
        'deploy to stores in parallel instead of sequentially'
      )
      .option(
        '--max-concurrent <number>',
        'maximum concurrent deployments (default: 3)',
        '3'
      )
      .option(
        '--retry <count>',
        'number of retry attempts for failed deployments (default: 3)',
        '3'
      )
      .option(
        '--retry-delay <ms>',
        'base delay between retries in milliseconds (default: 1000)',
        '1000'
      )
      .option('--backup', 'backup themes before deployment')
      .option(
        '--backup-dir <path>',
        'directory for theme backups (default: ./backups)',
        './backups'
      )
      .parse()
  }

  // Setup process handlers to clean up spinners
  setupProcessHandlers() {
    const cleanup = () => {
      if (this.spinner.isActive()) {
        this.spinner.stop()
      }
    }

    process.on('SIGINT', () => {
      cleanup()
      process.exit(0)
    })

    process.on('SIGTERM', () => {
      cleanup()
      process.exit(0)
    })
  }

  // Main execution function
  async run() {
    try {
      const options = this.program.opts()

      // Set stores file if specified (must be done before init)
      if (options.file) {
        this.storesFile = options.file
      }

      // Handle init command
      if (options.init) {
        await this.storeValidator.initStoresFile(this.storesFile)
        return
      }

      // Check dependencies and validate stores file
      await this.deployer.checkDependencies(options)
      const storesData = await this.storeValidator.validateStoresFile(
        this.storesFile,
        options
      )

      // Handle different modes
      if (options.list) {
        this.storeValidator.listStores(storesData)
      } else if (options.store) {
        await this.deployer.deployToSpecificStore(storesData, options.store, {
          continueOnError: options.continueOnError,
          verbose: options.verbose,
          dryRun: options.dryRun,
          retry: parseInt(options.retry),
          retryDelay: parseInt(options.retryDelay),
          backup: options.backup,
          backupDir: options.backupDir,
        })
      } else {
        await this.deployer.deployToAllStores(storesData, {
          continueOnError: options.continueOnError,
          verbose: options.verbose,
          dryRun: options.dryRun,
          parallel: options.parallel,
          maxConcurrent: parseInt(options.maxConcurrent),
          retry: parseInt(options.retry),
          retryDelay: parseInt(options.retryDelay),
          backup: options.backup,
          backupDir: options.backupDir,
        })
      }

      // Log completion
      this.logger.info(`Log file: ${this.logFile}`)
    } catch (error) {
      this.logger.error(`Unexpected error: ${error.message}`)
      if (options && options.verbose) {
        console.error(error.stack)
      }
      await this.logger.log(`UNEXPECTED_ERROR: ${error.message}`)
      process.exit(1)
    }
  }
}

module.exports = ThemeDeployer
