# Journeys

A journey is the steps a person takes through the app to get something done, such as signing up or starting a first world. Each journey names who takes it (a persona); each step names its route, what triggers it, what they should see, and the test that proves it. Journeys live in `outputs/journeys.json`.

Journeys are written once and everything else comes from them:

- **Review** walks a journey step by step in the preview, entering it as the journey's persona.
- **Work** claims journey steps instead of hand-written criteria. Implementing a journey change claims the added and changed steps.
- **Tests** prove steps. A step's test is named `<file>.spec.mjs#<test id>` and lives in `journeys/` in this package. It is a black-box browser test: it drives the running app and never imports its code.

## Writing a step test

`journeys/<file>.spec.mjs` default-exports an object of tests keyed by test ID:

```js
export default {
  async signup({ page, assert, step, baseURL }) {
    await page.getByLabel('Email').fill('new@example.invalid');
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.getByRole('heading', { name: 'Name your world' }).waitFor();
  }
};
```

- Aludel runs the tests for review in a separate browser container whose only network is the candidate's preview. A test can't reach the internet, and it shouldn't try.
- A journey is walked from its first step. Aludel enters it as the journey's persona: it calls the app's preview setup with the persona's fixture and session, then opens the step's route. Later steps continue where the previous step left the page. A test may navigate itself (`page.goto(step.route)`).
- Each step records passed, failed, skipped (an earlier step failed), no test, or no fixture, with a screenshot. `page` uses a 10-second default timeout, and a step has 30 seconds.
- `page` is Playwright's page, and `assert` is Node's strict assert. Import nothing else: the test runs outside the app, against whatever stack the app uses.

## Where a journey comes from

- **Authored**: someone specified it and a person signed it through Work.
- **Observed**: reconstructed from how the app behaves now. It counts as observed only while a characterization run passed at the current commit (`proof`). Otherwise it is a hypothesis.
- **Replica**: imported from the layer that is the authority for the app's journeys, such as Pages' flows. It names its source entry and revision. Change it at the authority.

## Rules

- A journey's `id` and its steps' `id`s are lowercase and stable. When a step is added, it gets a new ID; existing steps keep theirs, even when reordered.
- A revision moves one at a time. What changed is worked out by step ID: added, changed, removed or unchanged. A step's test is its proof, not its spec, so changing only the test isn't a change to the journey.
- A journey keeps one persona. Set it on the journey; a step may repeat it but never names another. A flow that crosses roles (an owner sends an invite, a member accepts it) is one journey per persona.
- Personas are IDs. `review.json` maps each persona to the fixture (and, when signed in, the session) the preview enters it with.
- Changing a journey is two pieces of Work: specify the new steps, then implement them. An existing app's journey is first recorded as observed, proven by a characterization test that passes on `main`.
