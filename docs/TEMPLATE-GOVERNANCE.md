<!-- Benchmark: .research/notion-monday.md A1 (highest priority), A2, A3, A4 -->
<!-- ai-project-ops.template-governance/1.0 | master, do not edit instances -->
# Template governance (master -> instance -> Publish)

> This is a MASTER. `node scripts/scaffold.js` creates an INSTANCE from it.
> Editing this master affects FUTURE instances only. It never rewrites an
> existing instance. That is the rule Monday's Managed templates got right and
> Notion's database templates state explicitly; our earlier templates had no
> such rule, so a template change silently lost local customisations.

## 1. Three objects, never confused

| object | definition | who may change it |
|---|---|---|
| Master | this file, versioned in `templates/` | owner only |
| Instance | the working copy in `docs/`, created once | the human / AI working the project |
| Publish | the act of promoting a new master version | `publish_role = owner` only (A2: member may Edit, not Publish) |

## 2. Registry row (one per master)

| field | meaning |
|---|---|
| `id` | stable slug, never renamed |
| `master` / `instance` | exact paths |
| `version` | semver of the master |
| `publish_role` | owner or member |
| `default_properties` | fields a NEW instance starts with (A4) |
| `benchmark` | the research item this master came from |

`templates/registry.json` is the single source. A master absent from the
registry is NOT publishable.

## 3. Lifecycle rules

1. Create: `node scripts/scaffold.js`. Write `docs/evidence/template-lock.json`
   with master path + version + timestamp.
2. Edit: change the INSTANCE. The lock keeps pointing at the master version
   it came from.
3. Upgrade master: `node scripts/scaffold.js --publish <id>` bumps the patch
   version and records the publish event. Existing instances keep their old
   version; `--status` reads the lock and reports IN-SYNC / DRIFT / NO-LOCK /
   PRE-EXISTING. Use `--all` to instantiate every registered master.
4. Reconcile: a human decides, line by line, whether to copy an upgrade into
   an existing instance. Never automatic (A4: only affects future instances).
5. Publish: `node scripts/scaffold.js --publish <id>`. Refused unless
   `publish_role = owner`. It is a REAL version bump, not a print statement.

## 4. Discovery metadata (Notion A3)

Each master declares: purpose, audience, default properties, benchmark
source, version, and one falsifiable acceptance criterion. A template without
an acceptance criterion is decoration, not a template.

## 5. Falsifiable acceptance (adversarial, not a checkbox)

- Delete the registry row for a master. `scripts/benchmark-adoption.js` MUST
  FAIL. If it still passes, the registry is not wired.
- Edit a master then re-run scaffold on an existing instance. The instance
  bytes MUST be unchanged. If they changed, the no-overwrite rule is broken.
- Set `publish_role = member` and call `--publish`. The command MUST refuse.
