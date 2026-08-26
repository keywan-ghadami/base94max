//! The port against the encoder it is a port of.
//!
//! `testvectors/base94max.json` is written by `tools/gen-testvectors.js` from
//! the JavaScript implementation in the repository root. Comparing against it
//! is what makes this a port rather than a second implementation that happens
//! to agree on the cases someone thought of.
//!
//! Regenerate with `node tools/gen-testvectors.js` after any change to
//! `index.js`; a diff in this file is a wire-format change and should be
//! treated as one.

use serde::Deserialize;

#[derive(Deserialize)]
struct Vectors {
    cases: Vec<Case>,
}

#[derive(Deserialize)]
struct Case {
    name: String,
    /// The input, hex-encoded so the file stays readable and diffable.
    input: String,
    encoded: String,
}

fn unhex(s: &str) -> Vec<u8> {
    assert!(s.len() % 2 == 0, "hex string of odd length");
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).expect("hex digit"))
        .collect()
}

fn vectors() -> Vectors {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/testvectors/base94max.json");
    let text = std::fs::read_to_string(path)
        .unwrap_or_else(|e| panic!("{path}: {e} -- run `node tools/gen-testvectors.js`"));
    serde_json::from_str(&text).expect("test vector file is JSON")
}

#[test]
fn encodes_exactly_as_the_javascript_does() {
    let v = vectors();
    assert!(v.cases.len() > 100, "vector file looks truncated");
    for case in &v.cases {
        let input = unhex(&case.input);
        assert_eq!(base94max::encode(&input), case.encoded, "encoding {}", case.name);
    }
}

#[test]
fn decodes_what_the_javascript_encoded() {
    for case in &vectors().cases {
        let input = unhex(&case.input);
        assert_eq!(
            base94max::decode(&case.encoded).unwrap(),
            input,
            "decoding {}",
            case.name
        );
    }
}
