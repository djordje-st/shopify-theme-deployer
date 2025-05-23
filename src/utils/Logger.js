const fs = require('fs-extra')
const chalk = require('chalk')

class Logger {
  constructor(logFile) {
    this.logFile = logFile
  }

  info(message) {
    console.log(chalk.blue('[INFO]'), message)
  }

  success(message) {
    console.log(chalk.green('[SUCCESS]'), message)
  }

  warning(message) {
    console.log(chalk.yellow('[WARNING]'), message)
  }

  error(message) {
    console.log(chalk.red('[ERROR]'), message)
  }

  async log(message) {
    const timestamp = new Date().toISOString()
    const logMessage = `${timestamp}: ${message}\n`
    await fs.appendFile(this.logFile, logMessage)
  }
}

module.exports = Logger
