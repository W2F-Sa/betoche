// Static content for the decoy site: blog posts, projects, profile bio.
// All data is plain JS so the edge function has no fs dependencies.

export const PROFILE = {
  name: "Mahan Devs",
  role: "Backend & infrastructure engineer",
  location: "Remote",
  bio: "I build small, reliable systems. Mostly Go, Rust, and TypeScript. I write down what I learn so the next person — usually me — has a fighting chance.",
  email: "hello@mahandevs.example",
  github: "mahandevs",
  mastodon: "@mahan@hachyderm.io",
  rss: "/feed.xml",
  joined: "2019-04-12",
};

export const PROJECTS = [
  {
    slug: "feed-api",
    name: "feed-api",
    summary: "Tiny paginated activity feed I use on this site — readable at /api/feed/{session}/{page}, schema at /api/feed/schema.",
    stack: ["TypeScript", "Edge", "Vercel"],
    repo: "https://github.com/mahandevs/feed-api",
    site: null,
  },
  {
    slug: "stream-bridge",
    name: "stream-bridge",
    summary: "Tiny serverless helper for piping HTTP responses between async iterators with bounded backpressure.",
    stack: ["TypeScript", "Node", "Vercel"],
    repo: "https://github.com/mahandevs/stream-bridge",
    site: null,
  },
  {
    slug: "log-shaper",
    name: "log-shaper",
    summary: "Drop-in stdout shaper for Go services — bounded buffers, structured fields, no goroutine leaks.",
    stack: ["Go", "slog", "OpenTelemetry"],
    repo: "https://github.com/mahandevs/log-shaper",
    site: null,
  },
  {
    slug: "sqlite-snap",
    name: "sqlite-snap",
    summary: "WAL-aware SQLite snapshot tool for backing up busy databases without blocking writers.",
    stack: ["Rust", "SQLite", "tokio"],
    repo: "https://github.com/mahandevs/sqlite-snap",
    site: null,
  },
  {
    slug: "tsbench",
    name: "tsbench",
    summary: "Microbenchmark harness for TypeScript that runs in Node, Bun, and Deno with one config.",
    stack: ["TypeScript", "Node", "Bun", "Deno"],
    repo: "https://github.com/mahandevs/tsbench",
    site: "https://tsbench.example.com",
  },
  {
    slug: "kvkit",
    name: "kvkit",
    summary: "A 400-line key/value store on top of Cloudflare KV with a saner API and typed namespaces.",
    stack: ["TypeScript", "Cloudflare Workers"],
    repo: "https://github.com/mahandevs/kvkit",
    site: null,
  },
  {
    slug: "dotfiles",
    name: "dotfiles",
    summary: "My personal dotfiles: zsh, neovim, tmux, ghostty, and a small bin/ of scripts I actually use.",
    stack: ["zsh", "Neovim", "tmux"],
    repo: "https://github.com/mahandevs/dotfiles",
    site: null,
  },
];

export const POSTS = [
  {
    slug: "tiny-feed-api-on-the-edge",
    title: "A tiny activity-feed API I run on the edge",
    date: "2026-02-04",
    tags: ["edge", "api", "design"],
    excerpt:
      "Every personal site eventually grows a paginated feed. Here's the smallest one I could justify shipping, with a per-session cursor and a cache-friendly URL shape.",
    body: `
<p>I keep a small "what changed" feed on this site — release notes, blog posts, occasional public bookmarks. For a long time it was a hand-edited HTML page; the moment I wanted it readable from a second client, I needed an API.</p>
<p>What I shipped lives at <code>/api/feed</code>. The URL shape is the simplest thing that worked:</p>
<pre><code>GET  /api/feed/&lt;sessionId&gt;/&lt;page&gt;   → one page of items
POST /api/feed/&lt;sessionId&gt;/&lt;page&gt;   → ack, advance the reader
GET  /api/feed/&lt;sessionId&gt;          → long-poll for the next batch
GET  /api/feed/recent                  → globally recent (anonymous)
GET  /api/feed/schema                  → OpenAPI 3.0.3
</code></pre>
<p>The <code>sessionId</code> is a long opaque token the server gives a client on first contact. The <code>page</code> is a small integer. That's the entire URL surface.</p>
<h2>Why a session id and a page number?</h2>
<p>Two reasons. First, it gives the edge cache a stable cache key per (reader, position) pair. Second, it lets a client resume cleanly: drop the connection at page 17, come back later and ask for page 18, no server-side cursor state needed.</p>
<h2>What the JSON looks like</h2>
<pre><code>{
  "items":    [...16 items...],
  "page":     0,
  "per_page": 16,
  "has_more": true,
  "next":     1,
  "cursor":   "c_4f8a..."
}</code></pre>
<p>Items have a kind (<code>release</code>, <code>post</code>, <code>reply</code>, …), a title, a ref, a reply count, and a created-at. Nothing exciting. The point of an activity feed isn't novelty, it's "I can scroll this on a phone with one thumb".</p>
<h2>The OpenAPI doc</h2>
<p>I publish the schema at <code>/api/feed/schema</code> so anyone who wants to write a small reader can do it from the JSON description without asking me. There's no auth — the session id <em>is</em> the entitlement; if you have one, you can read.</p>
<h2>What it's not</h2>
<p>It's not a real-time stream. It's not federated. It doesn't push, it doesn't WebSocket. If those mattered I'd reach for SSE or a hosted product. For "show me what's new since I last looked", a long integer and a JSON page is enough.</p>
`,
  },
  {
    slug: "the-shape-of-a-good-changelog",
    title: "The shape of a good changelog",
    date: "2025-11-18",
    tags: ["docs", "habits", "release"],
    excerpt:
      "Five years of writing release notes for production services taught me three things. None of them are about Markdown.",
    body: `
<p>I've written release notes for the same internal platform for five years. The format has changed about a dozen times. The latest one stuck because I finally stopped optimising for the wrong audience.</p>
<h2>1. Write for the person who hasn't shipped a change in six months</h2>
<p>Most readers of a changelog aren't reading every release. They're catching up. The version bump itself is irrelevant — what they want is "what does this mean for what I'm doing today?" Write each entry so it can be read in isolation.</p>
<h2>2. Lead with the verb</h2>
<p>"Added", "Removed", "Fixed", "Renamed". The verb tells the reader whether they should care, before they read the rest of the line. I've watched skim-readers parse fifty changelog entries in the time it took to make their coffee — that only works if the first word does the work.</p>
<h2>3. Group by user, not by package</h2>
<p>Internal release notes used to be grouped by which package changed. That made sense to the engineer publishing the release and to nobody else. We now group by which surface a user touches: dashboard, CLI, API, deploy. The grouping changed who reads the changelog.</p>
<h2>What about Keep a Changelog?</h2>
<p>Fine as a starting template. The "Unreleased" header at the top is the trick that actually moves the needle — when adding an entry is a one-line edit on every PR, people add entries.</p>
<p>Everything else — emoji, semver discipline, contributor attribution — is texture. If you don't have the three above, the texture doesn't matter.</p>
`,
  },
  {
    slug: "boring-go-services-in-2025",
    title: "Boring Go services in 2025",
    date: "2025-09-02",
    tags: ["go", "ops", "observability"],
    excerpt:
      "A short list of decisions I keep making for every new Go service, and why I stopped second-guessing them.",
    body: `
<p>I keep starting new Go services. They keep being mostly the same. After enough rounds I made a checklist, and now every service starts with these decisions already settled. None of them are clever. That's the point.</p>
<ol>
  <li><strong>One module, one binary.</strong> Not a monorepo with sub-modules. Not a "shared lib" pulled in from a sibling repo. One <code>go.mod</code>, one <code>cmd/server</code>.</li>
  <li><strong><code>log/slog</code>, not zap, not zerolog.</strong> The standard library is good enough now. The handler is the only piece worth customising.</li>
  <li><strong>Config via env vars, parsed once at startup.</strong> No hot-reload. If you need different config, restart the process.</li>
  <li><strong>Health checks: <code>/livez</code> always returns 200, <code>/readyz</code> reflects real dependencies.</strong> Don't conflate them.</li>
  <li><strong>Graceful shutdown with a deadline.</strong> <code>context.WithTimeout</code> on <code>http.Server.Shutdown</code>. If you can't drain in 30s, you have bigger problems.</li>
  <li><strong>Metrics over logs for hot paths.</strong> Logs are for events. Metrics are for rates. Don't log every request.</li>
</ol>
<p>The rest is just business logic. Most outages I've shipped came from the parts I tried to make clever. Nothing on this list is clever.</p>
`,
  },
  {
    slug: "sqlite-as-a-job-queue",
    title: "SQLite as a job queue, three years later",
    date: "2025-06-21",
    tags: ["sqlite", "queues", "postmortem"],
    excerpt:
      "Yes, it still works. No, you don't need Redis. Here's what broke, what didn't, and the one knob I wish I'd turned earlier.",
    body: `
<p>Three years ago I replaced a Redis-backed worker queue with a single SQLite table and a five-line "claim a job" query. The whole migration took an afternoon. I've been quietly waiting for it to fall over ever since.</p>
<p>It hasn't.</p>
<h2>The schema</h2>
<pre><code>CREATE TABLE jobs (
  id      INTEGER PRIMARY KEY,
  kind    TEXT NOT NULL,
  payload BLOB NOT NULL,
  state   TEXT NOT NULL DEFAULT 'pending',
  run_at  INTEGER NOT NULL,
  claimed_by TEXT,
  attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX jobs_pickup ON jobs(state, run_at);</code></pre>
<h2>The claim</h2>
<pre><code>UPDATE jobs SET state='running', claimed_by=?
WHERE id = (
  SELECT id FROM jobs
  WHERE state='pending' AND run_at &lt;= unixepoch()
  ORDER BY run_at LIMIT 1
)
RETURNING *;</code></pre>
<p>That's the whole queue. WAL mode, a single writer, however many readers you want.</p>
<h2>The one knob</h2>
<p>The thing I wish I'd done earlier was set <code>PRAGMA busy_timeout = 5000</code> on every connection. Without it, the moment two workers race the claim query you get <code>SQLITE_BUSY</code> and one of them retries instantly, which makes the contention worse. With it, the engine just waits, and throughput stops being spiky.</p>
<h2>When this stops being enough</h2>
<p>If you're past ~500 jobs/sec sustained or your jobs are large blobs, switch to something built for the job. Below that, the answer is almost always "just use SQLite and stop reading hacker news."</p>
`,
  },
  {
    slug: "rust-async-without-tears",
    title: "Async Rust without the tears",
    date: "2025-03-10",
    tags: ["rust", "async", "patterns"],
    excerpt:
      "I stopped trying to be clever with traits and Pin and life got better. A short reflection on six months of writing async Rust for a living.",
    body: `
<p>I spent the first three months of my last contract fighting the type system. The next three I spent un-fighting it. Almost every async Rust mistake I've made traces back to the same root cause: I tried to express something polymorphically when a concrete type would have been fine.</p>
<h2>Things I stopped doing</h2>
<ul>
  <li>Returning <code>impl Future&lt;Output = ...&gt;</code> from trait methods unless I really needed dyn dispatch. <code>async fn</code> in traits is fine now.</li>
  <li>Wrapping everything in <code>Arc&lt;Mutex&lt;_&gt;&gt;</code> by default. Nine times out of ten the right answer is to give the value to one task and message it.</li>
  <li>Reaching for <code>tokio::select!</code> when a plain <code>tokio::join!</code> works. Cancellation safety is harder than it looks.</li>
</ul>
<h2>Things I started doing</h2>
<ul>
  <li>Using <code>tokio::task::JoinSet</code> for fan-out. It owns the handles and cleans up on drop. Stop hand-rolling vectors of <code>JoinHandle</code>.</li>
  <li>Passing channels around instead of locks. <code>tokio::sync::mpsc</code> is the answer to surprisingly many shared-state questions.</li>
  <li>Writing the synchronous version first, even if it's a unit test. If I can't model the data flow without async I'll never untangle it with async.</li>
</ul>
<p>None of this is novel. It's just the advice I wish someone had repeated to me until I listened.</p>
`,
  },
  {
    slug: "what-i-changed-my-mind-about",
    title: "What I changed my mind about this year",
    date: "2024-12-30",
    tags: ["meta", "career"],
    excerpt:
      "End-of-year list of opinions I held confidently in January and quietly abandoned by December. Worth the embarrassment.",
    body: `
<p>I keep a small text file called <code>opinions.md</code> in my dotfiles. Every December I diff it against last year's copy. Here's what moved in 2024.</p>
<h2>"Monorepos are always worth it."</h2>
<p>I still like monorepos for tightly coupled services. I no longer think they're the default. The cost of build tooling and CI complexity is real, and most three-person teams don't have the bandwidth to absorb it.</p>
<h2>"You should always write integration tests against a real database."</h2>
<p>Mostly true, but I now reach for testcontainers <em>and</em> a fast in-memory fake. The fake catches 80% of bugs in milliseconds. The container catches the rest in seconds. Don't pick one.</p>
<h2>"Static typing always pays for itself."</h2>
<p>Still my default. But I've watched smart teams ship faster in dynamic languages by skipping the modelling phase entirely, and I no longer believe the productivity gap goes the way I assumed.</p>
<h2>"Self-hosting is character building."</h2>
<p>Replaced my self-hosted email server with a paid provider this summer. My weekends came back. Character is overrated.</p>
`,
  },
  {
    slug: "small-tools-i-actually-use",
    title: "Small tools I actually use every day",
    date: "2024-10-04",
    tags: ["tools", "uses"],
    excerpt:
      "Not a list of things I tried once. A list of things I'd be sad to lose.",
    body: `
<p>Every "uses" page on the internet lists a hundred apps. This is a shorter list. Things I'd notice within a week if they disappeared.</p>
<ul>
  <li><strong>ripgrep.</strong> I haven't typed <code>grep -r</code> in five years.</li>
  <li><strong>fd.</strong> Same idea, for filenames. <code>find</code> is for shell scripts, not humans.</li>
  <li><strong>jq.</strong> Worth learning the language properly. The query you wanted is almost always one operator away.</li>
  <li><strong>delta.</strong> Side-by-side diffs in git that don't make my eyes hurt.</li>
  <li><strong>direnv.</strong> Per-directory env vars, no shell hooks I have to remember.</li>
  <li><strong>just.</strong> A makefile that doesn't pretend to be a build system.</li>
  <li><strong>watchexec.</strong> Re-run a command on file changes. Better than every framework's built-in watcher I've used.</li>
</ul>
<p>That's it. The interesting tool is the one you've used every day for two years and still couldn't replace.</p>
`,
  },
];

export function findPost(slug) {
  return POSTS.find((p) => p.slug === slug) || null;
}

export function findProject(slug) {
  return PROJECTS.find((p) => p.slug === slug) || null;
}
