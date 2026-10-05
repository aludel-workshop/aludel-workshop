# Code

## Purpose

A reference for how the app's code fits together and connects to everything else. Nobody does their coding here: code is written in the tools developers already use. This layer makes the code visible from the rest of the project and the rest of the project visible from the code.

## Contents and scope

- **The codebase itself.** This layer's repository is the app's repository. Its files outside `.aludel/` are the app's own; this layer's output is the codebase, and accepted Code Work changes it.
- **Code units**: the functions, components, handlers, tables and tests in the code, read at a commit. They are derived, never edited here.
- **Releases**: versions made on purpose from one commit.
- **Journeys**: the steps people take through the app, each proven by a test. Review steps and Work claims come from them. A journey is authored here, observed from the app, or a replica of the journey authority's flows.
- **Aludel stays separable.** Everything Aludel adds lives in `.aludel/`. Whatever must touch the app outside it is a declared seam, and the app never reads `.aludel/` at runtime.
- **The app's docs** (`AGENTS.md` as the map, `docs/`) are this layer's Knowledge. Developers own them.

Environments, hosting, variables' values and integrations belong to Deploy. Stories, pages, data contracts and the design kit belong to their layers; this layer links to them through the Library.

## Methodology

- Read the code, never type what it already says: the stack comes from the manifests, units from the parser.
- A change to the code is Work in this layer, reviewed by an elevated reviewer before it merges into `main`.

## Output conventions and taxonomy

- Aludel's work carries an `Aludel-Work:` trailer.
- Versions are `MAJOR.MINOR.PATCH`, each newer than the last.

## Quality bar

Every unit is reachable or explained, and every journey step that matters has a test.

## Role in the project

The bridge from intent to running software: what the other layers asked for, where it is in the code, and which release ships it.

## How this layer works with others

It reads stories, personas, Data objects and operations, and the app kit from the Library, through its own adapter. It publishes units, releases and journeys. Deploy promotes its releases.
