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

export interface GitHubRepo {
  readonly id: number;
  readonly name: string;
  readonly fullName: string;
  readonly description: string | null;
  readonly htmlUrl: string;
  readonly url: string;
  readonly homepage: string | null;
  readonly language: string | null;
  readonly topics: ReadonlyArray<string>;
  readonly visibility: "public" | "private";
  readonly fork: boolean;
  readonly archived: boolean;
  readonly disabled: boolean;
  readonly starsCount: number;
  readonly forksCount: number;
  readonly openIssuesCount: number;
  readonly watchersCount: number;
  readonly defaultBranch: string;
  readonly owner: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly pushedAt: string;
  readonly license: string | null;
  readonly size: number;
}

export interface RepoSearchInput {
  readonly query: string;
  readonly sort?: "stars" | "forks" | "updated" | "help-wanted-issues";
  readonly order?: "asc" | "desc";
  readonly perPage?: number;
  readonly page?: number;
}

export interface RepoSearchResult {
  readonly items: ReadonlyArray<GitHubRepo>;
  readonly totalCount: number;
  readonly incompleteResults: boolean;
}

export interface RepoListForUserInput {
  readonly username: string;
  readonly type?: "all" | "owner" | "member";
  readonly sort?: "created" | "updated" | "pushed" | "full_name";
  readonly direction?: "asc" | "desc";
  readonly perPage?: number;
  readonly page?: number;
}

export interface RepoListForOrgInput {
  readonly org: string;
  readonly type?: "all" | "public" | "private" | "forks" | "sources" | "member";
  readonly sort?: "created" | "updated" | "pushed" | "full_name";
  readonly direction?: "asc" | "desc";
  readonly perPage?: number;
  readonly page?: number;
}

export interface RepoGetInput {
  readonly owner: string;
  readonly repo: string;
}

// ==================== Service Shape ====================

export interface ReposServiceShape {
  readonly searchRepos: (input: RepoSearchInput) => Effect.Effect<RepoSearchResult, GitHubApiError | GitHubNotFoundError | GitHubRateLimitError>;
  readonly getRepo: (input: RepoGetInput) => Effect.Effect<GitHubRepo, GitHubApiError | GitHubNotFoundError | GitHubRateLimitError>;
  readonly listForUser: (input: RepoListForUserInput) => Effect.Effect<ReadonlyArray<GitHubRepo>, GitHubApiError | GitHubNotFoundError | GitHubRateLimitError>;
  readonly listForOrg: (input: RepoListForOrgInput) => Effect.Effect<ReadonlyArray<GitHubRepo>, GitHubApiError | GitHubNotFoundError | GitHubRateLimitError>;
}

// ==================== Service Tag ====================

export class ReposService extends Context.Service<ReposService, ReposServiceShape>()(
  "@omnicode/github/ReposService",
) {}

// ==================== Mapper ====================

const toRepo = (raw: Record<string, unknown>): GitHubRepo => ({
  id: raw.id as number,
  name: raw.name as string,
  fullName: raw.full_name as string,
  description: (raw.description as string) ?? null,
  htmlUrl: raw.html_url as string,
  url: raw.url as string,
  homepage: (raw.homepage as string) ?? null,
  language: (raw.language as string) ?? null,
  topics: (raw.topics as ReadonlyArray<string>) ?? [],
  visibility: (raw.visibility as "public" | "private") ?? "public",
  fork: raw.fork as boolean,
  archived: raw.archived as boolean,
  disabled: raw.disabled as boolean,
  starsCount: raw.stargazers_count as number,
  forksCount: raw.forks_count as number,
  openIssuesCount: raw.open_issues_count as number,
  watchersCount: raw.watchers_count as number,
  defaultBranch: raw.default_branch as string,
  owner: ((raw.owner as Record<string, unknown>)?.login as string) ?? "unknown",
  createdAt: raw.created_at as string,
  updatedAt: raw.updated_at as string,
  pushedAt: raw.pushed_at as string,
  license: ((raw.license as Record<string, unknown>)?.name as string) ?? null,
  size: raw.size as number,
});

// ==================== Constructor ====================

export const make = Effect.map(
  GitHubClient,
  (client: GitHubClientShape): ReposServiceShape => ({
    searchRepos: (input) =>
      Effect.map(
        client.request("search.repos", client.octokit.rest.search.repos(input as any)),
        (response) => ({
          items: (response.data.items as ReadonlyArray<Record<string, unknown>>).map(toRepo),
          totalCount: response.data.total_count,
          incompleteResults: response.data.incomplete_results,
        }),
      ),

    getRepo: (input) =>
      Effect.map(
        client.request("repos.get", client.octokit.rest.repos.get(input as any)),
        (response) => toRepo(response.data as Record<string, unknown>),
      ),

    listForUser: (input) =>
      Effect.map(
        client.request("repos.listForUser", client.octokit.rest.repos.listForUser(input as any)),
        (response) => (response.data as ReadonlyArray<Record<string, unknown>>).map(toRepo),
      ),

    listForOrg: (input) =>
      Effect.map(
        client.request("repos.listForOrg", client.octokit.rest.repos.listForOrg(input as any)),
        (response) => (response.data as ReadonlyArray<Record<string, unknown>>).map(toRepo),
      ),
  }),
);

// ==================== Layer ====================

export const layer = Layer.effect(ReposService, make);
