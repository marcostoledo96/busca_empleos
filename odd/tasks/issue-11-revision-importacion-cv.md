# Issue #11 — CV import review

## Authorization and scope
Marcos authorized implementation, tests/build, commits, push and ONE PR to master; no merge or manual issue closure. Base: d8cbd86e662dadac0e367dea1a479b57711958df. Branch: fix/issue-11-revision-importacion-cv. Isolated worktree protects unrelated changes. Delivery strategy: single-pr (explicit user selection); estimated 500–700 authored diff lines including tests, review workload disclosed. No matching changes, paid APIs, production DB, new infrastructure or CV history.

## Brief SDD plan (fallback)
Dedicated SDD agents unavailable; read-only gentle-ai-explore provided combined exploration/init/proposal/spec/design/tasks. Execute automatically with available worker and independent verifier. One client-side draft holds editable facts and questions with unique local IDs. Handlers use IDs, not filtered indices/duplicate fields. Apply transfers reviewed draft only; Save remains explicit. Cancel discards temporary state only. Persist answers/notes/statuses through existing JSONB without migration. Preserve omitted/null/empty extraction compatibility, stale request guards, and protected manual salary/search/roles/exclusions/platform criteria. Show add/modify/preserve summary with existing UI. Backend persisted effective profile remains authoritative.

## Acceptance
AC1: isolated draft and exact reviewed apply; Docker advanced corrected to basic survives.
AC2: mixed informative/actionable questions and duplicate fields target correct stable identity, including DOM clicks.
AC3: pending/answered/applied/ignored/note meanings are explicit; answers and saved notes survive apply/save/reload, plain ignore saves no extra information.
AC4: salary cannot alter experience; React Native cannot invent experience; support cannot alter professional facts.
AC5: absent salary and suggested search preferences preserve manual decisions unless explicitly accepted.
AC6: cancel preserves preexisting manual edits; stale analyses cannot overwrite current review.
AC7: partial extraction absent/null/empty compatibility and confirmed questions are preserved.
AC8: component -> real service -> simulated HTTP backend -> save/reload matches effective persisted profile; #7–#10 regressions remain green.

## Tasks
- [x] T1 (completed, delegated worker): draft/identity/review UI and focused tests/docs. Observed behavioral RED (4 failures), GREEN 43/43 ChromeHeadless tests; git diff --check clean. Commit identity recorded after work-unit commit below.
- [ ] T2 (in progress, delegated worker): persistence roundtrip and regression coverage, full suites/build and docs evidence. Trigger: integration tests/multiple files. Commit pending.
- [ ] T3 (pending, parent authority + independent verifier): inspect diff, native RDD under enabled user switch, publish single PR, query CI once. No merge.

## Verification commands
Frontend focused: npm test -- --watch=false --browsers=ChromeHeadless --include=src/app/paginas/preferencias/preferencias.spec.ts
Backend focused: NODE_ENV=test npm test -- --runInBand tests/controladores/importacion-cv.test.js tests/controladores/controlador-preferencias.test.js tests/modelos/preferencia-perfil.test.js
Full: backend NODE_ENV=test npm test -- --runInBand; frontend npm test -- --watch=false --browsers=ChromeHeadless; frontend npm run build.
No live DeepSeek or production DB. Isolated DB integration only if available; otherwise report NOT RUN and CI evidence.

## Evidence and next step
origin/master revalidated matches base; no open PRs at preparation. Existing original working tree untouched. Exploration found handlers using filtered indices and suggestions mutating form before Apply. Scout generated out-of-scope .atl registry modifications: excluded from staging. Skills resolved from active Pi registry. T1 complete: UUID question identity, cloned editable extraction draft, controlled Docker/salary/support actions, persisted response/note statuses, protected manual preferences and review summary. Native sdd-attempt unavailable (unknown command); no attempt ledger fabricated. Initial test environment unavailable; synthetic ignored environment.ts and ignored node_modules reuse authorized, actual behavioral RED then GREEN observed. Forecast now 575 authored lines T1; single PR unchanged. Proceed T2.
