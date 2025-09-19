#!/bin/bash
###############################################################################
#  GitHub Actions deployment script
###############################################################################
set -e
trap 'exit 1' INT

if [[ "${COMMIT_MESSAGE}" =~ ^(SEMVER-MAJOR) ]]; then
  RELEASE_TYPE="major"
elif [[ "${COMMIT_MESSAGE}" =~ ^(SEMVER-PATCH|patch|hotfix) ]]; then
  RELEASE_TYPE="patch"
else
  RELEASE_TYPE="minor"
fi
echo "Executing deployment - BRANCH=${BRANCH}, COMMIT_MESSAGE=${COMMIT_MESSAGE}, RELEASE_TYPE=${RELEASE_TYPE}"

# Use the npm semver package to help determine release versions
echo "Installing semver"
npm i -g semver

echo "Checking out target branch"
git fetch --unshallow
git fetch --tags
git checkout "${BRANCH}"
git pull
git branch -avl

echo "Setting up git"
git config user.name "GitHub Actions"
git config user.email "actions@users.noreply.github.com"

# Ensure that git will return tags with pre-releases in the correct order (e.g. 0.1.0-rc.0 occurs before 0.1.0)
echo "Removing existing git tag versionsort configuration"
git config --global --unset-all versionsort.suffix || echo "No existing versionsort.suffix found it git configuration."
echo "Setting required git tag versionsort configuration"
git config --global --add versionsort.suffix -beta.
git config --global --add versionsort.suffix -rc.

# Calculate PREVIOUS_VERSION and NEW_VERSION based on the source and target of the merge
echo "Determining versions for release"
if [ "${BRANCH}" == "main" ]; then
    # Creating new release on the main branch, determine latest release version on main branch only
    PREVIOUS_VERSION=$(git tag --list --merged main --sort=version:refname | egrep '^v[0-9]*\.[0-9]*\.[0-9]*(-rc\.[0-9]*)?$' | tail -1)
    echo "Latest build on the main branch is ${PREVIOUS_VERSION}"
    NEW_VERSION="v$(semver "${PREVIOUS_VERSION}" -i ${RELEASE_TYPE})"

    echo "Updating CHANGELOG.md"

    # Find the latest *stable* release tag (no -rc)
    PREVIOUS_STABLE=$(git tag --list --merged main --sort=version:refname | egrep '^v[0-9]+\.[0-9]+\.[0-9]+$' | tail -1)
    echo "Previous stable release: ${PREVIOUS_STABLE}"

    COMMITS=$(git log "${PREVIOUS_STABLE}"..HEAD --pretty=format:"- %s (%an, %ad)" --date=short)

    if [ -n "${COMMITS}" ]; then
      {
        echo "## ${NEW_VERSION} - $(date +%Y-%m-%d)"
        echo ""
        echo "${COMMITS}"
        echo ""
        cat CHANGELOG.md 2>/dev/null || true
      } > CHANGELOG.md.new

      mv CHANGELOG.md.new CHANGELOG.md
      git add CHANGELOG.md
    else
      echo "No new commits to add to changelog"
    fi
elif [ "$BRANCH" == "develop" ]; then
    # Creating new release on the develop branch, determine latest release version on either develop or main
    PREVIOUS_VERSION=$(git tag --list --sort=version:refname | egrep '^v[0-9]*\.[0-9]*\.[0-9]*(-rc\.[0-9]*)?$' | tail -1)
    echo "Latest build in the repository is ${PREVIOUS_VERSION}"
    if [[ ${PREVIOUS_VERSION} =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        # Most recent version is a production release on main, start a new prerelease on develop
        NEW_VERSION="v$(semver "${PREVIOUS_VERSION}" -i preminor --preid rc)"
    else
        # Most recent version is already a pre-release on the develop branch, just increment the pre-release number
        NEW_VERSION="v$(semver "${PREVIOUS_VERSION}" -i prerelease --preid rc)"
    fi
else
    echo "Skipping deployment for branch ${BRANCH}"
    exit 0
fi

echo "Updating version from ${PREVIOUS_VERSION} to ${NEW_VERSION}"
# Update package files versions
npm version "${NEW_VERSION}"

# Push new tag and package metadata to the remote
echo "Pushing new release to the remote"
git push origin "${BRANCH}:${BRANCH}" --no-verify

echo "Pushing new release tag to the remote"
git tag "${NEW_VERSION}" -m "${NEW_VERSION}" -f
git push origin "${NEW_VERSION}"

# If we've pushed a new release into main and it is not a hotfix/patch, then merge the changes back to develop
if [ "${BRANCH}" == "main" ] && [ "${RELEASE_TYPE}" != "patch" ]; then
  git checkout develop
  git merge -X theirs main
  git push origin develop:develop --no-verify
fi
