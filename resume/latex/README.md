# Authoritative résumé project

Current source: `onepage.tex`. Required image assets are in `images/`.
Public output: `../Dylan_Moore_Resume.pdf`.
The general résumé says “UX researcher and engineer”; wildkittens.com references
were removed in November 2026. Preserve these choices unless asked otherwise.

This project was moved from `~/Desktop/CV` on November 9, 2026. That old path is
now a symlink to this directory, not another copy. Older ChatGPT exports (including
`CV_product_manager`) are historical derivatives, not the source for future edits.
`main.tex` and `version2.tex` are older layouts retained for history. Existing local
PDF exports and build debris are ignored by Git; they are not authoritative.

## Build

Use pdfLaTeX (TeX Live/MacTeX), not XeLaTeX: this source uses pdfTeX Unicode mapping.
Run from this directory:

```sh
mkdir -p build
pdflatex -interaction=nonstopmode -halt-on-error -output-directory=build onepage.tex
pdflatex -interaction=nonstopmode -halt-on-error -output-directory=build onepage.tex
```

Inspect `build/onepage.pdf` visually and check extracted text and hyperlinks before
promoting it. Confirm it still fits on one page unless a layout change is intended.

```sh
cp build/onepage.pdf ../Dylan_Moore_Resume.pdf
```

For a general update, change all three `revision=` values in `../index.html` to
the same fresh value (for example a date plus a short change label). Commit the
LaTeX, assets, public PDF and redirect together. GitHub Pages publishes `master`.
Wait for the deployment of that commit to succeed, then download the public PDF
using the new revision URL and compare its bytes with `../Dylan_Moore_Resume.pdf`.
Do not mistake a cached browser tab or a completed push for verified publication.

For a role-specific version, follow the branch workflow in the root `AGENTS.md`.
Keep the compiled deliverable at `resume/Dylan_Moore_Resume.pdf` on that branch;
that path is tracked, while intermediate build outputs here are ignored. Publishing
a tailored branch is not required and must not replace the general website résumé.
