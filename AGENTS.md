# Résumé management — standing user instructions

The authoritative résumé project lives in this repository at `resume/latex/`.
Edit `resume/latex/onepage.tex` and its assets, then rebuild the PDF with pdfLaTeX.
Never edit a résumé PDF directly or treat Desktop/ChatGPT copies as independent sources.
The Desktop/CV path is a local symlink to this project for compatibility.
`main.tex` and `version2.tex` are historical sources, not the current résumé.

## General updates

Use the general résumé on `master`. Rebuild from LaTeX, inspect the rendered PDF,
check the requested wording and PDF links, and update `resume/Dylan_Moore_Resume.pdf`.
Update all three PDF revision tags in `resume/index.html` to a fresh value.
Commit the source, assets, generated public PDF and link changes together; push to
`origin/master` to publish through GitHub Pages. Check that the deployment for the
new commit succeeds and that a freshly downloaded live PDF matches the local public
PDF before calling it live. A successful push alone does not verify publication.
For résumé-only changes, run focused résumé/build/link checks; do not run the
unrelated website-wide browser suite. Preserve unrelated website content.

## Tailored applications

For a one-off role/company-specific résumé, create a descriptive branch such as
`resume/company-role` from the current general résumé. Prefer a separate worktree
so the main website checkout stays on `master`. Keep tailored LaTeX and its rebuilt
PDF together on that branch. Commit both for version history and push the branch
when saving remotely. Do not merge tailored content into `master` or replace the
public résumé unless the user specifically asks. General improvements discovered
while tailoring can be applied separately to the general résumé when requested.

See `resume/latex/README.md` for build and verification commands.
