
// index.js - Modernized with Class and Static Methods

class Base94Max {
    // --- Private Static Constants ---
    static #BASE = 94;
    static #FIRST_CHAR_CODE = 33; // ASCII code for '!'
    static #LAST_CHAR_CODE = 126;  // ASCII code for '~'

    // The threshold for using 13 bits vs 14 bits.
    // (BASE * BASE - 1) & 0x1FFF = (94 * 94 - 1) & 8191 = 8835 & 8191 = 643
    static #K_MAX_VALUE_14BIT_ENCODING_THRESHOLD = 643;

    // --- Private Static Helper Functions ---

    /**
     * Encodes a single value (0-93) into a Base94Max character.
     * @param {number} byteValue The value (0-93).
     * @returns {string} The corresponding Base94Max character.
     * @throws {Error} If the value is out of range.
     * @private
     */
    static #encodeByteValue(byteValue) {
        if (byteValue < 0 || byteValue >= this.#BASE) {
            throw new Error(`Invalid byte value for Base94Max encoding: ${byteValue}`);
        }
        return String.fromCharCode(byteValue + this.#FIRST_CHAR_CODE);
    }

    /**
     * Decodes a single Base94Max character back to its value (0-93).
     * @param {string} char The character to decode.
     * @returns {number} The decoded value (0-93), or >= BASE if invalid.
     * @private
     */
    static #decodeCharValue(char) {
        const charCode = char.charCodeAt(0);
        if (charCode < this.#FIRST_CHAR_CODE || charCode > this.#LAST_CHAR_CODE) {
            return this.#BASE; // Indicate invalid character
        }
        return charCode - this.#FIRST_CHAR_CODE;
    }

    /**
     * Helper to convert input string (assumed UTF-8) to Uint8Array for encoding.
     * @param {string} str The string to convert.
     * @returns {Uint8Array} The resulting Uint8Array.
     * @private
     */
    static #stringToUint8Array(str) {
        return new TextEncoder().encode(str);
    }

    /**
     * Helper to convert decoded Uint8Array back to string (assuming UTF-8).
     * Throws an error if the bytes do not form valid UTF-8.
     * @param {Uint8Array} uint8Array The Uint8Array to convert.
     * @returns {string} The resulting string.
     * @private
     */
    static #uint8ArrayToString(uint8Array) {
        // Use { fatal: true } to ensure invalid UTF-8 sequences throw an error
        return new TextDecoder("utf-8", { fatal: true }).decode(uint8Array);
    }


    // --- Private Static Core Encoding Logic ---

    /**
     * Internal implementation for encoding binary data.
     * @param {Uint8Array} uint8Array The binary data to encode.
     * @returns {string} The Base94Max encoded string.
     * @private
     */
    static #encodeInternal(uint8Array) {
        let bit_buf = 0;
        let bit_count = 0;
        let result = "";

        for (let i = 0; i < uint8Array.length; i++) {
            const byte = uint8Array[i];
            bit_buf |= byte << bit_count;
            bit_count += 8;

            // Process while enough bits are available (14 needed for the check)
            while (bit_count >= 14) {
                let block;
                // Check if we should encode 13 or 14 bits
                if ((bit_buf & 0x1FFF) > this.#K_MAX_VALUE_14BIT_ENCODING_THRESHOLD) {
                    // Encode 13 bits
                    block = bit_buf & 0x1FFF; // Mask 13 bits
                    bit_buf >>>= 13;          // Unsigned right shift
                    bit_count -= 13;
                } else {
                    // Encode 14 bits
                    block = bit_buf & 0x3FFF; // Mask 14 bits
                    bit_buf >>>= 14;          // Unsigned right shift
                    bit_count -= 14;
                }
                // Append the two characters
                result += this.#encodeByteValue(block % this.#BASE);
                result += this.#encodeByteValue(Math.floor(block / this.#BASE));
            }
        }

        // Handle trailing bits (Flush)
        if (bit_count > 0) {
            result += this.#encodeByteValue(bit_buf % this.#BASE);
            // Condition from C++ FinishEncoding: needs a second char if value >= BASE OR more than 1 byte represented (bit_count > 8)
            if (bit_buf >= this.#BASE || bit_count > 8) {
                 result += this.#encodeByteValue(Math.floor(bit_buf / this.#BASE));
            }
        }

        return result;
    }

    // --- Private Static Core Decoding Logic ---

    /**
     * Internal implementation for decoding a Base94Max string.
     * @param {string} inputString The Base94Max string to decode.
     * @returns {Uint8Array} The decoded binary data.
     * @throws {Error} If the input string contains invalid Base94Max characters or has invalid padding.
     * @private
     */
    static #decodeInternal(inputString) {
        let bit_buf = 0;
        let bit_count = 0;
        const bytes = [];
        let symbol_buffer = -1; // Use -1 to indicate empty buffer

        for (let i = 0; i < inputString.length; i++) {
            const charValue = this.#decodeCharValue(inputString[i]);

            if (charValue >= this.#BASE) {
                throw new Error(`Invalid character in Base94Max string at position ${i}: '${inputString[i]}'`);
            }

            if (symbol_buffer === -1) {
                // Store the first symbol of a pair
                symbol_buffer = charValue;
            } else {
                // Process the pair
                const v = symbol_buffer + charValue * this.#BASE;
                symbol_buffer = -1; // Reset buffer

                bit_buf |= v << bit_count;

                // Determine if 13 or 14 bits were encoded by this pair
                bit_count += ((v & 0x1FFF) > this.#K_MAX_VALUE_14BIT_ENCODING_THRESHOLD) ? 13 : 14;

                // Extract full bytes
                while (bit_count >= 8) {
                    bytes.push(bit_buf & 0xFF);
                    bit_buf >>>= 8;
                    bit_count -= 8;
                }
            }
        }

        // Handle trailing symbol (Flush/Padding Check)
        if (symbol_buffer !== -1) {
             // A single leftover symbol must correctly encode the remaining bits.
             // Add its value to the buffer.
             bit_buf |= symbol_buffer << bit_count;

             bytes.push(bit_buf & 0xFF); // Push the byte represented by remaining bits + last symbol
             bit_buf >>>= 8;
        }
        if (bit_buf !== 0) {
           throw new Error("Invalid Base94Max padding (bit_buf != 0)")
        }

        return new Uint8Array(bytes);
    }


    // --- Public Static API Methods ---

    /**
     * Encodes binary data (Uint8Array) into a Base94Max string.
     * @param {Uint8Array} binaryData The binary data to encode.
     * @returns {string} The Base94Max encoded string.
     * @throws {Error} If input is not a Uint8Array.
     */
    static encode(binaryData) {
        if (!(binaryData instanceof Uint8Array)) {
            // Or convert if possible? For now, strict.
            throw new Error("Input must be a Uint8Array");
        }
        return this.#encodeInternal(binaryData);
    }

    /**
     * Decodes a Base94Max string back into binary data (Uint8Array).
     * @param {string} base94MaxString The Base94Max string to decode.
     * @returns {Uint8Array} The decoded binary data.
     * @throws {Error} If input is not a string, or if decoding fails (invalid chars/padding).
     */
    static decode(base94MaxString) {
        if (typeof base94MaxString !== 'string') {
            throw new Error("Input must be a string");
        }
        // The core decode function handles validation errors
        return this.#decodeInternal(base94MaxString);
    }

    /**
     * Convenience function to encode a UTF-8 string directly to Base94Max.
     * @param {string} textString The UTF-8 string to encode.
     * @returns {string} The Base94Max encoded string.
     * @throws {Error} If input is not a string.
     */
    static encodeText(textString) {
         if (typeof textString !== 'string') {
            throw new Error("Input must be a string");
        }
        const uint8Array = this.#stringToUint8Array(textString);
        return this.#encodeInternal(uint8Array); // Use the internal method
    }

    /**
     * Convenience function to decode a Base94Max string directly to a UTF-8 string.
     * @param {string} base94MaxString The Base94Max string to decode.
     * @returns {string} The decoded UTF-8 string.
     * @throws {Error} If decoding fails or the result is not valid UTF-8.
     */
    static decodeText(base94MaxString) {
        // Use the public decode method first (handles string check and base94 decoding)
        const uint8Array = this.decode(base94MaxString);
        try {
            // uint8ArrayToString will throw if bytes are not valid UTF-8
            return this.#uint8ArrayToString(uint8Array);
        } catch (e) {
            // Re-throw or handle appropriately
//            console.error("Decoded data could not be interpreted as UTF-8 text.", e);
            throw new Error("Decoded data is not valid UTF-8 text.");
        }
    }
}

// --- Export ---
// Export the class as default
export default Base94Max;


