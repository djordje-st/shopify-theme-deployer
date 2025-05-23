class ErrorParser {
  // Parse Shopify CLI error messages for better user feedback
  parse(error) {
    const { stderr, stdout, exitCode } = error
    const fullOutput = (stderr + stdout).toLowerCase()

    // Common Shopify CLI error patterns
    if (
      fullOutput.includes('authentication') ||
      fullOutput.includes('not authenticated')
    ) {
      return {
        type: 'AUTHENTICATION_ERROR',
        message:
          'Authentication required. Please run: shopify auth login --store your-store.myshopify.com',
        suggestion: 'Run authentication command and try again',
      }
    }

    if (
      fullOutput.includes('theme not found') ||
      fullOutput.includes('theme does not exist')
    ) {
      return {
        type: 'THEME_NOT_FOUND',
        message: 'Theme not found. Please check the theme ID is correct.',
        suggestion: 'Use "shopify theme list" to see available themes',
      }
    }

    if (
      fullOutput.includes('store not found') ||
      fullOutput.includes('shop not found')
    ) {
      return {
        type: 'STORE_NOT_FOUND',
        message: 'Store not found. Please check the store URL is correct.',
        suggestion: 'Verify the store URL format: your-store.myshopify.com',
      }
    }

    if (
      fullOutput.includes('permission') ||
      fullOutput.includes('access denied')
    ) {
      return {
        type: 'PERMISSION_ERROR',
        message:
          'Permission denied. You may not have access to this store or theme.',
        suggestion: 'Check your store permissions or re-authenticate',
      }
    }

    if (
      fullOutput.includes('rate limit') ||
      fullOutput.includes('too many requests')
    ) {
      return {
        type: 'RATE_LIMIT_ERROR',
        message: 'Rate limit exceeded. Please wait before trying again.',
        suggestion: 'Wait a few minutes and retry the deployment',
      }
    }

    if (fullOutput.includes('network') || fullOutput.includes('connection')) {
      return {
        type: 'NETWORK_ERROR',
        message:
          'Network connection error. Please check your internet connection.',
        suggestion: 'Check your network connection and try again',
      }
    }

    // Generic error
    return {
      type: 'SHOPIFY_CLI_ERROR',
      message: 'Shopify CLI command failed',
      suggestion: 'Check the error details below and verify your configuration',
    }
  }

  // Determine if an error is retryable
  isRetryable(parsedError) {
    const retryableTypes = [
      'RATE_LIMIT_ERROR',
      'NETWORK_ERROR',
      'SHOPIFY_CLI_ERROR', // Generic errors might be temporary
    ]

    return retryableTypes.includes(parsedError.type)
  }
}

module.exports = ErrorParser
