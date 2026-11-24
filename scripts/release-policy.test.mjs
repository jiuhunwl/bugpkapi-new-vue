import assert from "node:assert/strict";
import { test } from "node:test";
import { assertRelease, validateNotes } from "./release-policy.mjs";
const notes = (version = "1.2.16") => [
  {
    version,
    date: "2026-10-03",
    title: "Update",
    changes: [{ type: "feature", text: "Release timeline" }],
    history: [],
  },
];
const previous = { lastPublished: "1.2.15", releases: {} };
test("requires current version, valid dates and non-empty release notes", () => {
  assert.doesNotThrow(() => validateNotes("1.2.16", notes()));
  assert.throws(() => validateNotes("1.2.17", notes()), /VERSION/);
  assert.throws(() => validateNotes("1.2.16", [{ ...notes()[0], date: "2026-02-30" }]), /date/);
  assert.throws(() => validateNotes("1.2.16", [{ ...notes()[0], changes: [] }]), /changes/);
  assert.throws(() => validateNotes("1.2.16", [...notes(), ...notes()]), /order|duplicate/);
});
test("new release must increase numeric semantic version", () => {
  assert.doesNotThrow(() => assertRelease("1.2.16", notes(), previous, "source-a"));
  assert.throws(() => assertRelease("1.2.15", notes("1.2.15"), previous, "source-a"), /version/i);
  assert.throws(() => assertRelease("1.2.9", notes("1.2.9"), previous, "source-a"), /version/i);
  assert.doesNotThrow(() => assertRelease("1.2.100", notes("1.2.100"), previous, "source-a"));
});
test("identical multi-platform rebuild allowed, changed source rejected", () => {
  const state = { lastPublished: "1.2.16", releases: { "1.2.16": { fingerprint: "source-a" } } };
  assert.doesNotThrow(() => assertRelease("1.2.16", notes(), state, "source-a"));
  assert.throws(() => assertRelease("1.2.16", notes(), state, "source-b"), /version/i);
});
test("source snapshot CLI permits rebuilds but rejects edited source and build-time changes", async () => {
  const { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } = await import("node:fs/promises");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const { spawnSync } = await import("node:child_process");
  const workspace = fileURLToPath(new URL("../", import.meta.url));
  const tempRoot = path.resolve(workspace, ".tmp");
  await mkdir(tempRoot, { recursive: true });
  const fixture = await mkdtemp(path.join(tempRoot, "release-policy-test-"));
  const put = async (name, content) => {
    await mkdir(path.dirname(path.join(fixture, name)), { recursive: true });
    await writeFile(path.join(fixture, name), content);
  };
  const call = (...args) =>
    spawnSync(process.execPath, [path.join(fixture, "scripts/release-policy.mjs"), ...args], {
      cwd: fixture,
      encoding: "utf8",
      windowsHide: true,
    });
  try {
    for (const dir of [
      "backend/cmd",
      "backend/internal",
      "backend/configs",
      "backend/deploy",
      "backend/migrations",
      "scripts",
      "frontend/playground/src/data",
    ])
      await mkdir(path.join(fixture, dir), { recursive: true });
    await copyFile(
      new URL("./release-policy.mjs", import.meta.url),
      path.join(fixture, "scripts/release-policy.mjs"),
    );
    await put("VERSION", "1.2.16\n");
    await put("backend/go.mod", "module test");
    await put("backend/go.sum", "");
    await put("backend/build-backend-release.ps1", "# fixture");
    await put("release-state.json", JSON.stringify(previous));
    await put("frontend/playground/src/data/releases.json", JSON.stringify(notes()));
    const candidate = path.join(fixture, "candidate.json");
    let result = call("check", "1.2.16", candidate);
    assert.equal(result.status, 0, result.stderr);
    result = call("record", "1.2.16", candidate);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      JSON.parse(await readFile(path.join(fixture, "release-state.json"), "utf8")).lastPublished,
      "1.2.16",
    );
    result = call("check", "1.2.16");
    assert.equal(result.status, 0, result.stderr);
    await put("backend/internal/changed.go", "package changed");
    assert.notEqual(call("check", "1.2.16").status, 0);
    await put("VERSION", "1.2.17\n");
    await put(
      "frontend/playground/src/data/releases.json",
      JSON.stringify([...notes("1.2.17"), ...notes()]),
    );
    result = call("check", "1.2.17", candidate);
    assert.equal(result.status, 0, result.stderr);
    await put("backend/internal/changed.go", "package changed_again");
    result = call("record", "1.2.17", candidate);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Source changed during build/);
    assert.equal(
      JSON.parse(await readFile(path.join(fixture, "release-state.json"), "utf8")).lastPublished,
      "1.2.16",
    );
  } finally {
    assert.ok(path.resolve(fixture).startsWith(tempRoot + path.sep + "release-policy-test-"));
    await rm(fixture, { recursive: true, force: true });
  }
});
