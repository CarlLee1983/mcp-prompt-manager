# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please send an e-mail to the project maintainers (or open a confidential draft advisory on GitHub if enabled). All security vulnerability reports will be promptly addressed.

**Please do not report security vulnerabilities through public GitHub issues.**

## Recommended Security Settings

To ensure the security of this project, we recommend enabling the following settings in your GitHub repository:

### 1. Enable Secret Scanning

Secret scanning detects secrets (like tokens and private keys) checked into the repository.

1. Go to your repository **Settings**.
2. Click on **Code security and analysis** in the sidebar.
3. Scroll to "Secret scanning" and click **Enable**.
4. Enable **Push protection** to prevent secrets from being pushed in the first place.

### 2. Branch Protection Rules

Protect the `main` (or `master`) branch to prevent direct commits and ensure code quality.

1. Go to your repository **Settings**.
2. Click on **Branches** in the sidebar.
3. Click **Add branch protection rule**.
4. **Branch name pattern**: `main` (or `master`)
5. Check the following options:
    - [x] **Require a pull request before merging**
        - [x] Require approvals (Recommended: 1 or more)
    - [x] **Require status checks to pass before merging** (Select your CI/CodeQL checks)
    - [x] **Do not allow bypassing the above settings**
    - [x] **Restrict who can push to matching branches** (effectively disabling direct pushes)

### 3. Least Privilege

- Ensure CI/CD tokens have minimal permissions.
- Regular users should not have admin access to the repository.
