import { expect, test } from "bun:test";
import type { AgentBrain } from "../src/api/types";
import { mineModelInput, mineModels, mineStatus } from "../src/lib/right-hand";

/** "Sua IA" (ADR 0137 §11): the one status the web's side panel and the phone's profile draw. */

const view = (over: Partial<AgentBrain>) =>
  ({ brain: "model", account: null, accounts: [], ...over }) as unknown as AgentBrain;
const ws = (ai: NonNullable<AgentBrain["workspaceAi"]>) => view({ workspaceAi: ai });

test("a plan of mine, or one lent to me, answers me: its account, and whose it is when it isn't mine", () => {
  const accounts = [{ id: "a1", label: "Claude Max", ownerId: "u-ana" }] as AgentBrain["accounts"];
  expect(mineStatus(view({ brain: "claude_code", account: "a1", accounts }), "u-me", false)).toEqual({
    kind: "own",
    brain: "claude_code",
    label: "Claude Max",
    ownerId: "u-ana",
  });
  expect(mineStatus(view({ brain: "claude_code", account: "a1", accounts }), "u-ana", false)).toEqual({
    kind: "own",
    brain: "claude_code",
    label: "Claude Max",
    ownerId: undefined,
  });
});

test("without a plan of mine: the workspace's key, this server's own where it has none, or its plan if it serves me", () => {
  const key = { provider: "anthropic", label: "Claude" };
  expect(mineStatus(ws({ brain: "model", ownerId: null, servesYou: true, key }), "u-me", false)).toEqual({
    kind: "key",
    label: "Claude",
    provider: "anthropic",
  });
  expect(mineStatus(ws({ brain: "model", ownerId: null, servesYou: true, key: null }), "u-me", true)).toEqual({
    kind: "key",
  });
  // This server's own key, by the maker the right hand's models come from: its logo and name, never a key glyph.
  expect(
    mineStatus(ws({ brain: "model", ownerId: null, servesYou: true, key: null }), "u-me", true, "anthropic"),
  ).toEqual({ kind: "key", label: "Claude", provider: "anthropic" });
  expect(mineStatus(ws({ brain: "codex", ownerId: "u-ana", servesYou: true }), "u-me", false)).toEqual({
    kind: "plan",
    brain: "codex",
  });
});

test("nobody answers me: no key and no server key, or a plan that serves only its owner", () => {
  expect(mineStatus(ws({ brain: "model", ownerId: null, servesYou: true, key: null }), "u-me", false)).toEqual({
    kind: "nobody",
  });
  expect(mineStatus(ws({ brain: "codex", ownerId: "u-ana", servesYou: false }), "u-me", false)).toEqual({
    kind: "nobody",
  });
  expect(mineStatus(undefined, "u-me", false)).toBeNull();
});

test("Sua IA's model on my own plan: the plan's models and the one it runs with; saved as the agent page saves it", () => {
  const accounts = [{ id: "a1", label: "Claude Max", ownerId: "u-me", provider: null }] as AgentBrain["accounts"];
  const options = [
    {
      kind: "claude_code",
      available: true,
      models: [
        { value: "opus", label: "Opus" },
        { value: "sonnet", label: "Sonnet", recommended: true },
        { value: "haiku", label: "Haiku" },
      ],
      defaultModel: "sonnet",
    },
  ] as AgentBrain["options"];
  const mine = (over: Partial<AgentBrain>) =>
    view({ brain: "claude_code", account: "a1", accounts, options, effectiveModel: "sonnet", effort: null, ...over });
  // Connected with no model chosen: the plan's default.
  expect(mineModels(mine({}))).toMatchObject({ value: "sonnet", defaultModel: "sonnet" });
  expect(mineModels(mine({}))?.choices.map((c) => c.value)).toEqual(["opus", "sonnet", "haiku"]);
  expect(mineModels(mine({ model: "auto", effectiveModel: "auto" }))?.value).toBe("auto");
  // Always Opus: a fixed model, the effort it had; the default saved as none; Automático picks the effort too.
  expect(mineModelInput({ effort: null }, "opus", "sonnet")).toEqual({ scope: "mine", model: "opus" });
  expect(mineModelInput({ effort: "auto" }, "opus", "sonnet")).toEqual({
    scope: "mine",
    model: "opus",
    effort: "medium",
  });
  expect(mineModelInput({ effort: "high" }, "sonnet", "sonnet")).toEqual({ scope: "mine", model: null });
  expect(mineModelInput({ effort: "high" }, "auto", "sonnet")).toEqual({
    scope: "mine",
    model: "auto",
    effort: "auto",
  });
  // The workspace's AI, or nothing loaded: no model of mine to pick.
  expect(mineModels(view({ brain: "model" }))).toBeNull();
  expect(mineModels(undefined)).toBeNull();
});
