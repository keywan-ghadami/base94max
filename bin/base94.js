#!/usr/bin/env node

// Import necessary modules
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import Base94Max from '../index.js';

// --- Argument Parsing using yargs ---
let argv;
try {
  argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 [options] < STDIN > STDOUT')
    .option('charset', {
      alias: 'c',
      describe: 'Treat input data as',
      choices: ['utf8', 'bin'],
      default: 'utf8',
      type: 'string'
    })
    .option('mode', {
      alias: 'm',
      describe: 'Encoding variant (character set)',
      choices: ['printable', 'json-delete'],
      default: 'printable',
      type: 'string'
    })
    .epilog('Reads data from stdin, encodes it using Base94Max, and writes to stdout.')
    .help()
    .alias('h', 'help')
    .strict() // Report errors for unknown options
    .wrap(null) // Auto-adjust help message width
    .parseSync(); // Parse arguments synchronously
} catch (err) {
  // yargs throws errors for invalid choices etc.
  console.error("Argument Error:", err.message);
  // yargs usually prints help on error, but we exit just in case
  process.exit(1);
}


// --- Function to Read Stdin ---
/**
 * Reads all data from standard input into a Buffer.
 * @returns {Promise<Buffer>} A promise that resolves with the complete input Buffer.
 */
async function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (chunk) => {
      // Ensure chunks are Buffers
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    process.stdin.on('error', (err) => {
      reject(new Error(`Error reading stdin: ${err.message}`));
    });
    process.stdin.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
  });
}

// --- Main Execution Logic ---
async function run() {
  try {
    // 1. Read all data from stdin
    const inputBuffer = await readStdin();

    // 2. Select the correct Base94Max variant map object
    const maps = (argv.mode === 'json-delete')
      ? Base94Max.JSON_DELETE
      : Base94Max.PRINTABLE; // Default is 'printable'

    // 3. Encode the data based on the charset parameter
    let encodedResult;
    if (argv.charset === 'bin') {
      // Treat input as raw binary data
      encodedResult = Base94Max.encode(inputBuffer, maps);
    } else {
      // Treat input as UTF-8 text (default)
      // Need try-catch here? No, TextDecoder handles it in uint8ArrayToString if needed,
      // but here we convert Buffer -> JS String first. toString is safe.
      const inputText = inputBuffer.toString('utf8');
      encodedResult = Base94Max.encodeText(inputText, maps);
    }

    // 4. Write the encoded result to stdout
    // console.log adds a newline, process.stdout.write doesn't.
    // For piping, write might be slightly better, but console.log is often fine.
    process.stdout.write(encodedResult + '\n'); // Add newline manually if using write

  } catch (error) {
    // Catch errors from stdin reading, Base94Max encoding, or map validation
    console.error('Error:', error.message);
    process.exit(1); // Exit with a non-zero code to indicate failure
  }
}

// --- Start the process ---
run();

