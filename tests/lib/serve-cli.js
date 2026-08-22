/** `npm run serve` -- the same server the tests use, for looking by hand. */
import { startServer } from "./server.js";
const s = await startServer();
console.log(`serving ${s.origin}`);
