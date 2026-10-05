# Making a release

A release is made on purpose, against one commit of `main`. It is not made for every commit or merge.

1. Look at what the next release would hold: the commits since the last release, stack changes and new migrations. The first release ships what is built so far.
2. Choose a version newer than the last. A release with new migrations is a minor version; anything else is a patch, unless you choose otherwise.
3. Write the notes, and record it. Recording adds the release to `outputs/releases.json` in one commit and makes a local tag `vX.Y.Z`.
4. Publishing the tag and a GitHub Release to the project's repository is a separate step. The app's own release workflow then builds its image.
