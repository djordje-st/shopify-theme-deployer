const chalk = require('chalk')

class RetryManager {
  constructor(logger, spinner, errorParser) {
    this.logger = logger
    this.spinner = spinner
    this.errorParser = errorParser
  }

  // Sleep utility function
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Retry operation with exponential backoff
  async retryWithBackoff(operation, store, options = {}) {
    const { retryCount = 3, retryDelay = 1000, verbose = false } = options

    let lastError = null

    // Attempt operation with retries
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const success = await operation(store, {
          ...options,
          singleStore: false, // We're handling retries here
        })

        if (success) {
          if (attempt > 0) {
            this.logger.success(
              `Operation succeeded for ${store.url} after ${attempt} retry(ies)`
            )
            await this.logger.log(
              `RETRY_SUCCESS - ${store.url} - Attempts: ${attempt + 1}`
            )
          }
          return { success: true, attempts: attempt + 1 }
        }
      } catch (error) {
        lastError = error
      }

      // If this was the last attempt, don't retry
      if (attempt === retryCount) {
        break
      }

      // Parse error to determine if it's retryable
      const parsedError = this.errorParser.parse(lastError)

      if (!this.errorParser.isRetryable(parsedError)) {
        this.logger.warning(
          `Non-retryable error for ${store.url}: ${parsedError.type}`
        )
        await this.logger.log(
          `NON_RETRYABLE - ${store.url} - Error: ${parsedError.type}`
        )
        break
      }

      // Calculate delay with exponential backoff
      const delay = retryDelay * Math.pow(2, attempt)

      this.logger.warning(
        `Operation failed for ${store.url}, retrying in ${delay}ms (attempt ${
          attempt + 1
        }/${retryCount + 1})`
      )
      await this.logger.log(
        `RETRY_ATTEMPT - ${store.url} - Attempt: ${
          attempt + 1
        } - Delay: ${delay}ms`
      )

      if (verbose) {
        console.log(chalk.gray(`Retry reason: ${parsedError.message}`))
      }

      await this.sleep(delay)
    }

    // All retries failed
    const parsedError = this.errorParser.parse(lastError)
    await this.logger.log(
      `RETRY_EXHAUSTED - ${store.url} - Final error: ${parsedError.type}`
    )

    return {
      success: false,
      attempts: retryCount + 1,
      error: parsedError,
    }
  }

  // Limit concurrent operations
  async limitConcurrency(tasks, maxConcurrent) {
    const results = []
    const executing = []

    for (const task of tasks) {
      const promise = task().then(result => {
        executing.splice(executing.indexOf(promise), 1)
        return result
      })

      results.push(promise)
      executing.push(promise)

      if (executing.length >= maxConcurrent) {
        await Promise.race(executing)
      }
    }

    return Promise.allSettled(results)
  }
}

module.exports = RetryManager
