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

export interface PullRequestListItem {
  readonly number: number;
  readonly title: string;
  readonly state: "open" | "closed" | "merged";
  readonly author: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly closedAt: string | null;
  readonly mergedAt: string | null;
  readonly draft: boolean;
  readonly labels: ReadonlyArray<string>;
  readonly headRef: string;
  readonly baseRef: string;
  readonly htmlUrl: string;
}

export interface PullRequestDetail {
  readonly number: number;
  readonly title: string;
  readonly body: string | null;
  readonly state: "open" | "closed" | "merged";
  readonly author: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly closedAt: string | null;
  readonly mergedAt: string | null;
  readonly mergeCommitSha: string | null;
  readonly draft: boolean;
  readonly labels: ReadonlyArray<string>;
  readonly headRef: string;
  readonly headSha: string;
  readonly baseRef: string;
  readonly baseSha: string;
  readonly htmlUrl: string;
  readonly diffUrl: string;
  readonly patchUrl: string;
  readonly additions: number;
  readonly deletions: number;
  readonly changedFiles: number;
  readonly commentsCount: number;
  readonly reviewCommentsCount: number;
  readonly commitsCount: number;
  readonly maintainerCanModify: boolean;
}

export interface PullRequestListInput {
  readonly owner: string;
  readonly repo: string;
  readonly state?: "open" | "closed" | "all";
  readonly head?: string;
  readonly base?: string;
  readonly sort?: "created" | "updated" | "popularity" | "long-running";
  readonly direction?: "asc" | "desc";
  readonly perPage?: number;
  readonly page?: number;
}

export interface PullRequestCreateInput {
  readonly owner: string;
  readonly repo: string;
  readonly title: string;
  readonly head: string;
  readonly base: string;
  readonly body?: string;
  readonly draft?: boolean;
  readonly maintainerCanModify?: boolean;
}

export interface PullRequestUpdateInput {
  readonly owner: string;
  readonly repo: string;
  readonly pullNumber: number;
  readonly title?: string;
  readonly body?: string;
  readonly state?: "open" | "closed";
  readonly base?: string;
  readonly maintainerCanModify?: boolean;
}

export interface PullRequestFile {
  readonly sha: string;
  readonly filename: string;
  readonly status: string;
  readonly additions: number;
  readonly deletions: number;
  readonly changes: number;
  readonly blobUrl: string;
  readonly rawUrl: string;
  readonly contentsUrl: string;
  readonly patch: string | null;
}

export interface ReviewComment {
  readonly id: number;
  readonly body: string;
  readonly path: string;
  readonly position: number | null;
  readonly line: number | null;
  readonly commitId: string;
  readonly author: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly htmlUrl: string;
  readonly pullRequestReviewId: number;
}

export interface PRReviewCommentListInput {
  readonly owner: string;
  readonly repo: string;
  readonly pullNumber: number;
  readonly perPage?: number;
  readonly page?: number;
}

// ==================== Service Shape ====================

export interface PullRequestsServiceShape {
  readonly listPullRequests: (input: PullRequestListInput) => Effect.Effect<ReadonlyArray<PullRequestListItem>, GitHubApiError | GitHubNotFoundError | GitHubRateLimitError>;
  readonly getPullRequest: (owner: string, repo: string, pullNumber: number) => Effect.Effect<PullRequestDetail, GitHubApiError | GitHubNotFoundError | GitHubRateLimitError>;
  readonly createPullRequest: (input: PullRequestCreateInput) => Effect.Effect<PullRequestDetail, GitHubApiError | GitHubNotFoundError | GitHubRateLimitError>;
  readonly updatePullRequest: (input: PullRequestUpdateInput) => Effect.Effect<PullRequestDetail, GitHubApiError | GitHubNotFoundError | GitHubRateLimitError>;
  readonly listPullRequestFiles: (owner: string, repo: string, pullNumber: number) => Effect.Effect<ReadonlyArray<PullRequestFile>, GitHubApiError | GitHubNotFoundError | GitHubRateLimitError>;
  readonly listReviewComments: (input: PRReviewCommentListInput) => Effect.Effect<ReadonlyArray<ReviewComment>, GitHubApiError | GitHubNotFoundError | GitHubRateLimitError>;
}

// ==================== Service Tag ====================

export class PullRequestsService extends Context.Service<PullRequestsService, PullRequestsServiceShape>()(
  "@omnicode/github/PullRequestsService",
) {}

// ==================== Mappers ====================

const toPRListItem = (raw: Record<string, unknown>): PullRequestListItem => ({
  number: raw.number as number,
  title: raw.title as string,
  state: ((raw.merged_at as string) ? "merged" : raw.state) as "open" | "closed" | "merged",
  author: ((raw.user as Record<string, unknown>)?.login as string) ?? "unknown",
  createdAt: raw.created_at as string,
  updatedAt: raw.updated_at as string,
  closedAt: (raw.closed_at as string) ?? null,
  mergedAt: (raw.merged_at as string) ?? null,
  draft: (raw.draft as boolean) ?? false,
  labels: ((raw.labels as ReadonlyArray<Record<string, unknown>>) ?? []).map(
    (l) => ((l.name as string) ?? (l as unknown as string)),
  ),
  headRef: ((raw.head as Record<string, unknown>)?.ref as string) ?? "",
  baseRef: ((raw.base as Record<string, unknown>)?.ref as string) ?? "",
  htmlUrl: raw.html_url as string,
});

const toPRDetail = (raw: Record<string, unknown>): PullRequestDetail => ({
  number: raw.number as number,
  title: raw.title as string,
  body: (raw.body as string) ?? null,
  state: ((raw.merged_at as string) ? "merged" : raw.state) as "open" | "closed" | "merged",
  author: ((raw.user as Record<string, unknown>)?.login as string) ?? "unknown",
  createdAt: raw.created_at as string,
  updatedAt: raw.updated_at as string,
  closedAt: (raw.closed_at as string) ?? null,
  mergedAt: (raw.merged_at as string) ?? null,
  mergeCommitSha: (raw.merge_commit_sha as string) ?? null,
  draft: (raw.draft as boolean) ?? false,
  labels: ((raw.labels as ReadonlyArray<Record<string, unknown>>) ?? []).map(
    (l) => ((l.name as string) ?? (l as unknown as string)),
  ),
  headRef: ((raw.head as Record<string, unknown>)?.ref as string) ?? "",
  headSha: ((raw.head as Record<string, unknown>)?.sha as string) ?? "",
  baseRef: ((raw.base as Record<string, unknown>)?.ref as string) ?? "",
  baseSha: ((raw.base as Record<string, unknown>)?.sha as string) ?? "",
  htmlUrl: raw.html_url as string,
  diffUrl: raw.diff_url as string,
  patchUrl: raw.patch_url as string,
  additions: raw.additions as number,
  deletions: raw.deletions as number,
  changedFiles: raw.changed_files as number,
  commentsCount: raw.comments as number,
  reviewCommentsCount: raw.review_comments as number,
  commitsCount: raw.commits as number,
  maintainerCanModify: (raw.maintainer_can_modify as boolean) ?? false,
});

const toPRFile = (raw: Record<string, unknown>): PullRequestFile => ({
  sha: raw.sha as string,
  filename: raw.filename as string,
  status: raw.status as string,
  additions: raw.additions as number,
  deletions: raw.deletions as number,
  changes: raw.changes as number,
  blobUrl: raw.blob_url as string,
  rawUrl: raw.raw_url as string,
  contentsUrl: raw.contents_url as string,
  patch: (raw.patch as string) ?? null,
});

const toReviewComment = (raw: Record<string, unknown>): ReviewComment => ({
  id: raw.id as number,
  body: raw.body as string,
  path: raw.path as string,
  position: (raw.position as number) ?? null,
  line: (raw.line as number) ?? null,
  commitId: raw.commit_id as string,
  author: ((raw.user as Record<string, unknown>)?.login as string) ?? "unknown",
  createdAt: raw.created_at as string,
  updatedAt: raw.updated_at as string,
  htmlUrl: raw.html_url as string,
  pullRequestReviewId: raw.pull_request_review_id as number,
});

// ==================== Constructor ====================

export const make = Effect.map(
  GitHubClient,
  (client: GitHubClientShape): PullRequestsServiceShape => ({
    listPullRequests: (input) =>
      Effect.map(
        client.request("pulls.list", client.octokit.rest.pulls.list(input as any)),
        (response) => (response.data as ReadonlyArray<Record<string, unknown>>).map(toPRListItem),
      ),

    getPullRequest: (owner, repo, pullNumber) =>
      Effect.map(
        client.request("pulls.get", client.octokit.rest.pulls.get({ owner, repo, pull_number: pullNumber })),
        (response) => toPRDetail(response.data as Record<string, unknown>),
      ),

    createPullRequest: (input) =>
      Effect.map(
        client.request("pulls.create", client.octokit.rest.pulls.create(input as any)),
        (response) => toPRDetail(response.data as Record<string, unknown>),
      ),

    updatePullRequest: (input) =>
      Effect.map(
        client.request("pulls.update", client.octokit.rest.pulls.update(input as any)),
        (response) => toPRDetail(response.data as Record<string, unknown>),
      ),

    listPullRequestFiles: (owner, repo, pullNumber) =>
      Effect.map(
        client.request("pulls.listFiles", client.octokit.rest.pulls.listFiles({ owner, repo, pull_number: pullNumber })),
        (response) => (response.data as ReadonlyArray<Record<string, unknown>>).map(toPRFile),
      ),

    listReviewComments: (input) =>
      Effect.map(
        client.request("pulls.listReviewComments", client.octokit.rest.pulls.listReviewComments(input as any)),
        (response) => (response.data as ReadonlyArray<Record<string, unknown>>).map(toReviewComment),
      ),
  }),
);

// ==================== Layer ====================

export const layer = Layer.effect(PullRequestsService, make);
