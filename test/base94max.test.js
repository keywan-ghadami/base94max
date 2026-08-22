// test/base94max.test.js
import assert from 'assert';
import Base94Max from '../index.js';
import randomBytesSeed from 'random-bytes-seed';
import { spawnSync } from 'child_process';

describe('Base94Max', () => {

    // --- Test 1: Encoder-Ausgabe prÃ¼fen ---
    describe('encode() Output Validation', () => {
        const seed = 'EinFesterSeedStringFuerBase94MaxTests';
        const length = 8 * 1024; // 8 KB
        const testData = randomBytesSeed(seed)(length);

        const testDataForValidation = [
            { name: 'bigData', data: testData },
            // == Grundlegende LÃ¤ngen & Inhalte ==
            { name: 'empty', data: new Uint8Array([]) },
            { name: 'null byte', data: new Uint8Array([0]) },
            { name: 'one byte (100)', data: new Uint8Array([100]) },
            { name: 'max byte (255)', data: new Uint8Array([255]) },
            // Kurze LÃ¤ngen, um Padding/Blockenden zu testen
            { name: 'two bytes (0,0)', data: new Uint8Array([0, 0]) },
            { name: 'two bytes (1,2)', data: new Uint8Array([1, 2]) },
            { name: 'two bytes (255,255)', data: new Uint8Array([255, 255]) },
            { name: 'three bytes (1,2,3)', data: new Uint8Array([1, 2, 3]) },
            { name: 'four bytes (1,2,3,4)', data: new Uint8Array([1, 2, 3, 4]) },
            { name: 'five bytes (1,2,3,4,5)', data: new Uint8Array([1, 2, 3, 4, 5]) },
            { name: 'six bytes (0..5)', data: new Uint8Array([0, 1, 2, 3, 4, 5]) },
            { name: 'seven bytes (0..6)', data: new Uint8Array([0, 1, 2, 3, 4, 5, 6]) },
            { name: 'eight bytes (0..7)', data: new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]) },
            // == Spezielle Muster ==
            { name: 'all zeros (len 5)', data: new Uint8Array([0, 0, 0, 0, 0]) },
            { name: 'all 0xFF (len 5)', data: new Uint8Array([255, 255, 255, 255, 255]) },
            { name: 'alternating 0/FF (len 6)', data: new Uint8Array([0, 255, 0, 255, 0, 255]) },
            { name: 'alternating 55/AA (len 6)', data: new Uint8Array([0x55, 0xAA, 0x55, 0xAA, 0x55, 0xAA]) },
            // == HÃ¤ufige Beispiele / TextÃ¤quivalente ==
            { name: 'text "Hello"', data: new Uint8Array([72, 101, 108, 108, 111]) },
            { name: 'text "Man"', data: new Uint8Array([77, 97, 110]) },
            { name: 'text "Test!"', data: new Uint8Array([84, 101, 115, 116, 33]) },
            { name: 'text "<>?/"', data: new Uint8Array([60, 62, 63, 47]) },
            // == Sequenzen ==
            { name: 'low bytes sequence (1..8)', data: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]) },
            { name: 'high bytes sequence (254..247)', data: new Uint8Array([254, 253, 252, 251, 250, 249, 248, 247]) },
            { name: 'all byte values (0-255)', data: new Uint8Array(Array.from({ length: 256 }, (_, i) => i)) },
            { name: 'medium sequence patterned (len 30)', data: new Uint8Array(Array.from({ length: 30 }, (_, i) => (i * 13 + 5) % 256)) },
            { name: 'medium sequence patterned (len 31)', data: new Uint8Array(Array.from({ length: 31 }, (_, i) => (i * 7 + 11) % 256)) },
            { name: 'random bytes', data: new Uint8Array(Array.from({ length: 50 }, () => Math.floor(Math.random() * 256))) }
        ];

        const firstCharCode = 33;  // '!'
        const lastCharCode = 126;  // '~'

        it('should return an empty string for empty input', () => {
            assert.strictEqual(Base94Max.encode(new Uint8Array([])), '');
        });

        it('should only contain valid Base94Max characters (! to ~)', () => {
            testDataForValidation.forEach(tc => {
                const encoded = Base94Max.encode(tc.data);
                for (let i = 0; i < encoded.length; i++) {
                    const charCode = encoded.charCodeAt(i);
                    assert(
                        charCode >= firstCharCode && charCode <= lastCharCode,
                        `Test "${tc.name}": Invalid char '${encoded[i]}' (code ${charCode}) found in "${encoded}"`
                    );
                }
            });
        });

        it('should never emit whitespace, which is what lets the decoder skip it', () => {
            testDataForValidation.forEach(tc => {
                assert(
                    !/\s/.test(Base94Max.encode(tc.data)),
                    `Test "${tc.name}": encoder emitted a whitespace character`
                );
            });
        });
    });

    // --- Test 2: Round Trip (Encode -> Decode -> Compare) ---
    describe('Round Trip Verification (decode(encode(x)) === x)', () => {

        function assertArraysEqual(arr1, arr2, message) {
            assert.strictEqual(arr1.length, arr2.length, `${message}: Array lengths differ: ${arr1.length} vs ${arr2.length}`);
            for (let i = 0; i < arr1.length; i++) {
                assert.strictEqual(arr1[i], arr2[i], `${message}: Array element at index ${i} differs: ${arr1[i]} vs ${arr2[i]}`);
            }
        }

        const testCases = [
            { name: 'empty array', data: new Uint8Array([]) },
            { name: 'zero byte', data: new Uint8Array([0]) },
            { name: 'single byte 1', data: new Uint8Array([100]) },
            { name: 'single byte 2', data: new Uint8Array([255]) },
            { name: 'short sequence', data: new Uint8Array([1, 2, 3]) },
            { name: 'sequence causing 13-bit', data: new Uint8Array([0xff, 0xff]) },
            { name: 'sequence causing 14-bit', data: new Uint8Array([0x01, 0x01]) },
            { name: 'medium sequence', data: new Uint8Array(Array.from({ length: 30 }, (_, i) => (i * 7) % 256)) },
            { name: 'all byte values', data: new Uint8Array(Array.from({ length: 256 }, (_, i) => i)) },
            { name: 'empty string', text: "" },
            { name: 'simple ASCII', text: "Hello World!" },
            { name: 'ASCII with symbols', text: "`{|}~_[]\\^@?" },
            { name: 'complex UTF-8', text: "ä½ å¥½ä¸–ç•Œ Base94Max ðŸ˜Šâœ…" },
        ];

        // 2a: Standard Alphabet Round Trip
        testCases.forEach(tc => {
            it(`should correctly preserve data for: ${tc.name}`, () => {
                if (tc.data !== undefined) {
                    const encoded = Base94Max.encode(tc.data);
                    const decoded = Base94Max.decode(encoded);
                    assertArraysEqual(decoded, tc.data, `Binary round trip failed for "${tc.name}"`);
                }
                if (tc.text !== undefined) {
                    const encodedText = Base94Max.encodeText(tc.text);
                    const decodedText = Base94Max.decodeText(encodedText);
                    assert.strictEqual(decodedText, tc.text, `Text round trip failed for "${tc.name}"`);
                }
            });
        });

        // 2b: JSON_DELETE Round Trip. The deprecation warning is asserted once, in its
        // own suite below, because it is only emitted on first use per process.
        describe('Deprecated JSON_DELETE Mode', () => {
            testCases.forEach(tc => {
                it(`should preserve data for: ${tc.name}`, () => {
                    if (tc.data !== undefined) {
                        const encoded = Base94Max.encode(tc.data, Base94Max.JSON_DELETE);
                        const decoded = Base94Max.decode(encoded, Base94Max.JSON_DELETE);
                        assertArraysEqual(decoded, tc.data, `Binary round trip failed for "${tc.name}"`);
                    }
                    if (tc.text !== undefined) {
                        const encodedText = Base94Max.encodeText(tc.text, Base94Max.JSON_DELETE);
                        const decodedText = Base94Max.decodeText(encodedText, Base94Max.JSON_DELETE);
                        assert.strictEqual(decodedText, tc.text, `Text round trip failed for "${tc.name}"`);
                    }
                });
            });

            it('should keep space as a data character, not skip it as whitespace', () => {
                // Space belongs to the JSON_DELETE alphabet, so the decoder's
                // whitespace-skipping path must never apply to it.
                let withSpace = null;
                for (let i = 0; i < 100000 && !withSpace; i++) {
                    const data = new Uint8Array(Array.from({ length: 16 }, () => Math.floor(Math.random() * 256)));
                    const encoded = Base94Max.encode(data, Base94Max.JSON_DELETE);
                    if (encoded.includes(' ')) withSpace = { data, encoded };
                }
                assert(withSpace, 'no payload containing a space was produced');
                assertArraysEqual(
                    Base94Max.decode(withSpace.encoded, Base94Max.JSON_DELETE),
                    withSpace.data,
                    'space was dropped instead of decoded'
                );
            });
        });
    });

    // --- Test 3: Deprecation-Warnung ---
    describe('JSON_DELETE deprecation warning', () => {
        // The warning goes through process.emitWarning rather than console.warn, so
        // that Node's --no-deprecation and --throw-deprecation flags work. It fires
        // once per process, so it is verified in a child process: asserting it
        // in-process would silently depend on which suite ran first.
        const MODULE = new URL('../index.js', import.meta.url).href;

        const runChild = (script, flags = []) => {
            const result = spawnSync(
                process.execPath,
                [...flags, '--input-type=module', '-e',
                    `import Base94Max from ${JSON.stringify(MODULE)};\n${script}`],
                { encoding: 'utf8' }
            );
            return { stdout: result.stdout, stderr: result.stderr, status: result.status };
        };

        const USE_JSON_DELETE =
            'for (let i = 0; i < 5; i++) Base94Max.encode(new Uint8Array([1,2,3]), Base94Max.JSON_DELETE);';

        it('should emit a DeprecationWarning when JSON_DELETE is used', () => {
            const { stderr, status } = runChild(USE_JSON_DELETE);
            assert.strictEqual(status, 0);
            assert.match(stderr, /DeprecationWarning/);
            assert.match(stderr, /DEP_BASE94MAX_JSON_DELETE/);
            assert.match(stderr, /deprecated/i);
        });

        it('should emit the warning only once per process', () => {
            const { stderr } = runChild(USE_JSON_DELETE);
            const count = (stderr.match(/DEP_BASE94MAX_JSON_DELETE/g) || []).length;
            assert.strictEqual(count, 1, `expected 1 warning, got ${count}`);
        });

        it('should not warn on the default PRINTABLE path', () => {
            const { stderr } = runChild(
                'Base94Max.decodeText(Base94Max.encodeText("no warning here"));'
            );
            assert.doesNotMatch(stderr, /DEP_BASE94MAX_JSON_DELETE/);
        });

        it('should honour --no-deprecation', () => {
            const { stderr, status } = runChild(USE_JSON_DELETE, ['--no-deprecation']);
            assert.strictEqual(status, 0);
            assert.doesNotMatch(stderr, /DEP_BASE94MAX_JSON_DELETE/);
        });

        it('should honour --throw-deprecation', () => {
            const { status } = runChild(USE_JSON_DELETE, ['--throw-deprecation']);
            assert.notStrictEqual(status, 0, 'expected a non-zero exit code');
        });
    });

    // --- Test 4: Fehlererkennung beim Decodieren ---
    describe('decode() / decodeText() Error Handling', () => {
        it('should throw on characters outside the alphabet', () => {
            assert.throws(() => Base94Max.decode('!!!!\u00e9!!!!'), /Invalid character/);
            assert.throws(() => Base94Max.decode('!!!!\u{1F600}!!!!'), /Invalid character/);
            assert.throws(() => Base94Max.decode('!!!!\x00!!!!'), /Invalid character/);
            assert.throws(() => Base94Max.decode('!!!!\x7f!!!!'), /Invalid character/);
        });

        // Regression: decodeMap has 128 entries, so a character at or above 0x80 read
        // past its end and produced undefined, which is not equal to the invalid
        // marker. The guard never fired and the character was folded into the bit
        // stream as NaN, yielding wrong bytes with no error at all.
        it('should never silently accept a character above 0x7F', () => {
            let silent = 0;
            for (let i = 0; i < 500; i++) {
                const data = new Uint8Array(Array.from({ length: 24 }, () => Math.floor(Math.random() * 256)));
                const encoded = Base94Max.encode(data);
                const pos = Math.floor(Math.random() * encoded.length);
                const corrupted = encoded.slice(0, pos)
                    + String.fromCharCode(128 + Math.floor(Math.random() * 128))
                    + encoded.slice(pos + 1);
                try {
                    const out = Base94Max.decode(corrupted);
                    if (out.length !== data.length || out.some((b, k) => b !== data[k])) silent++;
                } catch {
                    // expected
                }
            }
            assert.strictEqual(silent, 0, `${silent} of 500 corrupted inputs decoded silently to wrong bytes`);
        });

        it('should throw decodeText on non-UTF8 binary result', () => {
            const invalidUtf8Bytes = new Uint8Array([0xC3, 0x28]);
            const encoded = Base94Max.encode(invalidUtf8Bytes);
            assert.throws(() => Base94Max.decodeText(encoded), /Decoded data is not valid UTF-8|URI malformed|invalid byte sequence/i);
        });
    });

    // --- Test 5: Whitespace-Toleranz beim Decodieren ---
    describe('Whitespace handling in decode()', () => {
        const data = new Uint8Array(Array.from({ length: 64 }, (_, i) => (i * 31 + 7) % 256));
        const encoded = Base94Max.encode(data);

        const expectRoundTrip = (input, label) => {
            const out = Base94Max.decode(input);
            assert.strictEqual(out.length, data.length, `${label}: length differs`);
            for (let i = 0; i < data.length; i++) {
                assert.strictEqual(out[i], data[i], `${label}: byte ${i} differs`);
            }
        };

        // Regression: bin/base94.js terminates its output with a newline and decode()
        // used to reject it, so the CLI wrote files the library itself could not read.
        it('should accept the trailing newline written by the CLI', () => {
            expectRoundTrip(encoded + '\n', 'trailing LF');
            expectRoundTrip(encoded + '\r\n', 'trailing CRLF');
        });

        it('should accept line-wrapped input', () => {
            expectRoundTrip(encoded.replace(/(.{20})/g, '$1\n'), 'wrapped LF');
            expectRoundTrip(encoded.replace(/(.{20})/g, '$1\r\n'), 'wrapped CRLF');
        });

        it('should accept surrounding whitespace', () => {
            expectRoundTrip('  \t' + encoded + ' \n\t ', 'padded');
        });

        // Consequence of the lenient rule, pinned here so it stays deliberate:
        // whitespace carries no data, so a blank string decodes to no bytes rather
        // than raising. Base64 implementations behave the same way. Callers that
        // need to reject blank input must check for it themselves.
        it('should decode a whitespace-only string to zero bytes', () => {
            assert.strictEqual(Base94Max.decode('   \n\t ').length, 0);
            assert.strictEqual(Base94Max.decode('').length, 0);
        });
    });
});
