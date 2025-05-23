const chalk = require('chalk')

class Spinner {
  constructor() {
    this.currentSpinner = null
    this.spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  }

  start(message, options = {}) {
    const { verbose = false } = options

    // Don't show spinner in verbose mode to avoid cluttering output
    if (verbose) {
      console.log(chalk.blue('[INFO]'), message)
      return null
    }

    let index = 0

    // Clear any existing spinner
    if (this.currentSpinner) {
      this.stop()
    }

    const spinner = {
      message,
      interval: setInterval(() => {
        process.stdout.write(
          `\r${chalk.blue(this.spinnerChars[index])} ${message}`
        )
        index = (index + 1) % this.spinnerChars.length
      }, 100),
      stopped: false,
    }

    this.currentSpinner = spinner
    return spinner
  }

  stop(result = null, customMessage = null) {
    if (!this.currentSpinner || this.currentSpinner.stopped) {
      return
    }

    clearInterval(this.currentSpinner.interval)
    this.currentSpinner.stopped = true

    // Clear the spinner line
    process.stdout.write('\r' + ' '.repeat(process.stdout.columns || 80) + '\r')

    // Show result if provided
    if (result === 'success') {
      console.log(
        chalk.green('[SUCCESS]'),
        customMessage || this.currentSpinner.message
      )
    } else if (result === 'error') {
      console.log(
        chalk.red('[ERROR]'),
        customMessage || this.currentSpinner.message
      )
    } else if (result === 'warning') {
      console.log(
        chalk.yellow('[WARNING]'),
        customMessage || this.currentSpinner.message
      )
    } else if (customMessage) {
      console.log(chalk.blue('[INFO]'), customMessage)
    }

    this.currentSpinner = null
  }

  updateMessage(message) {
    if (this.currentSpinner && !this.currentSpinner.stopped) {
      this.currentSpinner.message = message
    }
  }

  isActive() {
    return this.currentSpinner && !this.currentSpinner.stopped
  }
}

module.exports = Spinner
