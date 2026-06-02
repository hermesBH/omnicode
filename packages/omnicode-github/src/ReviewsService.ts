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

export interface PullRequestReview {
  readonly id: number;
  readonly body: string;
  readonly state: string;
  readonly author: string;
  readonly commitId: string;
  readonly submittedAt: string;
  readonly htmlUrl: string;
}

export type ReviewEvent =
  | "APPROVE"
  | "REQUEST_CHANGES"
  | "COMMENT";

export interface ReviewCreateInput {
  readonly owner: string;
  readonly repo: string;
  readonly pullNumber: number;
  readonly body: string;
  readonly event: ReviewEvent;
  readonly commitId?: string;
  readonly comments?: ReadonlyArray<ReviewCommentInput>;
}

export interface ReviewCommentInput {
  readonly path: string;
  readonly body: string;
  readonly position?: number;
  readonly line?: number;
  readonly side?: "LEFT" | "RIGHT";
  readonly startLine?: number;
  readonly startSide?: "LEFT" | "RIGHT";
  readonly commitId: string;
}

export interface ReviewUpdateInput {
  readonly owner: string;
  readonly repo: string;
  readonly pullNumber: number;
  readonly reviewId: number;
  readonly body: string;
}

export interface InlineCommentInput {
  readonly owner: string;
  readonly repo: string;
  readonly pullNumber: number;
  readonly body: string;
  readonly commitId: string;
  readonly path: string;
  readonly line?: number;
  readonly side?: "LEFT" | "RIGHT";
  readonly startLine?: number;
  readonly startSide?: "LEFT" | "RIGHT";
}

export interface InlineComment {
  readonly id: number;
  readonly body: string;
  readonly htmlUrl: string;
}

// ==================== Service Shape ====================

export interface ReviewsServiceShape {
  readonly listReviews: (owner: string, repo: string, pullNumber: number) => Effect.Effect<ReadonlyArray<PullRequestReview>, GitHubApiError | GitHubNotFoundError | GitHubRateLimitError>;
  readonly createReview: (input: ReviewCreateInput) => Effect.Effect<PullRequestReview, GitHubApiError | GitHubNotFoundError | GitHubRateLimitError>;
  readonly updateReview: (input: ReviewUpdateInput) => Effect.Effect<PullRequestReview, GitHubApiError | GitHubNotFoundError | GitHubRateLimitError>;
  readonly createInlineComment: (input: InlineCommentInput) => Effect.Effect<InlineComment, GitHubApiError | GitHubNotFoundError | GitHubRateLimitError>;
}

// ==================== Service Tag ====================

export class ReviewsService extends Context.Service<ReviewsService, ReviewsServiceShape>()(
  "@omnicode/github/ReviewsService",
) {}

// ==================== Mappers ====================

const toReview = (raw: Record<string, unknown>): PullRequestReview => ({
  id: raw.id as number,
  body: raw.body as string,
  state: raw.state as string,
  author: ((raw.user as Record<string, unknown>)?.login as string) ?? "unknown",
  commitId: raw.commit_id as string,
  submittedAt: raw.submitted_at as string,
  htmlUrl: raw.html_url as string,
});

const toInlineComment = (raw: Record<string, unknown>): InlineComment => ({
  id: raw.id as number,
  body: raw.body as string,
  htmlUrl: raw.html_url as string,
});

// ==================== Constructor ====================

export const make = Effect.map(
  GitHubClient,
  (client: GitHubClientShape): ReviewsServiceShape => ({
    listReviews: (owner, repo, pullNumber) =>
      Effect.map(
        client.request("pulls.listReviews", client.octokit.rest.pulls.listReviews({
          owner,
          repo,
          pull_number: pullNumber,
        })),
        (response) => (response.data as ReadonlyArray<Record<string, unknown>>).map(toReview),
      ),

    createReview: (input) =>
      Effect.map(
        client.request("pulls.createReview", client.octokit.rest.pulls.createReview(input as any)),
        (response) => toReview(response.data as Record<string, unknown>),
      ),

    updateReview: (input) =>
      Effect.map(
        client.request("pulls.updateReview", client.octokit.rest.pulls.updateReview(input as any)),
        (response) => toReview(response.data as Record<string, unknown>),
      ),

    createInlineComment: (input) =>
      Effect.map(
        client.request("pulls.createReviewComment", client.octokit.rest.pulls.createReviewComment({
          owner: input.owner,
          repo: input.repo,
          pull_number: input.pullNumber,
          body: input.body,
          commit_id: input.commitId,
          path: input.path,
          line: input.line,
          side: input.side,
          start_line: input.startLine,
          start_side: input.startSide,
        } as any)),
        (response) => toInlineComment(response.data as Record<string, unknown>),
      ),
  }),
);

// ==================== Layer ====================

export const layer = Layer.effect(ReviewsService, make);
