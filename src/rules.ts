import type { FileChange } from "./git.js";

export interface ReviewPrompt {
  id: string;
  path: string;
  previousPath: string | null;
  rule: string;
  reason: string;
  evidence: string;
}

interface PathRuleDefinition {
  id: string;
  rule: string;
  reason: string;
  matches: (filePath: string) => boolean;
}

export const LARGE_DELETION_THRESHOLD = 100;

const DEPENDENCY_FILES = new Set([
  "package.json",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
  "cargo.toml",
  "cargo.lock",
  "go.mod",
  "go.sum",
  "pyproject.toml",
  "poetry.lock",
  "pipfile",
  "pipfile.lock",
  "gemfile",
  "gemfile.lock",
  "composer.json",
  "composer.lock",
  "pom.xml",
  "gradle.lockfile",
]);

const AUTH_KEYWORDS = new Set([
  "auth",
  "authentication",
  "authorization",
  "permission",
  "permissions",
  "acl",
  "rbac",
  "credential",
  "credentials",
  "secret",
  "secrets",
  "token",
  "tokens",
  "oauth",
  "login",
  "session",
  "sessions",
  "policy",
  "policies",
  "crypto",
]);

const MIGRATION_KEYWORDS = new Set([
  "migration",
  "migrations",
  "migrate",
  "schema",
  "schemas",
  "alembic",
  "prisma",
  "drizzle",
  "liquibase",
  "flyway",
]);

function normalizedPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").toLowerCase();
}

function baseName(filePath: string): string {
  const segments = normalizedPath(filePath).split("/");
  return segments.at(-1) ?? "";
}

function pathSegments(filePath: string): string[] {
  return normalizedPath(filePath)
    .split(/[\/._-]/)
    .filter((segment) => segment.length > 0);
}

function matchesDependency(filePath: string): boolean {
  const fileName = baseName(filePath);
  if (DEPENDENCY_FILES.has(fileName)) return true;
  return (
    /^requirements[-.][\w.-]*\.txt$/.test(fileName) ||
    /^requirements\.txt$/.test(fileName) ||
    /^build\.gradle(?:\.kts)?$/.test(fileName)
  );
}

function matchesWorkflow(filePath: string): boolean {
  const normalized = normalizedPath(filePath);
  return (
    normalized.startsWith(".github/workflows/") ||
    normalized.startsWith(".circleci/") ||
    normalized === ".gitlab-ci.yml" ||
    normalized === "jenkinsfile" ||
    normalized === "azure-pipelines.yml" ||
    normalized === ".woodpecker.yml"
  );
}

function matchesAuth(filePath: string): boolean {
  return pathSegments(filePath).some((segment) => AUTH_KEYWORDS.has(segment));
}

function matchesMigration(filePath: string): boolean {
  return pathSegments(filePath).some((segment) => MIGRATION_KEYWORDS.has(segment));
}

function matchesSecretLikeFile(filePath: string): boolean {
  const fileName = baseName(filePath);
  if (fileName === ".env.example" || fileName === ".env.sample" || fileName === ".env.template") {
    return false;
  }
  if (fileName === ".env" || fileName.startsWith(".env.")) return true;
  if (fileName === ".npmrc" || fileName === ".pypirc" || fileName === ".netrc") return true;
  if (fileName === "id_rsa" || fileName === "id_ed25519" || fileName === "credentials.json") return true;
  if (/^service-account.*\.json$/.test(fileName)) return true;
  if (/^secrets\.(json|ya?ml|toml|txt)$/.test(fileName)) return true;
  return /\.(pem|key|p12|pfx|keystore|jks)$/.test(fileName);
}

const PATH_RULES: PathRuleDefinition[] = [
  {
    id: "PP-DEP-001",
    rule: "Dependency manifest/lockfile changed",
    reason: "Dependency changes can alter resolved versions, install scripts, and build behavior.",
    matches: matchesDependency,
  },
  {
    id: "PP-CI-001",
    rule: "CI/workflow file changed",
    reason: "Workflow changes can alter automated checks, secrets exposure, and runner permissions.",
    matches: matchesWorkflow,
  },
  {
    id: "PP-AUTH-001",
    rule: "Authentication/permission-related path changed",
    reason: "This path may touch access control or credential handling; this is not a vulnerability finding.",
    matches: matchesAuth,
  },
  {
    id: "PP-MIGRATION-001",
    rule: "Migration/schema path changed",
    reason: "Persistent data or schema changes deserve an explicit rollback and compatibility review.",
    matches: matchesMigration,
  },
  {
    id: "PP-SECRET-FILE-001",
    rule: "Secret-like filename changed",
    reason: "This filename may contain credentials; Proofpack inspected only the path, not its contents.",
    matches: matchesSecretLikeFile,
  },
];

export function buildReviewPrompts(files: readonly FileChange[]): ReviewPrompt[] {
  const prompts: ReviewPrompt[] = [];

  for (const file of files) {
    const candidatePaths = [file.path, file.previousPath].filter(
      (candidate): candidate is string => candidate !== undefined,
    );
    for (const rule of PATH_RULES) {
      const matchedPath = candidatePaths.find((candidate) => rule.matches(candidate));
      if (matchedPath === undefined) continue;
      prompts.push({
        id: rule.id,
        path: file.path,
        previousPath: file.previousPath ?? null,
        rule: rule.rule,
        reason: rule.reason,
        evidence: `Matched path: ${matchedPath}. Suggested inspection: git diff -- ${matchedPath}`,
      });
    }

    const deletions = file.diffStat.deletions;
    if (deletions !== undefined && deletions >= LARGE_DELETION_THRESHOLD) {
      prompts.push({
        id: "PP-LARGE-DELETION-001",
        path: file.path,
        previousPath: file.previousPath ?? null,
        rule: "Large deletion",
        reason: "Large deletions deserve a focused review of removed behavior and data.",
        evidence: `Git numstat reports ${deletions} deletions for ${file.path}.`,
      });
    }
  }

  return prompts.sort(
    (left, right) => left.path.localeCompare(right.path) || left.id.localeCompare(right.id),
  );
}
