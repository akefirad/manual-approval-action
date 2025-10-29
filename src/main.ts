import * as E from "effect/Effect";
import { main } from "./program.js";

E.runPromise(main).then(console.log);
