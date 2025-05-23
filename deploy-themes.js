#!/usr/bin/env node

/**
 * Shopify Theme Multi-Store Deployment Script
 * A Node.js CLI tool that deploys theme code to multiple Shopify stores using the Shopify CLI
 *
 * @version 1.0.0
 * @author Djordje Stevanovic
 * @email djordje42@gmail.com
 * @url https://github.com/djordje-st
 * @license MIT
 */

const chalk = require('chalk')
const ThemeDeployer = require('./src/ThemeDeployer')

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(
    chalk.red('[ERROR]'),
    'Unhandled Rejection at:',
    promise,
    'reason:',
    reason
  )
  process.exit(1)
})

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  console.error(chalk.red('[ERROR]'), 'Uncaught Exception:', error.message)
  process.exit(1)
})

// Run the deployer if this file is executed directly
if (require.main === module) {
  const deployer = new ThemeDeployer()
  deployer.run()
}

module.exports = ThemeDeployer
