// test/base94max.test.js
import assert from 'assert'; // Node.js built-in assertion library
import Base94Max from '../index.js'; // Importiere dein Modul (Pfad anpassen falls nötig)

// --- Test Suite ---
describe('Base94Max', () => {

    // --- Test 1: Encoder-Ausgabe prüfen ---
    describe('encode() Output Validation', () => {

        const testDataForValidation = [
            { name: 'empty', data: new Uint8Array([]) },
            { name: 'simple', data: new Uint8Array([72, 101, 108, 108, 111]) }, // "Hello"
            { name: 'all bytes', data: new Uint8Array(Array.from({length: 256}, (_, i) => i)) },
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
    });

     // --- Test 3: Fehlererkennung beim Decodieren ---
     describe('decode() / decodeText() Error Handling', () => {
        it('should throw on invalid characters', () => {
            assert.throws(() => Base94Max.decode("Invalid Char Space"), /Invalid character.*' '/); // Space ist ungültig
            assert.throws(() => Base94Max.decode("ValidChars!!ButThen\nInvalid"), /Invalid character.*'\\n'/); // Newline ist ungültig
            assert.throws(() => Base94Max.decode("ValidChars!!ButThen\tInvalid"), /Invalid character.*'\\t'/); // Tab ist ungültig
        });

        it('should throw on invalid padding or structure (if detectable)', () => {
            // Ein String, der nur aus einem gültigen Zeichen besteht, ist meist ungültig,
            // da Zeichen normalerweise paarweise auftreten (außer bei speziellem Padding am Ende).
            assert.throws(() => Base94Max.decode("!"), /Invalid Base94Max padding/); // Beispiel für potenziell falsches Padding

            // Finde einen gültigen String und füge ein ungültiges Zeichen hinzu
            const validEncoded = Base94Max.encodeText("test"); // Erzeuge etwas Gültiges
             assert.throws(() => Base94Max.decode(validEncoded + "!"), /Invalid Base94Max padding/); // Anfügen eines einzelnen Zeichens sollte Padding brechen
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
