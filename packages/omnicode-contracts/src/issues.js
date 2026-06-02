import * as Schema from "effect/Schema";
// ---------------------------------------------------------------------------
// Issue List Query
// ---------------------------------------------------------------------------
/**
 * Issue state filter.
 */
export const IssueState = Schema.Literals(["open", "closed", "all"]);
/**
 * Issue sort options.
 */
export const IssueSort = Schema.Literals(["created", "updated", "comments"]);
/**
 * Query for listing issues.
 */
export const IssueListQuery = Schema.Struct({
    owner: Schema.String,
    repo: Schema.String,
    state: Schema.optional(IssueState),
    labels: Schema.optional(Schema.Array(Schema.String)),
    sort: Schema.optional(IssueSort),
    direction: Schema.optional(Schema.Literals(["asc", "desc"])),
    since: Schema.optional(Schema.String),
    perPage: Schema.optional(Schema.Number),
    page: Schema.optional(Schema.Number),
    milestone: Schema.optional(Schema.Union([Schema.String, Schema.Number])),
    assignee: Schema.optional(Schema.String),
    creator: Schema.optional(Schema.String),
});
// ---------------------------------------------------------------------------
// Issue Create Input
// ---------------------------------------------------------------------------
/**
 * Input for creating a new issue.
 */
export const IssueCreateInput = Schema.Struct({
    owner: Schema.String,
    repo: Schema.String,
    title: Schema.String,
    body: Schema.optional(Schema.String),
    labels: Schema.optional(Schema.Array(Schema.String)),
    assignees: Schema.optional(Schema.Array(Schema.String)),
    milestone: Schema.optional(Schema.Number),
});
// ---------------------------------------------------------------------------
// Issue View
// ---------------------------------------------------------------------------
/**
 * A label on an issue.
 */
export const IssueLabel = Schema.Struct({
    name: Schema.String,
    color: Schema.String,
    description: Schema.optional(Schema.String),
});
/**
 * A full view of an issue.
 */
export const IssueView = Schema.Struct({
    number: Schema.Number,
    title: Schema.String,
    body: Schema.optional(Schema.NullOr(Schema.String)),
    state: Schema.Literals(["open", "closed"]),
    labels: Schema.Array(IssueLabel),
    assignees: Schema.Array(Schema.String),
    milestone: Schema.optional(Schema.NullOr(Schema.String)),
    htmlUrl: Schema.String,
    createdAt: Schema.String,
    updatedAt: Schema.String,
    closedAt: Schema.optional(Schema.NullOr(Schema.String)),
    author: Schema.String,
    commentsCount: Schema.Number,
    isPullRequest: Schema.Boolean,
});
