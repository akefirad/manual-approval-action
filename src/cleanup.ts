import * as E from "effect/Effect";
import { cleanup } from "./program.js";

E.runPromise(cleanup).then(console.log);
