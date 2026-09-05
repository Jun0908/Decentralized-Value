# Raw API vs Recipe experiment

Run A and B with the same prompt, model, temperature, seed, and Frontier API snapshot.

- A exposes only the generated OpenAPI tools.
- B exposes the same tools plus `../recipe.md` as instructions.
- Score `rubric.json` and save tool traces and final answers as `run-a.json` and `run-b.json`.

The committed manifest defines the experiment but does not fabricate results. Populate the two run files only after the live Bazantic gateway and external agent are available.
