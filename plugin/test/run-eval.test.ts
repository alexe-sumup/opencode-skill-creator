import { expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, readlinkSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

import {
  buildEvalWarnings,
  buildOpenCodeRunCommand,
  symlinkProjectOpenCodeConfig,
  type EvalResultItem,
} from "../lib/run-eval"

const baseResult = (overrides: Partial<EvalResultItem>): EvalResultItem => ({
  query: "query",
  should_trigger: true,
  trigger_rate: 0,
  triggers: 0,
  runs: 3,
  successful_runs: 3,
  errors: 0,
  pass: false,
  ...overrides,
})

test("buildOpenCodeRunCommand uses the build agent by default", () => {
  expect(buildOpenCodeRunCommand("Create a skill", {})).toEqual([
    "opencode",
    "run",
    "--format",
    "json",
    "--agent",
    "build",
    "Create a skill",
  ])
})

test("buildOpenCodeRunCommand accepts a custom agent and model", () => {
  expect(
    buildOpenCodeRunCommand("Create a skill", {
      agent: "custom-agent",
      model: "openai/gpt-5.5",
    }),
  ).toEqual([
    "opencode",
    "run",
    "--format",
    "json",
    "--agent",
    "custom-agent",
    "--model",
    "openai/gpt-5.5",
    "Create a skill",
  ])
})

test("buildEvalWarnings warns when all should-trigger results have zero triggers and no errors", () => {
  expect(
    buildEvalWarnings([
      baseResult({ query: "trigger one" }),
      baseResult({ query: "trigger two" }),
      baseResult({
        query: "negative",
        should_trigger: false,
        pass: true,
      }),
    ]),
  ).toEqual([
    "All should-trigger queries produced 0 triggers with no run errors. Check that trigger evals are using an agent that exposes skill tool events, such as the build agent.",
  ])
})

test("buildEvalWarnings returns no warnings when any should-trigger query triggers", () => {
  expect(
    buildEvalWarnings([
      baseResult({ query: "trigger one" }),
      baseResult({
        query: "trigger two",
        trigger_rate: 1,
        triggers: 3,
        pass: true,
      }),
    ]),
  ).toEqual([])
})

test("symlinkProjectOpenCodeConfig preserves config and excludes tested skill", () => {
  const projectRoot = mkdtempSync(join(tmpdir(), "skill-eval-project-"))
  const evalRoot = mkdtempSync(join(tmpdir(), "skill-eval-root-"))
  const sourceOpenCode = join(projectRoot, ".opencode")
  mkdirSync(join(sourceOpenCode, "skills", "tested-skill"), { recursive: true })
  mkdirSync(join(sourceOpenCode, "skills", "other-skill"), { recursive: true })
  writeFileSync(join(sourceOpenCode, "opencode.json"), "{}")

  symlinkProjectOpenCodeConfig(projectRoot, evalRoot, "tested-skill")

  expect(readlinkSync(join(evalRoot, ".opencode", "opencode.json"))).toBe(
    join(sourceOpenCode, "opencode.json"),
  )
  expect(readlinkSync(join(evalRoot, ".opencode", "skills", "other-skill"))).toBe(
    join(sourceOpenCode, "skills", "other-skill"),
  )
  expect(() => readlinkSync(join(evalRoot, ".opencode", "skills", "tested-skill"))).toThrow()
})
