import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir, writeFile, rename, open, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// 布局自适应：既支持"仓库根/backend + 仓库根/frontend"的合并树，
// 也支持把 backend/ 或 frontend/ 直接当作仓库根的独立仓库。
const notesPath = [
  "frontend/playground/src/data/releases.json", // 合并树
  "playground/src/data/releases.json", // 前端独立仓库
  "releases.json", // 后端独立仓库
].find((candidate) => existsSync(path.join(root, candidate)));
if (!notesPath) throw new Error("Release notes not found in any known layout");
const digest = (value) => createHash("sha256").update(value).digest("hex");
function versionParts(version) {
  assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, "Invalid semantic version");
  return version.split(".").map(BigInt);
}
function compare(a, b) {
  const x = versionParts(a),
    y = versionParts(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
}
function validDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function validateNotes(version, notes) {
  versionParts(version);
  assert.ok(Array.isArray(notes) && notes.length, "Missing release notes");
  assert.equal(notes[0].version, version, "VERSION must match the latest release notes");
  for (const [i, note] of notes.entries()) {
    versionParts(note.version);
    assert.ok(validDate(note.date), "Invalid release date");
    assert.ok(typeof note.title === "string" && note.title.trim(), "Missing release title");
    assert.ok(Array.isArray(note.changes) && note.changes.length, "Missing release changes");
    for (const change of note.changes) {
      assert.ok(["feature", "improvement", "fix"].includes(change.type), "Invalid change type");
      assert.ok(typeof change.text === "string" && change.text.trim(), "Empty changes");
    }
    assert.ok(Array.isArray(note.history), "Missing historical event list");
    let previous = note.date;
    for (const event of note.history) {
      assert.ok(validDate(event.date) && event.date <= previous, "Invalid history date order");
      assert.ok(typeof event.text === "string" && event.text.trim(), "Empty historical event");
      previous = event.date;
    }
    if (i) {
      assert.ok(compare(notes[i - 1].version, note.version) > 0, "Release order/duplicate version");
      assert.ok(notes[i - 1].date >= note.date, "Invalid release date order");
    }
  }
}
export function assertRelease(version, notes, state, fingerprint) {
  validateNotes(version, notes);
  assert.ok(state && state.releases && typeof state.releases === "object", "Missing release state");
  const order = compare(version, state.lastPublished);
  assert.ok(order >= 0, "Release version cannot move backwards");
  if (order === 0)
    assert.equal(
      state.releases[version]?.fingerprint,
      fingerprint,
      "Source changed or legacy release: increase version and add release notes",
    );
  for (const [published, saved] of Object.entries(state.releases)) {
    if (saved.notesHash) {
      const note = notes.find((item) => item.version === published);
      assert.ok(note, "Published release notes cannot be removed: " + published);
      assert.equal(
        saved.notesHash,
        digest(JSON.stringify(note)),
        "Published release notes are immutable: " + published,
      );
    }
  }
}
const excluded = new Set([
  "node_modules",
  "dist",
  ".release-dist",
  ".git",
  ".turbo",
  ".cache",
  ".pnpm-store",
  "coverage",
  "playwright-report",
  "test-results",
  ".output",
  ".vite",
  ".tmp",
  ".e2e",
  "tmp",
  "%SystemDrive%",
]);
export async function sourceFingerprint(directory = root) {
  const files = [];
  async function walk(relative) {
    for (const entry of await readdir(path.join(directory, relative), { withFileTypes: true })) {
      if (excluded.has(entry.name)) continue;
      const p = path.join(relative, entry.name);
      if (entry.isDirectory()) await walk(p);
      else if (entry.isFile()) files.push(p);
      else throw Error("Unsupported source entry: " + p);
    }
  }
  for (const dir of [
    // 合并树
    "backend/cmd",
    "backend/internal",
    "backend/configs",
    "backend/deploy",
    "backend/migrations",
    "backend/sql",
    // 后端独立仓库
    "cmd",
    "internal",
    "configs",
    "deploy",
    "migrations",
    "sql",
    // 前端独立仓库
    "playground",
    "packages",
    "apps",
    // 三处布局都有
    "scripts",
    "frontend",
  ])
    if (existsSync(path.join(directory, dir))) await walk(dir);
  for (const name of [
    "VERSION",
    "backend/go.mod",
    "backend/go.sum",
    "backend/build-backend-release.ps1",
    "go.mod",
    "go.sum",
    "build-backend-release.ps1",
  ])
    if (existsSync(path.join(directory, name))) files.push(name);
  const hash = createHash("sha256");
  for (const file of files.map((file) => file.replaceAll("\\", "/")).sort()) {
    hash.update(file + "\0");
    hash.update(await readFile(path.join(directory, file)));
    hash.update("\0");
  }
  return hash.digest("hex");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, requested, candidatePath] = process.argv.slice(2);
  assert.ok(
    ["check", "record", "notes"].includes(command),
    "Usage: node scripts/release-policy.mjs check|record|notes VERSION [CANDIDATE_FILE]",
  );
  const version = (await readFile(path.join(root, "VERSION"), "utf8")).trim();
  assert.equal(requested, version, "Requested version must match VERSION");
  const notes = JSON.parse(await readFile(path.join(root, notesPath), "utf8"));
  validateNotes(version, notes);
  if (command !== "notes") {
    const statePath = path.join(root, "release-state.json");
    const state = JSON.parse(await readFile(statePath, "utf8"));
    const fingerprint = await sourceFingerprint();
    assertRelease(version, notes, state, fingerprint);
    if (command === "check" && candidatePath)
      await writeFile(candidatePath, JSON.stringify({ version, fingerprint }, null, 2) + "\n");
    if (command === "record") {
      assert.ok(candidatePath, "Missing pre-build candidate");
      const candidate = JSON.parse(await readFile(candidatePath, "utf8"));
      assert.equal(candidate.version, version, "Version changed during build");
      assert.equal(
        candidate.fingerprint,
        fingerprint,
        "Source changed during build: rebuild before publishing",
      );
      const lock = await open(statePath + ".lock", "wx");
      try {
        const current = JSON.parse(await readFile(statePath, "utf8"));
        assertRelease(version, notes, current, fingerprint);
        Object.assign(state, current);
        // Preserve each published note, not only the latest, against later rewriting.
        for (const note of notes)
          state.releases[note.version] = {
            ...state.releases[note.version],
            notesHash: digest(JSON.stringify(note)),
          };
        state.releases[version] = { ...state.releases[version], fingerprint };
        state.lastPublished = version;
        const temp = statePath + "." + randomUUID() + ".tmp";
        await writeFile(temp, JSON.stringify(state, null, 2) + "\n");
        await rename(temp, statePath);
      } finally {
        await lock.close();
        await unlink(statePath + ".lock");
      }
    }
    console.log("RELEASE_POLICY_PASS " + version + " " + fingerprint);
  } else console.log("RELEASE_NOTES_PASS " + version);
}
