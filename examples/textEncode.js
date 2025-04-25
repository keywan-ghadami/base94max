import Base94Max from '../index.js';
const binaryData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"

    const encoded = Base94Max.encodeText("Hello");
    console.log(`Encoded "Hello": ${encoded}`);
