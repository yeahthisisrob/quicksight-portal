# openapi-codegen

Owns the OpenAPI contract tooling, and exists for one reason: **it pins
TypeScript 5.9 while the rest of the repo runs TypeScript 7.**

`openapi-typescript` builds its output with the TypeScript compiler API
(`ts.factory`). TypeScript 7 does not expose that API: its package `exports`
map resolves `.` to `lib/version.cjs`, and the compiler surface moved behind
`./unstable/*`. Every tool written against the classic compiler API is in the
same position, and no published `openapi-typescript` supports TS 7 - the latest
(7.13.0) still declares `peerDependencies: { typescript: "^5.x" }`.

Keeping the generator in its own workspace package confines the old TypeScript
to the one place that needs it. Nothing imports from this package; it is only
ever run as a script, so its TypeScript never reaches application code.

Fold this back into `shared` once `openapi-typescript` supports TypeScript 7.

    just contract        # validate the schema, regenerate the types
