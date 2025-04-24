*This README was generated with assistance from Google AI.*

# Base94Max

[![npm version](https://img.shields.io/npm/v/base94max.svg?style=flat-square)](https://www.npmjs.com/package/base94max)
[![Build Status](https://img.shields.io/github/actions/workflow/status/keywan-ghadami/base94max/node.js.yml?branch=main&style=flat-square)](https://github.com/keywan-ghadami/base94max/actions)
[![License](https://img.shields.io/npm/l/base94max.svg?style=flat-square)](https://github.com/keywan-ghadami/base94max/blob/main/LICENSE)

A JavaScript implementation of the Base94Max encoding scheme (adaptive 13/14-bit, based on Google Crashpad) for encoding and decoding binary data with high space efficiency using printable ASCII characters.

## Installation

```bash
npm install base94max
```
## Usage

This module exports an object with methods for encoding and decoding. It supports both Uint8Array for binary data and convenience methods for UTF-8 strings.
```
Importing:
// ES Module
import Base94Max from 'base94max';

Basic Examples:
// --- Binary Data (Uint8Array) ---
const binaryData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"

// Encode
try {
    const encoded = Base94Max.encode(binaryData);
    console.log(`Encoded "Hello": ${encoded}`);
    // Encoded "Hello": E/6*rl!'>

    // Decode
    const decodedBytes = Base94Max.decode(encoded);
    console.log('Decoded Bytes:', decodedBytes);
    // Output: Decoded Bytes: Uint8Array(5) [ 72, 101, 108, 108, 111 ]

} catch (error) {
    console.error("An error occurred:", error.message);
}

// --- Text Data (UTF-8 Strings) ---
const text = "Base94Max is efficient! 😊";

try {
    // Encode Text
    const encodedText = Base94Max.encodeText(text);
    console.log(`Encoded Text: ${encodedText}`);

    // Decode Text
    const decodedText = Base94Max.decodeText(encodedText);
    console.log(`Decoded Text: ${decodedText}`);
    // Output: Decoded Text: Base94Max is efficient! 😊

} catch (error) {
    console.error("An error occurred:", error.message);
}
```

### API Methods

 * Base94Max.encode(binaryData: Uint8Array): string
   * Encodes a Uint8Array into a Base94Max string.
   * Throws an error if the input is not a Buffer or Uint8Array.
 * Base94Max.decode(base94MaxString: string): Uint8Array
   * Decodes a Base94Max string back into a Uint8Array.
   * Throws an error if the input is not a string, contains invalid characters, or has invalid padding/structure.
 * Base94Max.encodeText(textString: string): string
   * Convenience method. Encodes a UTF-8 string into a Base94Max string.
   * Throws an error if the input is not a string.
 * Base94Max.decodeText(base94MaxString: string): string
   * Convenience method. Decodes a Base94Max string back into a UTF-8 string.
   * Throws an error if decoding fails or if the resulting bytes are not valid UTF-8.

### Algorithm

#### Source

This implementation is based on the Base94 encoding algorithm found in Google's Crashpad crash reporting system. It uses an adaptive bit-packing scheme to maximize data density using 94 printable ASCII characters.
You can find the original C++ source code in the Crashpad repository

#### Comparison with Other Encodings

##### Character Set Considerations

Binary-to-text encodings map binary data onto a chosen set of characters. The choice of character set impacts usability and potential density:
 * Printable ASCII: printable ASCII characters ensure easy handling in text-based formats, emails, and source code.
 * Space Character (     ): While printable, the space character is often avoided in encodings because it can be sensitive to trimming, line wrapping, or indentation changes in different environments. Base94Max uses characters ! (ASCII 33) through ~ (ASCII 126), avoiding the space character.
 * Control Characters: ASCII control characters (0-31 and 127) are generally unsuitable for text encoding as they are non-printable and can cause issues with copy-paste, editors, terminals, and data transmission. Encodings like Base122 attempt to use more characters for higher theoretical density but may include characters that cause practical handling problems. Base94Max strictly avoids these.
It's important to note that simply having more characters does not automatically guarantee higher efficiency. The algorithm used to group input bits and map them to output characters plays a crucial role in the final space efficiency.

##### Efficiency Overview

Efficiency is typically measured as the ratio of input bits to output bits (where output bits are usually 8 per character). Higher percentages are better.
| Encoding | Character Set Size | Efficiency (Approx.) | Algorithm Type | Notes |
|---|---|---|---|---|
| Base64 | 64 | 75% | Fixed (6 bits -> 1 char) | Very common, uses A-Z, a-z, 0-9, +, / |
| Base85 (z85) | 85 | 80% | Fixed Block (4 bytes -> 5 chars) | Uses subset avoiding \ ' ", \, , ; |
| Base85 (Ascii85) | 85 | 80% | Fixed Block (4 bytes -> 5 chars) | Different character set than z85, includes punctuation |
| Base91 (basE91) | 91 | ~81.3% | Variable Length | Efficient, uses A-Z, a-z, 0-9, and various symbols |
| Base94 (numeric)* | 94 | ~81,93% | Numeric using BigInt | Uses !-~. Specifics depend on crate implementation. |
| Base94Max | 94 | ~81.3% - 87.5% | Adaptive Block (13/14 bits -> 2 chars) | Uses !-~. Efficiency varies slightly with input data. |

*Note: Efficiency and algorithm type for "Base94 (Rust)" are estimates based on common approaches for crates like base94. The specific implementation might vary.
Base94Max achieves high efficiency by adaptively choosing between encoding 13 or 14 bits into two output characters, depending on the input data values.
Tests
To run the test suite:
 * Ensure you have Node.js installed.
 * Clone the repository.
 * Install development dependencies: npm install
 * Run the tests: npm test
The tests use Mocha and Node.js' built-in assert module.

## License

This project is licensed under the Apache License 2.0. See the LICENSE file for details.

