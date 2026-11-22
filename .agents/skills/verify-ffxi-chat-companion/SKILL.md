---
name: verify-ffxi-chat-companion
description: Verify Kupobot viewer commands and safe AI-offline replies with the FFXI Chat Companion CLI demo and offline Campfire HTML, and validate the synthetic status fixture. Use after changing routing, reply text, transcript playback, or the status contract.
---

# Verify FFXI Chat Companion

The deployed surface is YouTube Live chat. This offline rehearsal drives the production router through the repo's demo harness with built-in fixture status. The same fixture backs the local Campfire HTML replay. It does not verify YouTube authentication, message delivery, live AI, the game agent, or a deployment.

## Launch

Use Bash, Git, Node.js 20+, npm, and Linux `unshare` for the network-isolated proof. No dependency installation, credentials, server, port, or data seed is needed. Run all the following blocks in the same shell from the checkout to verify. Pick an existing **private** directory outside the source and temporary checkout as `EVIDENCE_PARENT`. This rehearsal intentionally fails if network isolation is unavailable; do not substitute a live service command.

```bash
set -eu
umask 077
src="$(git rev-parse --show-toplevel)"
rev="$(git -C "$src" rev-parse HEAD)"
tree="$(git -C "$src" rev-parse 'HEAD^{tree}')"
test -z "$(git -C "$src" status --porcelain)"
: "${EVIDENCE_PARENT:?Set EVIDENCE_PARENT to an existing private directory}"
proof_parent="$(cd "$EVIDENCE_PARENT" && pwd -P)"
case "$proof_parent/" in "$src/"*) exit 1 ;; esac
proof="$(mktemp -d "$proof_parent/ffxi-proof.XXXXXXXX")"
scratch="$(mktemp -d)"
cleanup() { rm -rf -- "$scratch"; }
trap cleanup EXIT
printf 'revision=%s\ntree=%s\n' "$rev" "$tree" >"$proof/revision.txt"
printf 'Evidence: %s\n' "$proof"
git -C "$src" archive --output="$scratch/source.tar" "$rev"
mkdir "$scratch/repo" "$scratch/home"
tar -xf "$scratch/source.tar" -C "$scratch/repo"
cd "$scratch/repo"
```

No long-lived service is started. The demo is usable when it returns paired viewer/bot output; completion and content checks are in Drive. The browser journey and hosted evidence are in [Campfire playback](features/campfire.md).

## Doctor

Confirm the archived package, runtime version, and a fresh network namespace. Use an empty home and pass no checkout credentials. Record the new namespace and verify that loopback is its only device and that there is no IPv4 route or IPv6 address.

```bash
isolated() {
  unshare --user --map-root-user --net -- \
    env -i PATH="$PATH" HOME="$scratch/home" npm_config_update_notifier=false "$@"
}
{
  isolated node -e 'if (+process.versions.node.split(".")[0] < 20 || require("./package.json").name !== "ffxi-chat-companion") process.exit(1); console.log(process.version)'
  isolated npm --version
  isolated node -e 'const fs=require("node:fs"); const ns=fs.readlinkSync("/proc/self/ns/net"); const devices=fs.readFileSync("/proc/net/dev","utf8").trim().split("\n").slice(2).map(line=>line.split(":")[0].trim()); const route=fs.readFileSync("/proc/net/route","utf8").trim().split("\n").slice(1); const ipv6=fs.readFileSync("/proc/net/if_inet6","utf8").trim(); if (ns===process.argv[1] || devices.join()!=="lo" || route.length || ipv6) process.exit(1); console.log(ns, "loopback only; no IPv4 routes or IPv6 addresses")' "$(readlink /proc/self/ns/net)"
} >"$proof/doctor.txt" 2>&1
```

## Drive

Select a journey from the [feature map](features/README.md). All four viewer journeys share one command because the harness routes a fixed batch of viewer messages through `buildRouter`. Keep the exact synthetic inputs beside their resulting replies. This block also runs the separate, read-only example status check.

```bash
capture() {
  label="$1"
  shift
  rc=0
  isolated "$@" >"$proof/$label.stdout" 2>"$proof/$label.stderr" || rc=$?
  printf '%s\n' "$rc" >"$proof/$label.exit"
  return "$rc"
}
capture demo npm run demo
capture campfire node scripts/demo.mjs --html
capture status npm run status:validate -- runtime/status-v1.example.json
capture assertions node --input-type=module - "$proof" <<'NODE'
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const dir = process.argv[2];
const lines = readFileSync(dir + "/demo.stdout", "utf8").split("\n")
  .filter(line => /^(viewer|bot)> /.test(line));
assert.equal(lines.length, 12);
const check = (index, input, expectedReply) => {
  assert.equal(lines[index * 2], "viewer> " + input);
  assert.match(lines[index * 2 + 1], expectedReply);
};
check(0, "!help", /^bot> .*Commands: !status, !zone, !why, !project, !help\. Mention @Kupobot /);
check(1, "!status", /^bot> Objective: Safely test the chat companion\. Current state: healthy; observing a nearby Huge Hornet\.$/);
check(2, "!zone", /^bot> Current zone: South Gustaberg \(ID 107\)\.$/);
check(3, "!why", /^bot> Why: the target passed the bounded safety checks$/);
check(4, "!project", /^bot> .*https:\/\/github\.com\/pablodcruz\/ffxi-agents-server .*https:\/\/github\.com\/pablodcruz\/ffxi-chat-companion$/);
check(5, "@Kupobot How does reactive combat work?", /^bot> AI questions are offline right now, kupo! Try !help/);
const html = readFileSync(dir + "/campfire.stdout", "utf8");
assert.match(html, /<title>Campfire Transcript \| Kupobot<\/title>/);
const messages = Array.from(html.matchAll(/<p class="message">([^<]*)<\/p>/g), ([, body]) =>
  body.replace(/&(?:amp|lt|gt|quot|#39);/g, entity =>
    ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" })[entity]));
assert.deepEqual(messages, lines.map(line => line.replace(/^(viewer|bot)> /, "")));
const output = readFileSync(dir + "/status.stdout", "utf8");
const snapshot = JSON.parse(output.slice(output.indexOf("{")));
assert.equal(snapshot.valid, true);
assert.equal(snapshot.schema_version, 1);
assert.equal(snapshot.health_status, "healthy");
console.log("all six offline input/reply pairs, plain/HTML parity and example status passed");
NODE
```

## Evidence

Keep the source commit/tree, doctor output, stdout, stderr, and exit codes in the printed `ffxi-proof.*` directory. Keep both plain transcript and generated Campfire HTML. Parity is a fixture-content check, not a browser or rendering pass. For browser claims retain the exact checkout and job step or local browser output, not only a passing workflow badge. Outputs contain fixture data only. A namespace without configured interfaces plus a stripped environment keeps this run away from YouTube and AI; the demo itself is not a credentialed `npm start` or `youtube:doctor` run. No remote writes or service state are expected.

## Cleanup

```bash
cd "$src"
cleanup
trap - EXIT
test ! -e "$scratch"
test -s "$proof/revision.txt"
test -s "$proof/demo.stdout"
test -s "$proof/campfire.stdout"
test -s "$proof/assertions.stdout"
printf 'Evidence retained: %s\n' "$proof"
```

On failure the exit trap deletes only the temporary checkout; keep the proof directory. `/maintain-verification-skill` is the upstream workflow for refreshing a stale feature map. It does not schedule this rehearsal.
