/**
 * IssuePanel search params — mirrors diffRouteSearch pattern.
 */

export interface IssuesRouteSearch {
  issues?: "1" | undefined;
}

export function stripIssuesSearchParams<T extends Record<string, unknown>>(
  params: T,
): Omit<T, "issues"> {
  const { issues: _issues, ...rest } = params;
  return rest as Omit<T, "issues">;
}

export function parseIssuesRouteSearch(search: Record<string, unknown>): IssuesRouteSearch {
  const issues = search.issues === "1" || search.issues === 1 || search.issues === true
    ? "1" as const
    : undefined;
  return { ...(issues ? { issues } : {}) };
}
