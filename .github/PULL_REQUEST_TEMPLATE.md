## What / Why / How

<!-- Describe the concrete behavior or documentation change. Link the fork issue if applicable. -->

## Codex and OS impact

- [ ] Codex runtime or hooks
- [ ] Local setup / packaging / documentation
- [ ] Windows
- [ ] Linux
- [ ] macOS

## Validation

<!-- List actual commands/results. Report existing failures, skips and unrun checks. -->

- [ ] Typecheck and build checked
- [ ] Affected tests checked; security assertions preserved
- [ ] Node.js >= 22.5.0 documentation and runtime contract preserved
- [ ] Local launcher/hooks pin the reviewed fork
- [ ] No Windows path, storage or thread-isolation regressions
- [ ] Links and docs updated where needed

Use quoted paths and path.join/path.resolve in code. Shell examples must name their required shell; Bash syntax is not portable to PowerShell. Preserve LICENSE and upstream attribution. Do not claim local pilot, hook trust, rollout or cross-OS validation without running it.
