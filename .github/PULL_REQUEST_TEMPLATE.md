<!-- markdownlint-disable first-line-heading -->
<!-- Thank you for your contribution! -->
<!-- First time contributors: Take a moment to review https://als.rtfd.io/en/latest/contributing/guidelines! -->

❓ **What kind of change does this PR introduce?**

* [ ] 🐞 bug fix
* [ ] 🐣 feature
* [ ] 📋 docs update
* [ ] 📋 tests/coverage improvement
* [ ] 📋 refactoring
* [ ] 💥 other

❓ **What do these changes do?**

<!-- Please give a short brief about these changes. -->

❓ **Are there changes in behavior for the user?**

<!-- Outline any notable behaviour for the end users. -->

📋 **Related issue number**

<!-- Will merging this resolve any open issues? -->
Resolves #<!-- issue number here -->

📋 **Contribution checklist:**

(If you're a first-timer, check out
[this guide on making great pull requests][making a lovely PR])

* [ ] I wrote descriptive pull request text above
* [ ] I think the code is well written
* [ ] I wrote [good commit messages]
* [ ] I have [squashed related commits together][related squash] after
      the changes have been approved
* [ ] Unit tests for the changes exist
* [ ] Integration tests for the changes exist (if applicable)
* [ ] I used the same coding conventions as the rest of the project
* [ ] The new code doesn't generate linter offenses
* [ ] Documentation reflects the changes
* [ ] The PR relates to *only* one subject with a clear title
      and description in grammatically correct, complete sentences
* [ ] I added a new news fragment into the
      [`docs/changelog-fragments.d/`] folder
      _(See [documentation][PR docs] for details)_
  * Name it `<issue_id>.<type>.md` (for example, `588.bugfix.md`)
  * If you don't have an `issue_id` change it to the PR ID after
    creating the PR
  * Ensure type is one of the following:
    * `.feature`: Signifying a new feature.
    * `.bugfix`: Signifying a bug fix.
    * `.doc`: Signifying a notable documentation improvement.
    * `.deprecation`: Signifying a deprecation or removal
      of public API.
    * `.breaking`: An actual backward-incompatible change.
    * `.misc`: A ticket has been closed, but it is not of interest
      to the end-users.
    * `.internal`: Something is of interest to the contributors but
      not the end-users.
  * Optionally "sign" the fragment with
    ```-- by {user}`your username`.```
  * Make sure to use full sentences with correct case and punctuation.
    Describe the changes compared to the latest release in the past
    tense.
    For example:

    ```md
    Implemented handling the encrypted content with `ansible-vault`
    -- by {user}`superuser`
    ```

  * Also see [examples][`docs/changelog-fragments.d/`]

[`docs/changelog-fragments.d/`]:
../tree/main/docs/changelog-fragments.d/
[good commit messages]: http://chris.beams.io/posts/git-commit/
[making a lovely PR]: https://mtlynch.io/code-review-love/
[PR docs]:
https://als.rtfd.io/en/latest/contributing/guidelines#adding-change-notes-with-your-prs
[related squash]:
https://github.com/todotxt/todo.txt-android/wiki/Squash-All-Commits-Related-to-a-Single-Issue-into-a-Single-Commit
