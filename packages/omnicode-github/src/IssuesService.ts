import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import { Octokit } from "@octokit/rest";

import {
  GitHubClient,
  type GitHubClientShape,
  type GitHubApiError,
  type GitHubNotFoundError,
  type GitHubRateLimitError,
} from "./GitHubClient.ts";

// ==================== Domain Types ====================

export interface IssueLabel {
  readonly name: string;
  readonly color: string;
  readonly description?: string;
}

export interface GitHubIssue {
  readonly number: number;
  readonly title: string;
  readonly body: string | null;
  readonly state: "open" | "closed";
  readonly labels: ReadonlyArray<IssueLabel>;
  readonly assignees: ReadonlyArray<string>;
  readonly milestone: string | null;
  readonly htmlUrl: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly closedAt: string | null;
  readonly author: string;
  readonly commentsCount: number;
  readonly isPullRequest: boolean;
}

export interface IssueCreateInput {
  readonly owner: string;
  readonly repo: string;
  readonly title: string;
  readonly body?: string;
  readonly labels?: ReadonlyArray<string>;
  readonly assignees?: ReadonlyArray<string>;
  readonly milestone?: number;
}

export interface IssueUpdateInput {
  readonly owner: string;
  readonly repo: string;
  readonly issueNumber: number;
  readonly title?: string;
  readonly body?: string;
  readonly state?: "open" | "closed";
  readonly labels?: ReadonlyArray<string>;
  readonly assignees?: ReadonlyArray<string>;
  readonly milestone?: number | null;
}

export interface IssueSearchInput {
  readonly query: string;
  readonly sort?: "created" | "updated" | "comments";
  readonly order?: "asc" | "desc";
  readonly perPage?: number;
  readonly page?: number;
}

export interface IssueSearchResult {
  readonly items: ReadonlyArray<GitHubIssue>;
  readonly totalCount: number;
  readonly incompleteResults: boolean;
}

export interface IssueListInput {
  readonly owner: string;
  readonly repo: string;
  readonly state?: "open" | "closed" | "all";
  readonly labels?: ReadonlyArray<string>;
  readonly sort?: "created" | "updated" | "comments";
  readonly direction?: "asc" | "desc";
  readonly since?: string;
  readonly perPage?: number;
  readonly page?: number;
  readonly milestone?: string | number;
  readonly assignee?: string;
  readonly creator?: string;
}

export interface IssueCommentInput {
  readonly owner: string;
  readonly repo: string;
  readonly issueNumber: number;
  readonly body: string;
}

export interface IssueComment {
  readonly id: number;
  readonly body: string;
  readonly author: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly htmlUrl: string;
}

// ==================== Service Shape ====================

export interface IssuesServiceShape {
  readonly getIssue: (owner: string, repo: string, issueNumber: number) => Effect.Effect<GitHubIssue, GitHubApiError | GitHubNotFoundError | GitHubRateLimitError>;
  readonly createIssue: (input: IssueCreateInput) => Effect.Effect<GitHubIssue, GitHubApiError | GitHubNotFoundError | GitHubRateLimitError>;
  readonly updateIssue: (input: IssueUpdateInput) => Effect.Effect<GitHubIssue, GitHubApiError | GitHubNotFoundError | GitHubRateLimitError>;
  readonly listIssues: (input: IssueListInput) => Effect.Effect<ReadonlyArray<GitHubIssue>, GitHubApiError | GitHubNotFoundError | GitHubRateLimitError>;
  readonly searchIssues: (input: IssueSearchInput) => Effect.Effect<IssueSearchResult, GitHubApiError | GitHubNotFoundError | GitHubRateLimitError>;
  readonly listComments: (owner: string, repo: string, issueNumber: number) => Effect.Effect<ReadonlyArray<IssueComment>, GitHubApiError | GitHubNotFoundError | GitHubRateLimitError>;
  readonly createComment: (input: IssueCommentInput) => Effect.Effect<IssueComment, GitHubApiError | GitHubNotFoundError | GitHubRateLimitError>;
}

// ==================== Service Tag ====================

export class IssuesService extends Context.Service<IssuesService, IssuesServiceShape>()(
  "@omnicode/github/IssuesService",
) {}

// ==================== Mappers ====================

const toIssue = (raw: Record<string, unknown>): GitHubIssue => ({
  number: raw.number as number,
  title: raw.title as string,
  body: (raw.body as string) ?? null,
  state: raw.state as "open" | "closed",
  labels: ((raw.labels as ReadonlyArray<Record<string, unknown>>) ?? []).map((l) => ({
    name: l.name as string,
    color: l.color as string,
    ...(l.description ? { description: l.description as string } : {}),
  })),
  assignees: ((raw.assignees as ReadonlyArray<Record<string, unknown> | null>) ?? [])
    .filter((a): a is Record<string, unknown> => a !== null)
    .map((a) => a.login as string),
  milestone: ((raw.milestone as Record<string, unknown>)?.title as string) ?? null,
  htmlUrl: raw.html_url as string,
  createdAt: raw.created_at as string,
  updatedAt: raw.updated_at as string,
  closedAt: (raw.closed_at as string) ?? null,
  author: ((raw.user as Record<string, unknown>)?.login as string) ?? "unknown",
  commentsCount: raw.comments as number,
  isPullRequest: raw.pull_request !== undefined,
});

const toComment = (raw: Record<string, unknown>): IssueComment => ({
  id: raw.id as number,
  body: raw.body as string,
  author: ((raw.user as Record<string, unknown>)?.login as string) ?? "unknown",
  createdAt: raw.created_at as string,
  updatedAt: raw.updated_at as string,
  htmlUrl: raw.html_url as string,
});

// ==================== Constructor ====================

export const make = Effect.map(
  GitHubClient,
  (client: GitHubClientShape): IssuesServiceShape => ({
    getIssue: (owner, repo, issueNumber) =>
      Effect.map(
        client.request("issues.get", client.octokit.rest.issues.get({ owner, repo, issue_number: issueNumber })),
        (response) => toIssue(response.data as Record<string, unknown>),
      ),

    createIssue: (input) =>
      Effect.map(
        client.request("issues.create", client.octokit.rest.issues.create(input as any)),
        (response) => toIssue(response.data as Record<string, unknown>),
      ),

    updateIssue: (input) =>
      Effect.map(
        client.request("issues.update", client.octokit.rest.issues.update(input as any)),
        (response) => toIssue(response.data as Record<string, unknown>),
      ),

    listIssues: (input) =>
      Effect.map(
        client.request("issues.listForRepo", client.octokit.rest.issues.listForRepo(input as any)),
        (response) => (response.data as ReadonlyArray<Record<string, unknown>>).map(toIssue),
      ),

    searchIssues: (input) =>
      Effect.map(
        client.request("search.issuesAndPullRequests", client.octokit.rest.search.issuesAndPullRequests(input as any)),
        (response) => ({
          items: (response.data.items as ReadonlyArray<Record<string, unknown>>).map(toIssue),
          totalCount: response.data.total_count,
          incompleteResults: response.data.incomplete_results,
        }),
      ),

    listComments: (owner, repo, issueNumber) =>
      Effect.map(
        client.request("issues.listComments", client.octokit.rest.issues.listComments({ owner, repo, issue_number: issueNumber })),
        (response) => (response.data as ReadonlyArray<Record<string, unknown>>).map(toComment),
      ),

    createComment: (input) =>
      Effect.map(
        client.request("issues.createComment", client.octokit.rest.issues.createComment({
          owner: input.owner,
          repo: input.repo,
          issue_number: input.issueNumber,
          body: input.body,
        })),
        (response) => toComment(response.data as Record<string, unknown>),
      ),
  }),
);

// ==================== Layer ====================

export const layer = Layer.effect(IssuesService, make);
