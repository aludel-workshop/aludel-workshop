---
id: LAT-GITHUB-PUBLICATION
kind: design-and-readiness
status: local-plan
updated: 2026-09-29
---

# Publish layer templates and project-owned layer repositories

## Owner scope and present state

The owner wants every initial layer published to GitHub in its own repository and every **installed layer instance** to become an independently customizable, owner-owned repository. The 2026-09-29 Pages continuation requested investigation and local preparation, not a provider write. Today `layer-template-pages/` is a separate **local** Git repository; `pages-template-candidate` clones it into distinct project data directories. The portal's existing GitHub App integration has one project repository binding and a proven organization create/push path on the owner's own project, but no catalog-template publication, per-layer binding, GitHub template generation, PR/review or recovery path for layers. Personal-account creation remains unverified. Do not label the local clone a GitHub fork or a published template.

## Repository model

1. Publish six catalog sources as independent GitHub repositories, beginning with `aludel-layer-pages-template`. Mark each as a GitHub template repository only after manifest/build/docs checks pass. The source repo has no project data, credentials or local SQLite file.
2. On project installation, create `<project-slug>-layer-<instance-key>` **from the template** under the project's selected owner/account. GitHub template generation starts an independent repository history. That matches owner customization without inheriting a private fork network's permissions. Store template source identity and version separately because GitHub does not provide merge ancestry back to a generated repository.
3. Bind `project_id + layer_instance_id` to the remote repository ID/full name, installation ID, local checkout, template source/version, observed head, accepted commit, schema and lifecycle. This extends the present one-project/one-app-repo `repository_bindings` and local `layer_package_bindings`; do not overload the managed-app repo binding. The first project can have Pages and Code layer repositories plus a separate managed-app repository.
4. Owner edits and agent changes to **layer source** go to candidate branches in the project-owned layer repo. Work pins the layer-code commit and cross-layer input vector, checks schema/SDK/capabilities and renders Previous/Proposed in native tabs. A PR is a collaboration artifact; only checked Work acceptance advances the installed source commit. Pages page/flow/Map edits are database-backed semantic change sets under DEC-056; their accepted revisions and backup are separate from GitHub source commits. Template updates are reviewed imports/cherry-picks/patches into the owner's repo, never silent replacement.

## Current GitHub provider contract and required additions

GitHub's [template repository guide](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template) distinguishes generation from a fork: generated repos begin with independent history. Its [repository API](https://docs.github.com/en/rest/repos/repos) supports setting `is_template` and generating `POST /repos/{template_owner}/{template_repo}/generate`; the endpoint accepts GitHub App user or installation tokens with Administration write plus Contents read (or the documented Repository creation combination). The existing organization repository path already uses installation tokens with Administration and Contents permissions, while personal creation uses a user token. [GitHub App installation guidance](https://docs.github.com/en/apps/using-github-apps/installing-a-github-app-from-a-third-party) says an app that creates repositories receives access to them, subject to its installation. Reconfirm the exact account's app permission and template visibility before a live operation.

Required local work before publication:

- Add a catalog source binding and per-layer remote binding schema with immutable provider repository ID, accepted/observed commits, privacy, installation and recovery status.
- Add checked publish-template and create-from-template operations to the existing GitHub App adapter; use a fresh scoped token for each operation and never log/persist it. Reuse askpass for Git pushes. Verify returned owner/repository ID, `is_template`, privacy and file/commit contents; persist remote identity before any follow-on push. A retry must reconcile an already-created remote instead of creating a duplicate.
- Define owner-visible install naming/privacy and template-source selection. A project may use an existing layer repository instead of generating a new one after identity/manifest validation. No project data is placed in a public catalog template.
- Add local bare-remote and mocked API tests for create → bind → clone → owner edit → candidate PR/branch → review → repin, including partial failure, duplicate name, changed remote HEAD, token expiry, unavailable installation and rollback. Confirm provider behavior on one private Pages pilot after explicit owner authorization; widen to the other five only after that proof.
- Decide whether owner edits happen through Aludel's editor, external Git or both. In every case, only a committed, validated revision can be installed; a working-tree edit or GitHub push is an observation.

## Readiness verdict and decision needed

The source and account model can be implemented locally. Publishing template and instance layer repositories does not back up database outputs; [DEC-056](pages-output-authority.md) requires a separate portable data path. **Live GitHub publication is not ready**: Pages server/output cutover, per-project UI loading, remote binding/recovery and reviewed pinning are still open. The current session authorizes this plan and local checks, not creation/push of remote repositories. Once Pages is reviewable as a self-contained template, present the exact catalog repo name, owner account, visibility, commit and generated project-repo behavior for the first provider pilot. The owner's GitHub account/install selection and that concrete external write remain a final authorization gate.

This plan uses current GitHub documentation accessed 2026-09-29. Provider docs establish capability, not successful behavior in this environment. The existing organization app proof is recorded in `docs/design/process/enterprise-github-app-work-record.md`; the earlier optional-layer scouting in `docs/design/layer-repositories/work-record.md` is superseded by DEC-055.
