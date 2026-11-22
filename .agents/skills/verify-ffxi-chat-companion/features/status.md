# Status producer preflight

## Sub-features

Check the versioned sanitized snapshot with the operator CLI.

## How to get to it (user POV)

From a checkout, run the repository's `status:validate` command with the bundled example.

## Driving it with the offline verifier

Run Drive. The validator should exit 0 and report `valid: true`, `schema_version: 1`, and `health_status: healthy`.

## Gotchas

The bundled example is public synthetic data. It does not prove the producer can refresh a live snapshot or that a live consumer can read it. Do not swap in a real snapshot for this proof.
