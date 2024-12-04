export type Result<T = undefined, E = string> =
  | { ok: true; value: T }
  | { ok: false; error?: E };
