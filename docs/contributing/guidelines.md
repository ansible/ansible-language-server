<!-- markdownlint-disable first-line-heading -->

```{include} ../../.github/CONTRIBUTING.md

```

# Contributing docs

We use [Sphinx][sphinx] to generate our docs website. You can trigger the
process locally by executing `task docs`:

It is also integrated with [Read The Docs][rtd] that builds and publishes each
commit to the main branch and generates live docs previews for each pull
request.

The sources of the [Sphinx][sphinx] documents use reStructuredText as a de-facto
standard. But in order to make contributing docs more beginner-friendly, we have
integrated [MyST parser][myst] allowing us to also accept new documents written
in an extended version of Markdown that supports using Sphinx directives and
roles. {ref}`Read the docs <myst:intro/writing>` to learn more on how to use it.

[myst]: https://pypi.org/project/myst-parser/
[rtd]: https://readthedocs.org
[sphinx]: https://www.sphinx-doc.org
