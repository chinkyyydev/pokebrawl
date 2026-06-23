// @solana/web3.js and @solana/spl-token expect Node's Buffer global, which
// doesn't exist in the browser. Must be its own module imported FIRST in
// main.tsx — assigning this inside main.tsx's own body runs too late (after
// its other imports, e.g. App -> coin.ts -> @solana/spl-token, already
// evaluated and threw "Buffer is not defined").
import { Buffer } from 'buffer';

window.Buffer = window.Buffer ?? Buffer;
