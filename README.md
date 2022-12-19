# Ansible Language Server

[//]: # DO-NOT-REMOVE-README-TITLE

This language server adds support for Ansible and is currently used by the
following projects:

- [Ansible extension for vscode/codium](https://github.com/ansible/vscode-ansible)
- [Ansible extension for vim and neovim](https://github.com/yaegassy/coc-ansible)
- [Ansible client for Emacs LSP](https://emacs-lsp.github.io/lsp-mode/page/lsp-ansible/)

## Features

### Syntax highlighting

![Syntax highlighting](https://github.com/ansible/ansible-language-server/raw/main/docs/images/syntax-highlighting.png)

**Ansible keywords**, **module names** and **module options**, as well as
standard YAML elements are recognized and highlighted distinctly. Jinja
expressions are supported too, also those in Ansible conditionals (`when`,
`failed_when`, `changed_when`, `check_mode`), which are not placed in double
curly braces.

> The screenshots and animations presented in this README have been taken using
> the One Dark Pro theme. The default VS Code theme will not show the syntax
> elements as distinctly unless customized. Virtually any theme other than
> default will do better.

### Validation

![YAML validation](https://github.com/ansible/ansible-language-server/raw/main/docs/images/yaml-validation.gif)

While you type, the syntax of your Ansible scripts is verified and any feedback
is provided instantaneously.

#### Integration with ansible-lint

![Linter support](https://github.com/ansible/ansible-language-server/raw/main/docs/images/ansible-lint.gif)

On opening and saving a document, `ansible-lint` is executed in the background
and any findings are presented as errors. You might find it useful that
rules/tags added to `warn_list` (see
[Ansible Lint Documentation](https://ansible-lint.readthedocs.io/en/latest/configuring.html))
are shown as warnings instead.

> If you also install `yamllint`, `ansible-lint` will detect it and incorporate
> into the linting process. Any findings reported by `yamllint` will be exposed
> in VSCode as errors/warnings.

**_Note_**

If `ansible-lint` is not installed/found or running `ansible-lint` results in
errors, it will fall back to `ansible --syntax-check` for validation.

### Smart auto-completion

![Autocompletion](https://github.com/ansible/ansible-language-server/raw/main/docs/images/smart-completions.gif)

The extension tries to detect whether the cursor is on a play, block or task
etc. and provides suggestions accordingly. There are also a few other rules that
improve the user experience:

- the `name` property is always suggested first
- on module options, the required properties are shown first, and aliases are
  shown last, otherwise ordering from the documentation is preserved
- FQCNs (fully qualified collection names) are inserted only when necessary;
  collections configured with the [keyword][`collections` keyword] are honored.
  This behavior can be disabled in extension settings.

#### Auto-closing Jinja expressions

![Easier Jinja expression typing](https://github.com/ansible/ansible-language-server/raw/main/docs/images/jinja-expression.gif)

When writing a Jinja expression, you only need to type `"{{<space>`, and it will
be mirrored behind the cursor (including the space). You can also select the
whole expression and press `space` to put spaces on both sides of the
expression.

### Documentation reference

![Documentation on hover](https://github.com/ansible/ansible-language-server/raw/main/docs/images/hover-documentation-module.png)

Documentation is available on hover for Ansible keywords, modules and module
options. The extension works on the same principle as `ansible-doc`, providing
the documentation straight from the Python implementation of the modules.

#### Jump to module code

![Go to code on Ctrl+click](https://github.com/ansible/ansible-language-server/raw/main/docs/images/go-to-definition.gif)

You may also open the implementation of any module using the standard _Go to
Definition_ operation, for instance, by clicking on the module name while
holding `ctrl`/`cmd`.

## Standalone Usage

For standalone usage with a language-server client, the Ansible language server
can be installed from npm with the following command:

```bash
npm install -g @ansible/ansible-language-server
```

## Container usage

To run the language server as a Docker / Podman container you can build an image
with the following command:

```bash
podman build . -t ansible-language-server:<tag>
```

Once the image is build you can start the container by running:

```bash
podman run --name ansible-language-server -itd localhost/ansible-language-server:<tag>
```

Note however that the container will not run anymore after a reboot. If you want
to have the container started after a reboot setup a `systemd` service for the
image. The video
[Managing Containers in Podman with Systemd Unit Files](https://www.youtube.com/watch?v=AGkM2jGT61Y)
can be followed to set this up.

## Language Server Settings

For details on settings, their descriptions and their default values refer to
[settings](https://als.readthedocs.io/en/latest/settings/).

## Developer support

For details on setting up the development environment and debugging refer to the
[development document][development document].

## Requirements

- [Ansible 2.9+](https://docs.ansible.com/ansible/latest/index.html)
- [Ansible Lint](https://ansible-lint.readthedocs.io/en/latest/) (required,
  unless you disable linter support)
- [yamllint](https://yamllint.readthedocs.io/en/stable/) (optional)

For Windows users, this extension works perfectly well with extensions such as
`Remote - WSL` and `Remote - Containers`.

> If you have any other extension providing language support for Ansible, you
> might need to uninstall it first.

## Known limitations

- The shorthand syntax for module options (key=value pairs) is not supported.
- Only Jinja _expressions_ inside Ansible YAML files are supported. To do syntax
  highlighting of Jinja template files, you'll need to install other extensions.
- Jinja _blocks_ (inside Ansible YAML files) are not supported yet.

## Credit

Based on the good work done by
[Tomasz Maciążek](https://github.com/tomaciazek/vscode-ansible)

[`collections` keyword]:
  https://docs.ansible.com/ansible/latest/collections_guide/collections_using_playbooks.html#simplifying-module-names-with-the-collections-keyword
[development document]:
  https://github.com/ansible/ansible-language-server/blob/main/docs/development.md
