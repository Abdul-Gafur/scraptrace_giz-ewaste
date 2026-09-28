"""Pure domain rules mirrored from `packages/contracts`.

Nothing in this package performs I/O. Every vocabulary, permission and transition rule is a
faithful port of the TypeScript contract package and is checked against it by parity tests, so
the Python service cannot drift into a second, conflicting domain model.
"""
