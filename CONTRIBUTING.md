# Contributing to MCP Prompt Manager

First off, thanks for taking the time to contribute! ❤️

All types of contributions are encouraged and valued. See the [Table of Contents](#table-of-contents) for different ways to help and details about how this project handles them. Please make sure to read the relevant section before making your contribution. It will make it a lot easier for us maintainers and smooth out the experience for all involved. The community looks forward to your contributions.

## Table of Contents

- [I Have a Question](#i-have-a-question)
- [I Want To Contribute](#i-want-to-contribute)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Enhancements](#suggesting-enhancements)
- [Your First Code Contribution](#your-first-code-contribution)
- [Improving The Documentation](#improving-the-documentation)
- [Styleguides](#styleguides)
- [Commit Messages](#commit-messages)

## I Have a Question

If you want to ask a question, we assume that you have read the available [Documentation](README.md).

Before you ask a question, it is best to search for existing [Issues](https://github.com/CarlLee1983/mcp-prompt-manager/issues) that might help you. In case you have found a suitable issue and still need clarification, you can write your question in this issue. It is also advisable to search the internet for answers first.

## I Want To Contribute

### Reporting Bugs

- Make sure that you are using the latest version.
- Read the [documentation](README.md) to find out if the functionality is configured correctly.
- Perform a [search](https://github.com/CarlLee1983/mcp-prompt-manager/issues) to see if the bug has already been reported.
- If it has not been reported, create a new issue providing the following information:
    - **Operating System:** (e.g. macOS 14.2, Windows 11)
    - **Version:** The version of the project you are using.
    - **Steps to reproduce:** Clear steps describing how to reproduce the issue.
    - **Expected behavior:** What you expected to see.
    - **Actual behavior:** What you actually saw.

### Suggesting Enhancements

- Perform a [search](https://github.com/CarlLee1983/mcp-prompt-manager/issues) to see if the enhancement has already been suggested.
- If it has not been suggested, create a new issue providing the following information:
    - **Description:** A clear and concise description of the enhancement.
    - **Motivation:** Why this enhancement would be useful.
    - **Alternatives:** Any alternative solutions you have considered.

## Your First Code Contribution

1. Fork the repository.
2. Clone your fork: `git clone <your-fork-url>`
3. Create a branch for your changes: `git checkout -b my-new-feature`
4. Install dependencies: `pnpm install`
5. Make your changes.
6. Run tests: `pnpm test:run`
7. Ensure linting passes: `pnpm lint`
8. Commit your changes following our [commit conventions](#commit-messages).
9. Push to your fork: `git push origin my-new-feature`
10. Submit a Pull Request.

## Styleguides

### Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools and libraries such as documentation generation

Example: `feat: add support for local file watching`
