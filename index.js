// index.js - Modernized Base94Max with Variant Objects

class Base94Max {
    // --- Private Static Constants ---
    static #BASE = 94;
    static #INVALID_VALUE = 94; // Marker for invalid decoded char value
    static #K_MAX_VALUE_14BIT_ENCODING_THRESHOLD = 643; // (94*94-1) & 0x1FFF

    // --- Private Static Encode Maps (Hardcoded) ---

    /** @type {readonly string[]} */
    static #PRINTABLE_ENCODE_MAP = Object.freeze([
        '!', '"', '#', '$', '%', '&', '\'', '(', ')', '*', '+', ',', '-', '.', '/',
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ';', '<', '=', '>', '?',
        '@', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
        'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '[', '\\', ']', '^', '_',
        '`', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o',
        'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '{', '|', '}', '~'
    ]);

    /** @type {readonly string[]} */
    static #JSON_DELETE_ENCODE_MAP = Object.freeze([
        ' ', String.fromCharCode(127), '!', '#', '$', '%', '&', '\'', '(', ')', '*', '+', ',', '-', '.', '/',
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ';', '<', '=', '>', '?',
        '@', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
        'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '[', ']', '^', '_',
        '`', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o',
        'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '{', '|', '}', '~'
    ]);

    // --- Private Static Helper to Generate DecodeMap ---
    /**
     * Creates a decode map (charCode -> value) from an encode map (value -> char).
     * @param {readonly string[]} encodeMap The character map for encoding (length 94).
     * @returns {readonly number[]} The value map for decoding (length 128).
     * @private
     */
    static #createDecodeMap(encodeMap) {
        const decodeMap = new Array(128).fill(Base94Max.#INVALID_VALUE);
        for (let value = 0; value < Base94Max.#BASE; value++) {
            const char = encodeMap[value];
            // Basic validation for character and ensure it's within ASCII range 0-127
            if (char && char.length === 1) {
                const charCode = char.charCodeAt(0);
                if (charCode >= 0 && charCode < 128) {
                    // Avoid overwriting if multiple values map to the same char (should not happen with valid maps)
                    if (decodeMap[charCode] === Base94Max.#INVALID_VALUE) {
                         decodeMap[charCode] = value;
                    } else {
                         // This indicates a flawed encodeMap definition
                         console.warn(`Base94Max Setup Warning: Character '${char}' (Code ${charCode}) appears multiple times in encodeMap.`);
                    }
                } else {
                     console.warn(`Base94Max Setup Warning: Character '${char}' in encodeMap is outside the valid ASCII range 0-127.`);
                }
            } else {
                 console.warn(`Base94Max Setup Warning: Invalid entry at index ${value} in encodeMap.`);
            }
        }
        return Object.freeze(decodeMap);
    }

    // --- Private Static Decode Maps (Generated) ---
    /** @type {readonly number[]} */
    static #PRINTABLE_DECODE_MAP = Base94Max.#createDecodeMap(Base94Max.#PRINTABLE_ENCODE_MAP);
    /** @type {readonly number[]} */
    static #JSON_DELETE_DECODE_MAP = Base94Max.#createDecodeMap(Base94Max.#JSON_DELETE_ENCODE_MAP);


    // --- Public Static Readonly Variant Objects ---
    /**
     * Predefined variant using standard printable ASCII characters ('!' to '~').
     * Contains `{ encodeMap: readonly string[], decodeMap: readonly number[] }`.
     * @type {Readonly<{encodeMap: readonly string[], decodeMap: readonly number[]}>}
     */
    static PRINTABLE = Object.freeze({
        encodeMap: Base94Max.#PRINTABLE_ENCODE_MAP,
        decodeMap: Base94Max.#PRINTABLE_DECODE_MAP
    });

    /**
     * Predefined variant replacing problematic JSON characters '"' and '\'
     * with Space and DEL. Use for safer embedding in JSON strings.
     * Contains `{ encodeMap: readonly string[], decodeMap: readonly number[] }`.
     * @type {Readonly<{encodeMap: readonly string[], decodeMap: readonly number[]}>}
     */
    static JSON_DELETE = Object.freeze({
        encodeMap: Base94Max.#JSON_DELETE_ENCODE_MAP,
        decodeMap: Base94Max.#JSON_DELETE_DECODE_MAP
    });


    // --- Private Static Helper Functions (Encoding/Decoding Char - Unchanged) ---
    static #decodeCharValue(char, decodeMap) {
        const charCode = char.charCodeAt(0);
        return decodeMap[charCode];
    }


    // --- Private Static Helper Functions (String/Uint8Array Conversion - Unchanged) ---
    static #stringToUint8Array(str) {
        return new TextEncoder().encode(str);
    }
    static #uint8ArrayToString(uint8Array) {
        return new TextDecoder("utf-8", { fatal: true }).decode(uint8Array);
    }

    // --- Private Static Map Validation ---
    /**
     * Performs basic validation on a map set object.
     * @param {object} maps The object containing encodeMap and decodeMap.
     * @param {readonly string[]} maps.encodeMap The character map for encoding.
     * @param {readonly number[]} maps.decodeMap The value map for decoding.
     * @throws {Error} If the maps are invalid.
     * @private
     */
    static #validateMaps({ encodeMap, decodeMap }) {
         if (!encodeMap || !Array.isArray(encodeMap) || encodeMap.length !== Base94Max.#BASE) {
             throw new Error(`Invalid Base94Max maps provided: encodeMap must be an array of length ${Base94Max.#BASE}.`);
         }
         if (!decodeMap || !Array.isArray(decodeMap) || decodeMap.length !== 128) {
              throw new Error("Invalid Base94Max maps provided: decodeMap must be an array of length 128.");
         }
         // Optional: Add more checks, e.g., ensure all encodeMap entries are single chars
    }

    // --- Private Static Core Encoding/Decoding Logic (Adapted for Clarity) ---

    /** @private */
    static #encodeInternal(uint8Array, encodeMap) {
        // (Previous core logic, ensuring it uses the passed encodeMap via #encodeByteValue)
        let bit_buf = 0;
        let bit_count = 0;
        let result = "";
        const base = Base94Max.#BASE;

        for (let i = 0; i < uint8Array.length; i++) {
            const byte = uint8Array[i];
            bit_buf |= byte << bit_count;
            bit_count += 8;

            while (bit_count >= 14) {
                let block;
                if ((bit_buf & 0x1FFF) > Base94Max.#K_MAX_VALUE_14BIT_ENCODING_THRESHOLD) {
                    block = bit_buf & 0x1FFF;
                    bit_buf >>>= 13;
                    bit_count -= 13;
                } else {
                    block = bit_buf & 0x3FFF;
                    bit_buf >>>= 14;
                    bit_count -= 14;
                }
                result += encodeMap[block % base];
                result += encodeMap[Math.floor(block / base)];
            }
        }

        if (bit_count > 0) {
            result += encodeMap[bit_buf % base];
            if (bit_buf >= base || bit_count > 8) {
                 result += encodeMap[Math.floor(bit_buf / base)];
            }
        }
        return result;
    }

    /** @private */
    static #decodeInternal(inputString, decodeMap) {
        // (Previous core logic, ensuring it uses the passed decodeMap via #decodeCharValue)
        let bit_buf = 0;
        let bit_count = 0;
        const bytes = [];
        let symbol_buffer = -1;
        const base = Base94Max.#BASE;
        const invalidValue = Base94Max.#INVALID_VALUE;

        for (let i = 0; i < inputString.length; i++) {
            const charValue = Base94Max.#decodeCharValue(inputString[i], decodeMap);

            if (charValue === invalidValue) {
                throw new Error(`Invalid character in Base94Max string at position ${i}: '${inputString[i]}'`);
            }

            if (symbol_buffer === -1) {
                symbol_buffer = charValue;
            } else {
                const v = symbol_buffer + charValue * base;
                symbol_buffer = -1;

                bit_buf |= v << bit_count;
                bit_count += ((v & 0x1FFF) > Base94Max.#K_MAX_VALUE_14BIT_ENCODING_THRESHOLD) ? 13 : 14;

                while (bit_count >= 8) {
                    bytes.push(bit_buf & 0xFF);
                    bit_buf >>>= 8;
                    bit_count -= 8;
                }
            }
        }

        if (symbol_buffer !== -1) {
             bit_buf |= symbol_buffer << bit_count;
             bytes.push(bit_buf & 0xFF);
             bit_buf >>>= 8;
        }
        if (bit_buf !== 0) {
           throw new Error("Invalid Base94Max padding or internal error (bit_buf != 0 after processing)");
        }
        return new Uint8Array(bytes);
    }


    // --- Public Static API Methods ---

    /**
     * Encodes binary data (Uint8Array) into a Base94Max string using specified maps.
     * @param {Uint8Array} binaryData The binary data to encode.
     * @param {Readonly<{encodeMap: readonly string[], decodeMap: readonly number[]}>} [maps=Base94Max.PRINTABLE]
     * An object containing the `encodeMap` and `decodeMap`. Defaults to `Base94Max.PRINTABLE`.
     * Users can provide `Base94Max.JSON_DELETE` or a custom object matching the structure.
     * @returns {string} The Base94Max encoded string.
     * @throws {Error} If input is not a Uint8Array or maps are invalid.
     */
    static encode(binaryData, maps = Base94Max.PRINTABLE) {
        if (!(binaryData instanceof Uint8Array)) {
            throw new Error("Input must be a Uint8Array");
        }
        Base94Max.#validateMaps(maps); // Validate the provided maps
        return Base94Max.#encodeInternal(binaryData, maps.encodeMap);
    }

    /**
     * Decodes a Base94Max string back into binary data (Uint8Array) using specified maps.
     * @param {string} base94MaxString The Base94Max string to decode.
     * @param {Readonly<{encodeMap: readonly string[], decodeMap: readonly number[]}>} [maps=Base94Max.PRINTABLE]
     * An object containing the `encodeMap` and `decodeMap`. Defaults to `Base94Max.PRINTABLE`.
     * Users can provide `Base94Max.JSON_DELETE` or a custom object matching the structure.
     * @returns {Uint8Array} The decoded binary data.
     * @throws {Error} If input is not a string, maps are invalid, or if decoding fails.
     */
    static decode(base94MaxString, maps = Base94Max.PRINTABLE) {
        if (typeof base94MaxString !== 'string') {
            throw new Error("Input must be a string");
        }
        Base94Max.#validateMaps(maps); // Validate the provided maps
        return Base94Max.#decodeInternal(base94MaxString, maps.decodeMap);
    }

    /**
     * Convenience function to encode a UTF-8 string directly to Base94Max using specified maps.
     * @param {string} textString The UTF-8 string to encode.
     * @param {Readonly<{encodeMap: readonly string[], decodeMap: readonly number[]}>} [maps=Base94Max.PRINTABLE]
     * An object containing the `encodeMap` and `decodeMap`. Defaults to `Base94Max.PRINTABLE`.
     * @returns {string} The Base94Max encoded string.
     * @throws {Error} If input is not a string or maps are invalid.
     */
    static encodeText(textString, maps = Base94Max.PRINTABLE) {
         if (typeof textString !== 'string') {
            throw new Error("Input must be a string");
        }
        Base94Max.#validateMaps(maps); // Validate maps early
        const uint8Array = Base94Max.#stringToUint8Array(textString);
        return Base94Max.#encodeInternal(uint8Array, maps.encodeMap);
    }

    /**
     * Convenience function to decode a Base94Max string directly to a UTF-8 string using specified maps.
     * @param {string} base94MaxString The Base94Max string to decode.
     * @param {Readonly<{encodeMap: readonly string[], decodeMap: readonly number[]}>} [maps=Base94Max.PRINTABLE]
     * An object containing the `encodeMap` and `decodeMap`. Defaults to `Base94Max.PRINTABLE`.
     * @returns {string} The decoded UTF-8 string.
     * @throws {Error} If input is not a string, maps are invalid, decoding fails, or the result is not valid UTF-8.
     */
    static decodeText(base94MaxString, maps = Base94Max.PRINTABLE) {
        // Base94Max.decode will validate maps and input string
        const uint8Array = Base94Max.decode(base94MaxString, maps);
        try {
            return Base94Max.#uint8ArrayToString(uint8Array);
        } catch (e) {
            throw new Error("Decoded data is not valid UTF-8 text."+e);
        }
    }
}

// --- Export ---
export default Base94Max;

