import { z } from 'zod';

// zod probes for eval support the first time a schema is built. The strict Content-Security-
// Policy forbids eval (and the app never needs zod's optimisation), so switch it off here.
// Every file imports `z` from this module instead of 'zod', which guarantees this line runs
// before the first schema is created, whatever order the bundler evaluates chunks in.
z.config({ jitless: true });

export { z };
