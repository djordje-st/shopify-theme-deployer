const fs = require('fs-extra')
const chalk = require('chalk')

class BackupManager {
  constructor(logger, spinner, commandRunner, errorParser) {
    this.logger = logger
    this.spinner = spinner
    this.commandRunner = commandRunner
    this.errorParser = errorParser
  }

  // Backup theme before deployment
  async backupTheme(store, backupDir, options = {}) {
    const { verbose = false, dryRun = false } = options
    const { url, theme_id } = store

    if (dryRun) {
      this.logger.info(`[DRY RUN] Would backup theme ${theme_id} from ${url}`)
      return true
    }

    const spinner = this.spinner.start(
      `Backing up theme ${theme_id} from ${url}...`,
      { verbose }
    )

    try {
      // Create backup directory with timestamp
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, -5)
      const storeBackupDir = `${backupDir}/${url.replace(
        '.myshopify.com',
        ''
      )}-${theme_id}-${timestamp}`

      await fs.ensureDir(storeBackupDir)

      const args = [
        'theme',
        'pull',
        '--store',
        url,
        '--theme',
        theme_id,
        '--path',
        storeBackupDir,
        '--force',
      ]

      if (verbose) {
        this.spinner.stop()
        this.logger.info(`Running backup command: shopify ${args.join(' ')}`)
        this.spinner.start(`Backing up theme ${theme_id} from ${url}...`, {
          verbose,
        })
      }

      await this.commandRunner.run('shopify', args)

      this.spinner.stop('success', `Theme backed up to: ${storeBackupDir}`)
      await this.logger.log(
        `BACKUP_SUCCESS - ${url} - Theme ID: ${theme_id} - Path: ${storeBackupDir}`
      )

      return storeBackupDir
    } catch (error) {
      const parsedError = this.errorParser.parse(error)

      this.spinner.stop('warning', `Failed to backup theme from ${url}`)
      this.logger.warning(`Backup error: ${parsedError.message}`)

      await this.logger.log(
        `BACKUP_FAILED - ${url} - Theme ID: ${theme_id} - Error: ${parsedError.message}`
      )

      if (verbose) {
        console.log(chalk.gray('Backup error details:'), error.command)
        if (error.stderr) {
          console.log(chalk.gray('STDERR:'), error.stderr)
        }
      }

      // Return false but don't throw - backup failure shouldn't stop deployment
      return false
    }
  }
}

module.exports = BackupManager
