// index.js - Modernized Base94Max with Variant Objects

class Base94Max {
    // --- Private Static Constants ---
    static #BASE = 94;
    static #INVALID_VALUE = 94; // Marker for invalid decoded char value
    static #K_MAX_VALUE_14BIT_ENCODING_THRESHOLD = 643; // (94*94-1) & 0x1FFF

    // Whitespace character codes. While decoding, a whitespace character that is
    // not part of the active alphabet is ignored rather than rejected, so that
    // line-wrapped or newline-terminated input decodes without preprocessing.
    static #WHITESPACE = new Set([0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20]);

    static #deprecationsEmitted = new Set();

    /** @private */
    static #emitDeprecation(code, message) {
        if (Base94Max.#deprecationsEmitted.has(code)) return;
        Base94Max.#deprecationsEmitted.add(code);
        if (typeof process !== 'undefined' && typeof process.emitWarning === 'function') {
            process.emitWarning(message, 'DeprecationWarning', code);
        } else {
            console.warn(`DeprecationWarning [${code}]: ${message}`);
        }
    }

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

    /** @private */
    static #JSON_DELETE_VARIANT = Object.freeze({
        encodeMap: Base94Max.#JSON_DELETE_ENCODE_MAP,
        decodeMap: Base94Max.#JSON_DELETE_DECODE_MAP
    });

    /**
     * Variant replacing '"' and '\' with Space and DEL.
     *
     * @deprecated Since 0.2.1, removed in 0.3.0. The substitution makes the output
     * fragile in exactly the way this encoding is meant to resist: roughly 4.6% of
     * payloads end in a space, so any whitespace normalisation in the transport chain
     * (a form parser, a CHAR column, a log pipeline) renders them undecodable, and
     * about 45% contain DEL, which is invisible in terminals, diffs and editors. It
     * also diverges from upstream Crashpad, which encodes with every printable
     * character except space. For structured text containers use Base85N
     * (https://base85n.ghadami.de/) instead.
     *
     * To keep reading data already encoded with this variant after 0.3.0, pass the
     * alphabet explicitly; see CHANGELOG.md.
     *
     * @type {Readonly<{encodeMap: readonly string[], decodeMap: readonly number[]}>}
     */
    static get JSON_DELETE() {
        Base94Max.#emitDeprecation(
            'DEP_BASE94MAX_JSON_DELETE',
            'Base94Max.JSON_DELETE is deprecated and will be removed in 0.3.0: its ' +
            'alphabet contains Space and DEL, which do not survive whitespace ' +
            'normalisation. Use the default PRINTABLE variant, or Base85N for ' +
            'structured text containers. See CHANGELOG.md to keep reading existing data.'
        );
        return Base94Max.#JSON_DELETE_VARIANT;
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
        let bit_buf = 0;
        let bit_count = 0;
        const bytes = [];
        let symbol_buffer = -1;
        const base = Base94Max.#BASE;
        const invalidValue = Base94Max.#INVALID_VALUE;

        for (let i = 0; i < inputString.length; i++) {
            const charCode = inputString.charCodeAt(i);
            // decodeMap only covers ASCII. Anything above must be rejected explicitly:
            // reading past the end yields undefined, which is not equal to the invalid
            // marker, so an unchecked lookup would let the character through and
            // silently produce wrong bytes.
            const charValue = charCode < 128 ? decodeMap[charCode] : invalidValue;

            if (charValue === invalidValue || charValue === undefined || charValue === null) {
                // Whitespace that is not part of this alphabet carries no data, so it
                // is ignored. This lets line-wrapped and newline-terminated input
                // decode as-is. Alphabets that use a whitespace character keep it as
                // data, because its lookup succeeds and never reaches this branch.
                if (Base94Max.#WHITESPACE.has(charCode)) {
                    continue;
                }
                const shown = charCode < 0x20 || charCode === 0x7f
                    ? `\\x${charCode.toString(16).padStart(2, '0')}`
                    : inputString[i];
                throw new Error(`Invalid character in Base94Max string at position ${i}: '${shown}'`);
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
// The accessor above replaces a static data property. Restore enumerability so
// that Object.keys(Base94Max) still lists it, as it did in 0.2.0.
Object.defineProperty(Base94Max, 'JSON_DELETE', {
    ...Object.getOwnPropertyDescriptor(Base94Max, 'JSON_DELETE'),
    enumerable: true
});

export default Base94Max;
