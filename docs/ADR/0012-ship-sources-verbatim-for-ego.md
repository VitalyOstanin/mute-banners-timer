# 0012 - Ship sources verbatim to e.g.o, no comment stripping

Status: Accepted

## Context

The code keeps short comments that explain "why" with references to ADRs. A
question was raised whether the packaging step for extensions.gnome.org (e.g.o)
should strip comments from the JS to ship leaner files.

The extensions.gnome.org review guidelines require human-readable, unobfuscated
source: minified or machine-transformed code is rejected because reviewers read
the sources by hand. That rules out any tool that reformats or rewrites the code
(terser and other minifiers), so a "clean" strip would have to remove only the
comment tokens while leaving every other byte untouched.

In a project with no Node toolchain there is no reliable way to do that:

- A regex strip risks corrupting string literals and `//` sequences inside URLs
  or strings.
- An AST-based tool (acorn/espree/babel) removes comments correctly but
  regenerates the source, which reformats it — exactly what e.g.o forbids.

So no available method removes comments cleanly without either risking
corruption or reformatting the file.

## Decision

Ship the JS sources verbatim to e.g.o, including comments. Do not add a
comment-stripping step to packaging. Packaging stays the plain
`gnome-extensions pack` over the repository sources.

## Consequences

- The published archive matches the repository sources, which is what e.g.o
  reviewers expect and easiest to audit.
- Comments stay minimal by the existing code-style rule, not by a build step, so
  there is nothing extra to maintain or to break the build.
- If the project later adopts a Node toolchain for other reasons, revisit only if
  a comment-only transform that preserves formatting becomes available and e.g.o
  still accepts the result.
