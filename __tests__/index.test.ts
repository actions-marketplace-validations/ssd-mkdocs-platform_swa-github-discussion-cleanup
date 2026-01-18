import { jest } from "@jest/globals";

const infoMock = jest.fn();
const debugMock = jest.fn();
const setOutputMock = jest.fn();
const setFailedMock = jest.fn();
const getInputMock = jest.fn();

jest.unstable_mockModule("@actions/core", () => ({
  getInput: getInputMock,
  setOutput: setOutputMock,
  setFailed: setFailedMock,
  info: infoMock,
  debug: debugMock,
}));

jest.unstable_mockModule("@actions/github", () => ({
  context: { repo: { owner: "ctx-owner", repo: "ctx-repo" } },
  getOctokit: () => ({}),
}));

jest.unstable_mockModule("@octokit/graphql", () => ({
  graphql: {
    defaults: () => jest.fn(),
  },
}));

const { parseTargetRepo, shouldDeleteDiscussion } =
  await import("../src/index.js");

type DiscussionNode = {
  id: string;
  title: string;
  createdAt: string;
  url: string;
};

describe("parseTargetRepo", () => {
  it("parses owner/repo format correctly", () => {
    const result = parseTargetRepo("owner/repo", {
      owner: "default-owner",
      repo: "default-repo",
    });
    expect(result).toEqual({ owner: "owner", repo: "repo" });
  });

  it("returns context repo when input is undefined", () => {
    const result = parseTargetRepo(undefined, {
      owner: "ctx-owner",
      repo: "ctx-repo",
    });
    expect(result).toEqual({ owner: "ctx-owner", repo: "ctx-repo" });
  });

  it("returns context repo when input is empty string", () => {
    const result = parseTargetRepo("", {
      owner: "ctx-owner",
      repo: "ctx-repo",
    });
    expect(result).toEqual({ owner: "ctx-owner", repo: "ctx-repo" });
  });

  it("throws error for invalid format without slash", () => {
    expect(() =>
      parseTargetRepo("invalid-format", {
        owner: "default-owner",
        repo: "default-repo",
      }),
    ).toThrow("Invalid target-repo format: invalid-format");
  });

  it("throws error for format with only owner", () => {
    expect(() =>
      parseTargetRepo("owner/", {
        owner: "default-owner",
        repo: "default-repo",
      }),
    ).toThrow("Invalid target-repo format: owner/");
  });
});

describe("shouldDeleteDiscussion", () => {
  const createDiscussion = (
    title: string,
    createdAt: string,
  ): DiscussionNode => ({
    id: "test-id",
    title,
    createdAt,
    url: "https://github.com/owner/repo/discussions/1",
  });

  describe("expiration mode", () => {
    it("期限切れDiscussionは削除対象である", () => {
      const discussion = createDiscussion(
        "SWA access invite for @alice (my-swa) - 2024-01-01",
        "2024-01-01T00:00:00Z",
      );
      const expirationDate = new Date("2024-01-08T00:00:00Z");

      expect(
        shouldDeleteDiscussion(discussion, expirationDate, "expiration"),
      ).toBe(true);
    });

    it("期限内Discussionは削除対象ではない", () => {
      const discussion = createDiscussion(
        "SWA access invite for @alice (my-swa) - 2024-01-10",
        "2024-01-10T00:00:00Z",
      );
      const expirationDate = new Date("2024-01-08T00:00:00Z");

      expect(
        shouldDeleteDiscussion(discussion, expirationDate, "expiration"),
      ).toBe(false);
    });
  });

  describe("immediate mode", () => {
    it("即時削除モードは有効期限に依存しない", () => {
      const discussion = createDiscussion(
        "SWA access invite for @alice (my-swa) - 2024-01-10",
        "2024-01-10T00:00:00Z",
      );
      const expirationDate = new Date("2024-01-08T00:00:00Z");

      expect(
        shouldDeleteDiscussion(discussion, expirationDate, "immediate"),
      ).toBe(true);
    });
  });
});
