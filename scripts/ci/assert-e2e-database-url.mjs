const databaseUrl = process.env.DATABASE_URL;
const projectRef = process.env.DB_POSTURE_PROJECT_REF;

if (!databaseUrl || !projectRef) {
  console.error("ERROR: DATABASE_URL and DB_POSTURE_PROJECT_REF are required.");
  process.exit(1);
}

if (databaseUrl !== databaseUrl.trim() || /[\r\n]/.test(databaseUrl)) {
  console.error("ERROR: E2E_DATABASE_URL has whitespace or a newline outside URI fields.");
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(databaseUrl);
} catch {
  console.error("ERROR: E2E_DATABASE_URL is not a valid PostgreSQL URI.");
  process.exit(1);
}

const failures = [];
const expectedUsername = `postgres.${projectRef}`;
let username = "";
let password = "";

try {
  username = decodeURIComponent(parsed.username);
  password = decodeURIComponent(parsed.password);
} catch {
  console.error("ERROR: E2E_DATABASE_URL contains invalid percent encoding.");
  process.exit(1);
}

if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
  failures.push("scheme must be postgres:// or postgresql://");
}
if (username !== expectedUsername) {
  failures.push("shared-pooler username must be postgres.<E2E project ref>");
}
if (!parsed.hostname.endsWith(".pooler.supabase.com")) {
  failures.push("host must be a Supabase shared-pooler host");
}
if (!["5432", "6543"].includes(parsed.port)) {
  failures.push("port must be 5432 (session) or 6543 (transaction)");
}
if (parsed.pathname !== "/postgres") {
  failures.push("database path must be /postgres");
}
if (parsed.hash) {
  failures.push("URI has a fragment; percent-encode # if it belongs to the password");
}
if (!parsed.password || /^\[?(?:your[-_ ]?password|password)\]?$/i.test(password)) {
  failures.push("database password is missing or still a placeholder");
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`ERROR: ${failure}.`);
  process.exit(1);
}

const mode = parsed.port === "5432" ? "session pooler" : "transaction pooler";
console.log(`OK: E2E_DATABASE_URL structure is valid (${mode}); credentials were not printed.`);
