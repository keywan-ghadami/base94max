# Base94Max

[![npm version](https://img.shields.io/npm/v/base94max.svg?style=flat-square)](https://www.npmjs.com/package/base94max)
[![Build Status](https://img.shields.io/github/actions/workflow/status/keywan-ghadami/base94max/node.js.yml?branch=main&style=flat-square)](https://github.com/keywan-ghadami/base94max/actions)
[![License](https://img.shields.io/npm/l/base94max.svg?style=flat-square)](https://github.com/keywan-ghadami/base94max/blob/main/LICENSE)

A JavaScript implementation of the Base94Max encoding scheme (adaptive 13/14-bit).
It packs binary data into strictly printable ASCII at up to 87.5% space efficiency —
see [Efficiency](#efficiency) for what that number means in practice.

Zero runtime dependencies. Streams, so files larger than RAM are fine.

> **Attribution:** This project is a JavaScript port of the Base94 encoding algorithm
> originally developed by **The Crashpad Authors (Google / Chromium)**, found in
> `util/stream/base94_output_stream.{h,cc}`. The original C++ implementation is
> licensed under the Apache License 2.0.

> **AI assistent:** AI was supporting in building this.
---

## 🛑 Read This First: The Encoding Concept Guide

Before using this library, it is important to understand the concept of binary-to-text
encodings. **Do not blindly choose an encoding just because it has the highest
theoretical density.** The environment where your data lives dictates the tool you
should use:

### 1. The Best Encoding: No Encoding (Raw Binary)

If you can send or store raw bytes, do it. Encoding always wastes CPU cycles and
inflates data size.

* **Use case:** WebSockets (`ArrayBuffer`), HTTP POST with `application/octet-stream`,
  or writing `.bin` files to a disk.

### 2. Base64 (The Universal Standard)

Base64 uses only alphanumeric characters plus two safe symbols. While it inflates data
by ~33%, it is indestructible in fragile environments.

* **Use case:** Shell scripting (CLI pipelines), terminal output, or URL parameters
  (using the Base64URL variant). The characters will never trigger shell parsers or
  break URL routing.

### 3. Base85N (The Container Expert) — the common case

If your binary data needs to live inside a structured text container, you need an
alphabet that avoids syntax characters (`"`, `\`, `<`, `>`, `&`). If you use an alphabet
that contains them, the container will force you to escape them (e.g. `\"`), destroying
any density advantage — and one unlucky payload will break the document outright.

* **Solution:** Use my other project, **[Base85N](https://base85n.ghadami.de/)**
  (`npm install base85n`). Its alphabet contains none of the syntax characters of JSON,
  XML, or HTML, so the encoded size *is* the final size: zero escaping, and no payload
  can corrupt the surrounding document. A dynamic passthrough mode emits readable text
  almost verbatim instead of re-encoding it, so an ASCII payload comes out at **99.8%**
  efficiency where Base94Max manages 80.3%.
* **Use case:** JSON payloads, XML nodes, HTML attributes, YAML and TOML files, config
  files, database text columns. This covers most situations in which people reach for
  base64 — and Base85N beats base64 by five points on binary and by twenty-five on text.
* Measurements and a side-by-side comparison are in
  [The near neighbours](#the-near-neighbours-base85n-base91-numeric-base94-base122) below.

### 4. Base94Max (The Mathematical Extreme)

Base94Max uses every printable ASCII character from `!` to `~`. It will immediately
break JSON, XML, and CLI pipes.

**So why does it exist?** Base94Max was built by Google for *Crashpad* (C++ crash
reporting). When a low-level application segfaults, it has to push a raw memory dump
through pre-allocated, low-level OS pipes that only safely transport raw ASCII text.
In esoteric environments where raw binary is prohibited but you need maximum bit
density over a flat text channel (e.g. custom flat log files, raw sockets), Base94Max
is the practical limit.

**That is the whole niche, and it is a narrow one.** If the data can travel as raw bytes,
send raw bytes (§1). If it has to sit inside a container, use Base85N (§3) — inside JSON
the density advantage of Base94Max disappears, and on text it loses by twenty points.
Reach for Base94Max when a text-only protocol is imposed on you and there is no container
to be safe inside.

### 5. Beyond the Limit: Why stop at Base94? (The Base122 Question)

If you think in absolute extremes, you might ask: *Is 94 really the mathematical limit?
What about the space character? What about Base122?* Mathematically, you could use more
characters, but the trade-off is severe data fragility:

* **The Space character & Newlines (`\n`, `\r`):** Using these pushes you to Base97, but
  destroys your data. Network layers trim trailing spaces, and OS conversions silently
  change `\n` to `\r\n`. Your byte sequence shifts, and the payload is permanently
  corrupted.
* **Base122 (The UTF-8 Extreme):** Base122 uses almost all 128 ASCII characters to
  achieve incredible density (~14% overhead), utilizing UTF-8 multi-byte tricks to
  escape toxic characters. *The trade-off:* Base122 relies heavily on **unprintable
  control characters** (ASCII 0–31). If you open a Base122 string in a terminal or
  editor, you see garbled text, ringing bells, and corrupted layouts. It makes
  debugging a nightmare.

**Conclusion:** Base94Max represents the best density available for a continuous,
unbroken text stream while keeping the output 100% printable for debugging.

---

## Installation

```bash
npm install base94max
```

Requires Node.js 18.11 or newer. The package is ESM-only.
The core module has no dependencies and runs unchanged in browsers, Deno, and Bun;
only the optional `base94max/stream` entry point requires Node.

## Usage

### Binary data

```js
import { encode, decode } from 'base94max';

const binaryData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"

const encoded = encode(binaryData);
console.log(encoded);
// E/6*rl!

const decodedBytes = decode(encoded);
console.log(decodedBytes);
// Uint8Array(5) [ 72, 101, 108, 108, 111 ]
```

### Unicode text

```js
import { encodeText, decodeText } from 'base94max';

const text = 'Base94Max is efficient! 😊';

const encoded = encodeText(text);
console.log(encoded);
// W{D\S4{D;)+7W3*R;U80pBf/F*j7oxZ.5("

console.log(decodeText(encoded));
// Base94Max is efficient! 😊
```

`decode` and `decodeText` ignore whitespace in their input, so line-wrapped or
newline-terminated payloads decode without preprocessing.

### Streaming (large files)

Memory use stays constant regardless of input size — the entire codec state is a
single bit buffer.

```js
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createEncodeStream } from 'base94max/stream';

await pipeline(
    createReadStream('dump.bin'),
    createEncodeStream({ wrap: 100 }), // wrap: 0 (default) emits one long line
    createWriteStream('dump.b94')
);
```

Decoding is symmetric with `createDecodeStream()`.

For non-Node runtimes, the same incremental codec is available directly:

```js
import { createEncoder } from 'base94max';

const encoder = createEncoder();
let out = '';
for await (const chunk of source) out += encoder.push(chunk); // chunk: Uint8Array
out += encoder.end();
```

Chunk boundaries never affect the result: streamed output is byte-identical to a
single `encode()` call over the same data.

### Compression + encoding (best practice)

Base94Max is a pure transcoder. To reduce the size of large payloads, compress before
encoding. Compression is left to your application to keep this library
dependency-free.

```js
import { encode } from 'base94max';

async function compressAndEncode(text) {
    const stream = new Blob([text]).stream()
        .pipeThrough(new CompressionStream('gzip'));
    const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
    return encode(compressed);
}
```

> ⚠️ Do not pre-compress very short payloads (under ~100 bytes) with gzip — the header
> overhead will increase the total size. For tiny payloads, encode them directly.

## Command line

```bash
base94 < photo.jpg > photo.b94          # encode
base94 --decode < photo.b94 > photo.jpg # decode
gzip -9 < dump.bin | base94 --wrap 100 > dump.b94
```

| Option | Description |
| --- | --- |
| `-d`, `--decode` | Decode instead of encode |
| `-w`, `--wrap <n>` | Wrap encoded output every `n` characters (0 = off) |
| `-h`, `--help` | Show help |
| `-V`, `--version` | Show version |

Input is always treated as raw bytes. Output is written verbatim, with no trailing
newline, and the tool streams — encoding a file larger than available RAM works.

## API

| Function | Description |
| --- | --- |
| `encode(bytes: Uint8Array): string` | Encode binary data. |
| `decode(text: string): Uint8Array` | Decode; whitespace in the input is ignored. |
| `encodeText(text: string): string` | Encode a UTF-8 string. |
| `decodeText(text: string): string` | Decode to a UTF-8 string; throws on invalid UTF-8. |
| `createEncoder(): { push, end }` | Incremental encoder for chunked input. |
| `createDecoder(): { push, end }` | Incremental decoder for chunked input. |
| `withAlphabet(alphabet: string)` | Bind the whole API to a custom 94-character alphabet. |
| `PRINTABLE_ALPHABET: string` | The default alphabet, `!` through `~`. |

From `base94max/stream` (Node only): `createEncodeStream({ wrap?, alphabet? })` and
`createDecodeStream({ alphabet? })`, both `Transform` streams.

All functions throw on invalid input rather than returning partial results. A
`Uint8Array` returned from `createDecoder().push()` is only valid until the next
`push()` — copy it if you need to keep it.

### Custom alphabets

`withAlphabet()` accepts 94 unique characters in the range `0x20`–`0x7F`. Characters
below `0x20` are rejected outright: control characters corrupt the text channels this
encoding exists to survive. If the alphabet contains no whitespace, the decoder
automatically skips whitespace in its input.

## Efficiency

Efficiency is the ratio of input bytes to output characters. Higher is better.

The theoretical ceiling for any fixed-rate encoding into 94 characters is
**log₂(94)/8 ≈ 81.93%**. Base94Max exceeds that on redundant input because the
adaptive 13/14-bit scheme is data-dependent, and it therefore compresses slightly as a
side effect. Measured over 1 MiB inputs:

| Input | Base94Max | Base64 |
| --- | --- | --- |
| Random bytes | 81.74% | 75% |
| gzip output | 81.29% | 75% |
| ASCII text | 81.82% | 75% |
| All `0xFF` | 81.25% | 75% |
| All zero bytes | 87.50% | 75% |

In short: expect **~81.3–81.8% on real payloads**, with the 87.5% figure reachable only
on highly redundant input — which you should be compressing instead. Payloads under
~256 bytes score lower still (16 bytes → 80.0%).

### Throughput

8 MiB of random data, Node 22:

| Operation | Base94Max | Base64 (native) |
| --- | --- | --- |
| encode | ~117 MB/s | ~118 MB/s |
| decode | ~79 MB/s | ~1900 MB/s |

### Comparison with other encodings

| Encoding | Alphabet | Efficiency | Algorithm | Notes |
| --- | --- | --- | --- | --- |
| Base64 | 64 | 75% | Fixed, 6 bits → 1 char | Ubiquitous; `A–Z a–z 0–9 + /` |
| Base85 (z85) | 85 | 80% | Fixed block, 4 bytes → 5 chars | Avoids `` \ ` `` `'` `"` `,` `;` |
| Base85 (Ascii85) | 85 | 80% | Fixed block, 4 bytes → 5 chars | Different set, includes punctuation |
| **[Base85N](https://base85n.ghadami.de/)** | 85 | 80.00% binary, up to 99.8% text | Fixed block + passthrough | **No escaping in any container**; see below |
| Base91 (basE91) | 91 | 81.32% | Adaptive, 13/14 bits → 2 chars | Same algorithm; omits `` \ `` `'` `-` |
| Base94 (numeric) | 94 | 81.93% | Numeric via BigInt | Optimal rate, but O(n²) and not streamable |
| **Base94Max** | 94 | **81.75%** (up to 87.5%) | Adaptive, 13/14 bits → 2 chars | Data-dependent; streams in constant memory |
| Base122 | 122 (UTF-8) | 87.50% | Fixed, 7 bits → 1 byte | Not ASCII; contains control characters |

Base94Max trades a fraction of a percent against the BigInt approach in exchange for
linear time, constant memory, and streamability.

## The near neighbours: Base85N, basE91, numeric Base94, Base122

The comparison table above is easy to misread as a ranking. It is not. Every encoding
listed beats Base94Max on some axis, and for most real tasks one of them is the better
choice. This section says which, and why.

The short version, in the order you should work through it:

1. **Can you send raw bytes?** Then send raw bytes. Any encoding is a loss.
2. **Does the output go into a container — JSON, XML, HTML, YAML, a config file?**
   Then use **[Base85N](https://base85n.ghadami.de/)**. Nothing else on this list is
   container-safe, and on text-like payloads it is not close.
3. **Is the channel flat text with no container at all** — a raw socket, a preallocated
   pipe, a fixed-format log line? Only then is Base94Max the right tool, and basE91 is
   a defensible alternative even there.

Base94Max exists for step 3. That is a narrow niche, and this README would rather send
you elsewhere than have you use it in the wrong place.

All figures below were measured, not quoted from documentation. Raw binary is 512 KiB
of `/dev/urandom`; the text corpora are repeated natural-language and JSON payloads.

### Base85N — the right answer whenever there is a container

[Base85N](https://base85n.ghadami.de/) is the only encoding on this page designed for
the case most people actually have: binary data that has to sit inside a structured text
document. Its 85-character alphabet contains **none** of the characters that any common
container treats as syntax:

| Container | Syntax characters | Present in the Base85N alphabet? |
| --- | --- | --- |
| JSON | `"` `\` | none |
| XML | `<` `>` `&` | none |
| HTML attributes | `'` `"` | none |

So the encoded size is the final size. Nothing gets escaped, nothing doubles, and no
payload can break the document it is embedded in. Base94Max cannot make that promise:
its alphabet is *every* printable character, which means it contains all of the above.

Base85N also has a dynamic passthrough mode. Where the input is already readable text,
it is emitted almost verbatim rather than re-encoded. That turns the usual density
argument upside down. Measured as the bytes that actually end up inside a JSON string:

| Payload | Base85N | Base94Max | basE91 | Base64 |
| --- | --- | --- | --- | --- |
| Random binary | 80.00% | 80.19% | 80.64% | 75.00% |
| gzip output | 80.16% | 81.16% | 81.21% | 75.00% |
| UTF-8 prose | **89.29%** | 81.97% | 80.65% | 75.00% |
| ASCII prose | **99.76%** | 80.28% | 80.28% | 75.00% |
| A JSON document | **99.75%** | 80.32% | 81.23% | 75.00% |

On incompressible binary the four ASCII schemes land within half a point of each other —
Base94Max and basE91 are marginally ahead, and that margin is the honest extent of their
advantage. On anything text-shaped, Base85N wins by twenty points, because it stops
encoding and starts passing through:

```text
Input:  Sehr geehrte Damen und Herren, anbei die Unterlagen.
Output: %nU%}Sehr~geehrte~Damen~und~Herren^~anbei~die~Unterlagen.
```

2 KB of prose comes out as 2130 characters. The same 2 KB of random binary comes out as
2560. Mixed payloads — a document with an embedded thumbnail, a config file with a key
blob — get the best of both automatically.

**Choose Base85N when:** the output lands in JSON, XML, HTML, YAML, TOML, a database
text column, or any format with syntax characters. Which is most of the time.

**It is dependency-free and MIT-licensed:** `npm install base85n` —
[base85n.ghadami.de](https://base85n.ghadami.de/)

### basE91 — the one you should probably use instead

basE91 (Joachim Henke, 2005) is not a distant relative. It is the *same algorithm*:
two symbols carry 13 or 14 bits, chosen adaptively from the value of the low 13 bits.
Base94Max is basE91 with three more characters in the alphabet and a marginally tighter
final block. If you understand one, you understand the other.

The difference is which characters are left out. basE91 omits three of the 94 printable
ASCII characters:

| Omitted | Why it matters |
| --- | --- |
| `\` (0x5C) | No backslash escaping in JSON, C, or shell double quotes |
| `'` (0x27) | Safe inside shell and SQL single-quoted strings |
| `-` (0x2D) | Never mistaken for a CLI option or a range separator |

Three fewer characters cost almost nothing in density:

| Input | Base94Max | basE91 |
| --- | --- | --- |
| Random bytes | 81.75% | 81.32% |
| gzip output | 81.28% | 81.28% |
| ASCII text | 81.82% | 81.43% |
| All zero bytes | 87.50% | 87.50% |

At most 0.43 percentage points, and on compressed input — the case this library
recommends — the two are identical to the digit. **Do not choose Base94Max over basE91
for density.** There is no density to gain.

Worse, the ranking inverts as soon as the output has to live anywhere real. Encoding
1 MiB of random data and placing it in a JSON string:

| Encoding | Raw | Inside a JSON string | Cost of escaping |
| --- | --- | --- | --- |
| Base94Max | 81.74% | 80.18% | −1.56 pp |
| basE91 | 81.32% | **80.65%** | −0.67 pp |
| Base64 | 75.00% | 75.00% | −0.00 pp |

basE91 loses less because only `"` needs escaping, where Base94Max pays for `"` and `\`.
The denser encoding ends up smaller on paper and larger in the file. (Both are still
worse than a purpose-built container encoding — this is the argument for
[Base85N](https://base85n.ghadami.de/) from §3, which needs no escaping at all.)

**Choose basE91 when:** you want a dense text encoding with mature implementations in
most languages, a spec that has not moved since 2005, and an alphabet that survives
shell single quotes and costs less inside JSON.

**Choose Base94Max when:** you need byte compatibility with Crashpad's output, or the
channel is genuinely flat — a raw socket, a preallocated pipe, a fixed-format log line —
with no container, no shell, and no escaping anywhere. That is the whole niche.

### Numeric Base94 — optimal, and unusable above a few kilobytes

Treat the entire input as one large integer and repeatedly divide by 94. This reaches
the true information-theoretic rate for a 94-character alphabet, log₂(94)/8 ≈ **81.93%**,
which no block-based scheme can match. It is about 0.2 points denser than Base94Max on
random data.

That is the entire upside. The costs:

**Quadratic time.** Each division pass touches the whole number, and you need one pass
per output character. Measured with JavaScript `BigInt`:

| Input | Time | Per doubling |
| --- | --- | --- |
| 4 KB | 19 ms | — |
| 8 KB | 80 ms | 4.11× |
| 16 KB | 274 ms | 3.44× |
| 32 KB | 960 ms | 3.50× |
| 64 KB | 3.5 s | 3.64× |
| 128 KB | 16.2 s | 4.63× |

Roughly 4× for every doubling, which is what O(n²) looks like. Base94Max encodes 128 KB
in about a millisecond. At 256 KB the numeric encoder took 90 seconds in the same
benchmark — over 40,000× slower.

**Not streamable, in principle.** The first output character depends on the last input
byte. You cannot start emitting before you have read everything, you cannot chunk it,
you cannot resume, and memory is proportional to the whole payload. This is not an
implementation gap; it follows from the definition.

**Whole-message avalanche.** Flip one character and every byte after it changes. A
block-based encoding corrupts a few bytes around the damage and usually raises a padding
error; the numeric form quietly returns a completely different message.

**Leading zeros vanish.** `0x00 0x01` and `0x01` are the same integer, so the format
needs a padding convention or a length prefix bolted on.

**Choose numeric Base94 when:** the payload is short and fixed-size — a 32-byte key, a
hash, a UUID, a database ID — where 0.2 points is worth having and *n* will never grow.
Never for files, streams, or anything user-supplied in length.

### Base122 — denser than ASCII can be, at the cost of being text

Base122 (Kevin Albertson, 2016) escapes the 94-character ceiling by not staying in ASCII.
It packs 7 bits into each output byte, using 122 of the 128 single-byte UTF-8 values.
The six it cannot use — null, newline, carriage return, `"`, `&`, `\` — are encoded as
two-byte UTF-8 sequences carrying a 3-bit index plus the following 7 bits of data.

Because a two-byte escape consumes 14 input bits for 2 output bytes, **every output byte
carries exactly 7 bits, whatever the input.** Efficiency is exactly 87.5%, data-
independent — no best case, no worst case. That is genuinely better than any
94-character alphabet can reach, and the reason is simple: it is not competing in the
same category.

What it gives up is being text in any useful sense. The output contains C0 control
characters, and that has consequences most people discover late:

- **JSON is out.** The specification requires U+0000–U+001F to be escaped inside strings.
  At six bytes per `\u00XX` escape, escaping them would cost far more than the 6.6 points
  Base122 gained.
- **XML is out entirely.** XML 1.0 forbids most C0 control characters in documents even
  when escaped — there is no legal representation.
- **Terminals interpret it.** The output contains bell, backspace, form feed and escape.
  Cat a Base122 file and your terminal will beep and reflow.
- **Copy-paste is lossy.** The author warns about this directly: control characters are
  not reliably preserved, so encoded data has to be written to files by script rather
  than pasted.
- **It must be UTF-8 end to end.** Any layer that assumes Latin-1, normalises line
  endings, or performs a charset conversion destroys the payload.
- **It fights compression.** The author notes it is not recommended for gzip-compressed
  pages — which is most of the web — because Base64 compresses better, cancelling the
  advantage.

**Choose Base122 when:** you are doing the thing it was designed for — inlining a binary
resource in an uncompressed HTML or JavaScript file served as UTF-8, decoded by a script
in the browser, never read by a human.

**Do not choose it when:** the output passes through a log, a diff, a terminal, a
structured document, or a person.

### Summary

| | Binary | Text | In JSON, binary | Container-safe | Streamable |
| --- | --- | --- | --- | --- | --- |
| Base64 | 75.00% | 75.00% | 75.00% | yes | yes |
| **[Base85N](https://base85n.ghadami.de/)** | 80.00% | **99.76%** | 80.00% | **yes, by design** | yes |
| basE91 | 81.32% | 81.43% | 80.64% | needs `"` escaped | yes |
| Base94Max | 81.75% | 81.82% | 80.19% | needs `"` and `\` escaped | yes |
| Numeric Base94 | 81.93% | 81.93% | ~80.4% | needs `"` and `\` escaped | **no** |
| Base122 | 87.50% | 87.50% | **impossible** | **no** | yes |

Read the binary column alone and Base94Max looks like a reasonable default. Read the
rest and it is a specialist: on text it is beaten by twenty points, in a container it
loses its lead entirely, and it can break any document it is embedded in. That is the
actual trade — and it is why §1 of this README says the best encoding is usually no
encoding at all, and §3 says that when you do need one inside a container, it should be
[Base85N](https://base85n.ghadami.de/).

## Algorithm

Two Base94 symbols carry 13 or 14 bits. A 14-bit block is used when its low 13 bits are
below 644 (= 94² − 2¹³); otherwise 13 bits are consumed. The decoder recovers the block
width from the symbol value, so no padding or length prefix is needed.

## Tests

```bash
npm install
npm test
```

## License

Apache License 2.0. See [LICENSE](LICENSE).

---

*Parts of this README were drafted with AI assistance and then verified against
measurements.*

## Rust

`rust/` holds a port of `index.js`, published as the crate `base94max`. It
exists so that Base94Max can be measured in one process alongside the
encodings it is compared against, in
[binary2textbench](https://github.com/keywan-ghadami/binary2textbench) —
comparing throughput across a language boundary would measure the languages.

```rust
let encoded = base94max::encode(b"Hello");
assert_eq!(base94max::decode(&encoded).unwrap(), b"Hello");
```

It implements the `PRINTABLE` alphabet only; the deprecated `JSON_DELETE`
variant is not ported.

What keeps it a port rather than a second implementation is
`testvectors/base94max.json`: `tools/gen-testvectors.js` writes it from
`index.js`, and the Rust test suite reads the same file and compares character
for character. CI regenerates the file and fails on a diff, so the two cannot
drift apart quietly.

```sh
node tools/gen-testvectors.js     # after any change to index.js
cd rust && cargo test --release
```
