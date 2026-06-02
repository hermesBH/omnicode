/**
 * @omnicode/github – Octokit-based GitHub API integration for OmniCode.
 *
 * This package wraps @octokit/rest to provide richer GitHub features than
 * what the `gh` CLI provides.  Services follow the Effect pattern and
 * complement the existing GitHubSourceControlProvider.
 *
 * @example
 * ```typescript
 * import { GitHubClient, IssuesService, gitHubClientLayer } from "@omnicode/github";
 * ```
 */

// ---------------------------------------------------------------------------
// GitHubClient – core Octokit wrapper with configurable auth
// ---------------------------------------------------------------------------

export {
  GitHubClient,
  GitHubAuthError,
  GitHubApiError,
  GitHubNotFoundError,
  GitHubRateLimitError,
  make as makeGitHubClient,
  layer as gitHubClientLayer,
} from "./GitHubClient.ts";

export type {
  GitHubClientShape,
  GitHubClientConfig,
  GitHubAuthConfig,
  GitHubTokenAuth,
  GitHubAppAuth,
  GitHubOAuthAuth,
  GitHubError,
} from "./GitHubClient.ts";

// ---------------------------------------------------------------------------
// IssuesService
// ---------------------------------------------------------------------------

export {
  IssuesService,
  make as makeIssuesService,
  layer as issuesServiceLayer,
} from "./IssuesService.ts";

export type {
  IssuesServiceShape,
  IssueLabel,
  GitHubIssue,
  IssueCreateInput,
  IssueUpdateInput,
  IssueSearchInput,
  IssueSearchResult,
  IssueListInput,
  IssueCommentInput,
  IssueComment,
} from "./IssuesService.ts";

// ---------------------------------------------------------------------------
// ReposService
// ---------------------------------------------------------------------------

export {
  ReposService,
  make as makeReposService,
  layer as reposServiceLayer,
} from "./ReposService.ts";

export type {
  ReposServiceShape,
  GitHubRepo,
  RepoSearchInput,
  RepoSearchResult,
  RepoListForUserInput,
  RepoListForOrgInput,
  RepoGetInput,
} from "./ReposService.ts";

// ---------------------------------------------------------------------------
// PullRequestsService
// ---------------------------------------------------------------------------

export {
  PullRequestsService,
  make as makePullRequestsService,
  layer as pullRequestsServiceLayer,
} from "./PullRequestsService.ts";

export type {
  PullRequestsServiceShape,
  PullRequestListItem,
  PullRequestDetail,
  PullRequestListInput,
  PullRequestCreateInput,
  PullRequestUpdateInput,
  PullRequestFile,
  ReviewComment,
  PRReviewCommentListInput,
} from "./PullRequestsService.ts";

// ---------------------------------------------------------------------------
// ReviewsService
// ---------------------------------------------------------------------------

export {
  ReviewsService,
  make as makeReviewsService,
  layer as reviewsServiceLayer,
} from "./ReviewsService.ts";

export type {
  ReviewsServiceShape,
  PullRequestReview,
  ReviewEvent,
  ReviewCreateInput,
  ReviewCommentInput,
  ReviewUpdateInput,
  InlineCommentInput,
  InlineComment,
} from "./ReviewsService.ts";
