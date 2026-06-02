import * as Schema from "effect/Schema";

// ---------------------------------------------------------------------------
// Repository View
// ---------------------------------------------------------------------------

/**
 * A view of a single repository.
 */
export const RepositoryView = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  fullName: Schema.String,
  description: Schema.optional(Schema.NullOr(Schema.String)),
  htmlUrl: Schema.String,
  url: Schema.String,
  homepage: Schema.optional(Schema.NullOr(Schema.String)),
  language: Schema.optional(Schema.NullOr(Schema.String)),
  topics: Schema.optional(Schema.Array(Schema.String)),
  visibility: Schema.Literals(["public", "private"]),
  fork: Schema.Boolean,
  archived: Schema.Boolean,
  disabled: Schema.Boolean,
  starsCount: Schema.Number,
  forksCount: Schema.Number,
  openIssuesCount: Schema.Number,
  watchersCount: Schema.Number,
  defaultBranch: Schema.String,
  owner: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  pushedAt: Schema.String,
  license: Schema.optional(Schema.NullOr(Schema.String)),
  size: Schema.Number,
});
export type RepositoryView = typeof RepositoryView.Type;

// ---------------------------------------------------------------------------
// Repo Search Query
// ---------------------------------------------------------------------------

/**
 * Repo sort options.
 */
export const RepoSearchSort = Schema.Literals(["stars", "forks", "updated", "help-wanted-issues"]);
export type RepoSearchSort = typeof RepoSearchSort.Type;

/**
 * Search direction.
 */
export const SortDirection = Schema.Literals(["asc", "desc"]);
export type SortDirection = typeof SortDirection.Type;

/**
 * Input query for searching repositories.
 */
export const RepoSearchQuery = Schema.Struct({
  query: Schema.String,
  sort: Schema.optional(RepoSearchSort),
  order: Schema.optional(SortDirection),
  perPage: Schema.optional(Schema.Number),
  page: Schema.optional(Schema.Number),
});
export type RepoSearchQuery = typeof RepoSearchQuery.Type;

// ---------------------------------------------------------------------------
// Repo Search Result
// ---------------------------------------------------------------------------

/**
 * Result of a repository search.
 */
export const RepoSearchResult = Schema.Struct({
  items: Schema.Array(RepositoryView),
  totalCount: Schema.Number,
  incompleteResults: Schema.Boolean,
});
export type RepoSearchResult = typeof RepoSearchResult.Type;
