const { spawn } = require('child_process')

class CommandRunner {
  // Run a command and return a promise with enhanced error handling
  run(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: 'pipe',
        ...options,
      })

      let stdout = ''
      let stderr = ''

      child.stdout?.on('data', data => {
        stdout += data.toString()
      })

      child.stderr?.on('data', data => {
        stderr += data.toString()
      })

      child.on('close', code => {
        if (code === 0) {
          resolve({ stdout, stderr, exitCode: code })
        } else {
          const error = new Error(
            `Command '${command} ${args.join(
              ' '
            )}' failed with exit code ${code}`
          )
          error.exitCode = code
          error.stdout = stdout
          error.stderr = stderr
          error.command = `${command} ${args.join(' ')}`
          reject(error)
        }
      })

      child.on('error', error => {
        // This handles cases where the command itself cannot be executed
        error.command = `${command} ${args.join(' ')}`
        reject(error)
      })
    })
  }
}

module.exports = CommandRunner
