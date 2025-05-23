const fs = require('fs-extra')

class StoreValidator {
  constructor(logger, spinner) {
    this.logger = logger
    this.spinner = spinner
  }

  // Initialize stores.json file
  async initStoresFile(storesFile) {
    const exampleConfig = {
      stores: [
        {
          url: 'your-production-store.myshopify.com',
          theme_id: '123456789012',
        },
        {
          url: 'your-staging-store.myshopify.com',
          theme_id: '234567890123',
        },
        {
          url: 'your-dev-store.myshopify.com',
          theme_id: '345678901234',
        },
      ],
    }

    if (await fs.pathExists(storesFile)) {
      this.logger.warning(
        `${storesFile} already exists. Use --file to specify a different file.`
      )
      return
    }

    await fs.writeJson(storesFile, exampleConfig, { spaces: 2 })
    this.logger.success(`Created ${storesFile} with example configuration`)
    this.logger.info(
      `Edit ${storesFile} with your actual store URLs and theme IDs`
    )
    this.logger.info(
      'Then authenticate with: shopify auth login --store your-store.myshopify.com'
    )
  }

  // Validate stores configuration file
  async validateStoresFile(storesFile, options = {}) {
    const { verbose = false } = options

    const spinner = this.spinner.start(
      'Validating stores configuration file...',
      { verbose }
    )

    if (!(await fs.pathExists(storesFile))) {
      this.spinner.stop('error', 'Stores file not found')
      this.logger.error(`Stores file '${storesFile}' not found!`)
      this.logger.info('Run with --init to create an example stores.json file')
      process.exit(1)
    }

    try {
      const storesData = await fs.readJson(storesFile)

      if (!storesData.stores || !Array.isArray(storesData.stores)) {
        this.spinner.stop('error', 'Invalid stores configuration format')
        this.logger.error(
          'Invalid stores.json format. Expected { "stores": [...] }'
        )
        process.exit(1)
      }

      if (storesData.stores.length === 0) {
        this.spinner.stop('error', 'No stores found in configuration')
        this.logger.error(`No stores found in '${storesFile}'`)
        process.exit(1)
      }

      this.spinner.stop(
        'success',
        `Found ${storesData.stores.length} stores in configuration`
      )
      return storesData
    } catch (error) {
      this.spinner.stop('error', 'Failed to parse stores configuration')
      this.logger.error(`Invalid JSON in '${storesFile}': ${error.message}`)
      process.exit(1)
    }
  }

  // List all configured stores
  listStores(storesData) {
    this.logger.info('Configured stores:')
    console.log('')

    storesData.stores.forEach(store => {
      console.log(`• ${store.url} - Theme ID: ${store.theme_id}`)
    })
  }
}

module.exports = StoreValidator
