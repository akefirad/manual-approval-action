import type { Effect } from "effect/Effect";

export type Result<T = void, E = never> = Effect<T, E, never>;
