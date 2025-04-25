// test/base94max.test.js
import assert from 'assert'; // Node.js built-in assertion library
import Base94Max from '../index.js'; // Importiere dein Modul (Pfad anpassen falls nötig)
import randomBytesSeed from 'random-bytes-seed';

// --- Test Suite ---
describe('Base94Max', () => {


    // --- Test 1: Encoder-Ausgabe prüfen ---
    describe('encode() Output Validation', () => {
        const seed = 'EinFesterSeedStringFuerBase94MaxTests'; // Seed ist hier ein String
        const length = 8 * 1024; // 8 KB - Länge nach Bedarf anpassen
        const testData = randomBytesSeed(seed)(length); 
        const testDataForValidation = [
    { name: 'bigData', data: testData },

// == Grundlegende Längen & Inhalte ==
    { name: 'empty', data: new Uint8Array([]) },
    { name: 'null byte', data: new Uint8Array([0]) },
    { name: 'one byte (100)', data: new Uint8Array([100]) },
    { name: 'max byte (255)', data: new Uint8Array([255]) },
    // Kurze Längen, um Padding/Blockenden zu testen
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
    // Bitmuster 01010101 und 10101010 abwechselnd
    { name: 'alternating 55/AA (len 6)', data: new Uint8Array([0x55, 0xAA, 0x55, 0xAA, 0x55, 0xAA]) },

    // == Häufige Beispiele / Textäquivalente ==
    { name: 'text "Hello"', data: new Uint8Array([72, 101, 108, 108, 111]) },
    { name: 'text "Man"', data: new Uint8Array([77, 97, 110]) }, // Bekanntes Base64-Beispiel
    { name: 'text "Test!"', data: new Uint8Array([84, 101, 115, 116, 33]) },
    { name: 'text "<>?/"', data: new Uint8Array([60, 62, 63, 47]) },

    // == Sequenzen, die Bit-Buffer anders füllen könnten ==
    { name: 'low bytes sequence (1..8)', data: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]) },
    { name: 'high bytes sequence (254..247)', data: new Uint8Array([254, 253, 252, 251, 250, 249, 248, 247]) },

    // == Kompletter Byte-Bereich (wichtig!) ==
    { name: 'all byte values (0-255)', data: new Uint8Array(Array.from({length: 256}, (_, i) => i)) },

    // == Etwas längere Beispiele ==
    // Erzeugt eine vorhersagbare, aber gemischte Sequenz
    { name: 'medium sequence patterned (len 30)', data: new Uint8Array(Array.from({length: 30}, (_, i) => (i * 13 + 5) % 256)) },
    { name: 'medium sequence patterned (len 31)', data: new Uint8Array(Array.from({length: 31}, (_, i) => (i * 7 + 11) % 256)) }, // Andere Länge -> anderes Padding
            { name: 'simple', data: new Uint8Array([72, 101, 108, 108, 111]) }, // "Hello"
            { name: 'random bytes', data: new Uint8Array(Array.from({length: 50}, () => Math.floor(Math.random() * 256))) }
        ];
        const firstCharCode = 33; // '!'
        const lastCharCode = 126; // '~'

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

    });

    // --- Test 2: Round Trip (Encode -> Decode -> Compare) ---
    describe('Round Trip Verification (decode(encode(x)) === x)', () => {

        // Hilfsfunktion zum Vergleichen von Uint8Arrays
        function assertArraysEqual(arr1, arr2, message) {
            assert.strictEqual(arr1.length, arr2.length, `${message}: Array lengths differ: ${arr1.length} vs ${arr2.length}`);
            for (let i = 0; i < arr1.length; i++) {
                assert.strictEqual(arr1[i], arr2[i], `${message}: Array element at index ${i} differs: ${arr1[i]} vs ${arr2[i]}`);
            }
        }

        // Definiere diverse Testfälle
        const testCases = [
            { name: 'empty array', data: new Uint8Array([]) },
            { name: 'zero byte', data: new Uint8Array([0]) },
            { name: 'single byte 1', data: new Uint8Array([100]) },
            { name: 'single byte 2', data: new Uint8Array([255]) },
            { name: 'short sequence', data: new Uint8Array([1, 2, 3]) },
            { name: 'sequence causing 13-bit', data: new Uint8Array([0xff, 0xff]) }, // Example likely needing 13-bit path
            { name: 'sequence causing 14-bit', data: new Uint8Array([0x01, 0x01]) }, // Example likely using 14-bit path
            { name: 'medium sequence', data: new Uint8Array(Array.from({length: 30}, (_, i) => (i * 7) % 256)) },
            { name: 'all byte values', data: new Uint8Array(Array.from({length: 256}, (_, i) => i)) },
            // Text-basierte Tests
            { name: 'empty string', text: "" },
            { name: 'simple ASCII', text: "Hello World!" },
            { name: 'ASCII with symbols', text: "`{|}~_[]\\^@?" },
            { name: 'complex UTF-8', text: "你好世界 Base94Max 😊✅" },
        ];

        testCases.forEach(tc => {
            it(`should correctly preserve data for: ${tc.name}`, () => {
                if (tc.data !== undefined) {
                    const encoded = Base94Max.encode(tc.data);
                    const decoded = Base94Max.decode(encoded);
                    assertArraysEqual(decoded, tc.data, `Binary round trip failed for "${tc.name}"`);
                }
                if (tc.text !== undefined) {
                    const encodedText = Base94Max.encodeText(tc.text);
                    //console.log(`Test: ${tc.name}\nText: ${tc.text}\nEncoded: ${encodedText}`); // Debugging
                    const decodedText = Base94Max.decodeText(encodedText);
                    assert.strictEqual(decodedText, tc.text, `Text round trip failed for "${tc.name}"`);
                }
            });
        });

        testCases.forEach(tc => {
            it(`json should correctly preserve data for: ${tc.name}`, () => {
                if (tc.data !== undefined) {
                    const encoded = Base94Max.encode(tc.data,Base94Max.JSON_DELETE);
                    const decoded = Base94Max.decode(encoded,Base94Max.JSON_DELETE);
                    assertArraysEqual(decoded, tc.data, `Binary round trip failed for "${tc.name}"`);
                }
                if (tc.text !== undefined) {
                    const encodedText = Base94Max.encodeText(tc.text,Base94Max.JSON_DELETE);
                    //console.log(`Test: ${tc.name}\nText: ${tc.text}\nEncoded: ${encodedText}`); // Debugging
                    const decodedText = Base94Max.decodeText(encodedText,Base94Max.JSON_DELETE);
                    assert.strictEqual(decodedText, tc.text, `Text round trip failed for "${tc.name}"`);
                }
            });
        });
    });

     // --- Test 3: Fehlererkennung beim Decodieren ---
     describe('decode() / decodeText() Error Handling', () => {
        it('should throw on invalid characters', () => {
            assert.throws(() => Base94Max.decode("Invalid Char Space"), /Invalid character.*' '/); // Space ist ungültig
            assert.throws(() => Base94Max.decode("ValidChars!!ButThen\nInvalid"), /Invalid character.*'\n'/); // Newline ist ungültig
            assert.throws(() => Base94Max.decode("ValidChars!!ButThen\tInvalid"), /Invalid character.*'\t'/); // Tab ist ungültig
        });

        it('should throw decodeText on non-UTF8 binary result', () => {
            // Erzeuge Binärdaten, die keine gültige UTF-8 Sequenz darstellen
            // (z.B. ein Startbyte einer Mehrbyte-Sequenz ohne gültige Fortsetzung)
            const invalidUtf8Bytes = new Uint8Array([0xC3, 0x28]); // Ungültige UTF-8 Sequenz
            const encoded = Base94Max.encode(invalidUtf8Bytes);
            // Der Fehlertext kann je nach JS-Umgebung leicht variieren ("URI malformed", "Invalid character", etc.)
            assert.throws(() => Base94Max.decodeText(encoded), /Decoded data is not valid UTF-8 text|URI malformed|invalid byte sequence/);
        });
   });

});
