<!-- Benchmark: .research/clickup-asana-motion.md A3 (Asana per-action approval matrix) + docs/competitive-synthesis.md B1 / claim 2 -->
<!-- ai-project-ops.approval-matrix/1.0 -->
# Per-action approval matrix

> Instantiate with `node scripts/scaffold.js` (registry id `approval-matrix`).
> STATUS OF THE SHIP: this master is a SPECIFICATION. The panel currently has
> ACK approve/reject with a mandatory written reason, but NOT a per-action
> matrix. Do not claim B1 is implemented until this table is wired to an API.

## 1. Why a matrix, not a confirm dialog

From `docs/competitive-synthesis.md:34-52`: competitors check permissions or
show a yes/no preview. A yes/no confirm is not a judgement with a rationale.
Every row below therefore requires a WRITTEN reason on rejection and stores it
as a PDCA entry.

## 2. Matrix (one row per action class)

| action | actor | gate | required evidence | on reject |
|---|---|---|---|---|
| edit task dates / status | AI | none (optimistic + PUT) | pasted PUT result | n/a |
| change a frozen artifact | anyone | **VETO (E07)** | new freeze id + new hashes | round VOID |
| close an ACK | human only | approve / reject | decision + reason if reject | `rejections.json` entry |
| publish a template master | owner only | `--publish` role check | registry version bump | refuse |
| spend tokens on an automated probe | measured on/off | section 6 probe | measured result | stay off |
| change the scoreboard | main session | ledger append | pasted command output | n/a |
| delete a status column with tasks | human | explicit list of moved tasks | fallback column name | n/a |

## 3. Mandatory written reason

A rejection without a reason is E01-equivalent: required evidence is absent.
The reason lands in `data/rejections.json` and is referenced by name in later
briefs. No free-text-only "looks wrong"; state which criterion failed.

## 4. Falsifiable acceptance (adversarial)

- Let an AI call the approve endpoint: MUST fail.
- Reject with an empty reason: MUST fail.
- Edit a frozen document and still get a PASS: MUST fire the E07 veto.
- If removing one matrix row does not change any check, the row is decorative.
