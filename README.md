# JupyterLab GitLab

A JupyterLab extension for browsing GitLab repositories (in read-only mode).

This extension is based on [jupyterlab-github](https://github.com/jupyterlab/jupyterlab-github).
All credit to the JupyterLab team, and especially [Ian Rose](https://github.com/ian-r-rose), for the github extension!

Thanks as well to [Mark Ghiorso](https://gitlab.com/ghiorso) for the [jupyterlab_gitlab](https://gitlab.com/ENKI-portal/jupyterlab_gitlab)
extension where I took some inspiration. It didn't fit my needs (no server extension) so I decided to create my own based on a recent
version of jupyterlab-github instead (v0.10.0).

This extension is composed of a Python package named `jupyterlab_gitlab`
for the server extension and a NPM package named `jupyterlab-gitlab`
for the frontend extension.

The purpose of the server extension is to add GitLab credentials that you will need to acquire
from https://gitlab.com/profile/personal_access_tokens, and then to proxy your request to GitLab.
Note that OAuth2 token are also supported.

## Introduction

### What this extension is

When you install this extension, an additional filebrowser tab will be added
to the left area of JupyterLab. This filebrowser allows you to select GitLab
groups and users, browse their repositories, and open the files in those
repositories. If those files are notebooks, you can run them just as you would
any other notebook. You can also attach a kernel to text files and run those.
Basically, you should be able to open any file in a repository that JupyterLab can handle.

WARNING! Subgroups are currently not supported.

Here is a screenshot of the plugin opening this very file on GitLab:
![gitception](gitception.png 'Gitception')

### What this extension is not

This is not an extension that provides full GitLab access, such as
saving files, making commits, forking repositories, etc.

If you want to use git from JupyterLab, you should look at the
[jupyterlab-git](https://github.com/jupyterlab/jupyterlab-git) extension.

## Requirements

* JupyterLab >= 3.0
* JupyterLab 1.x for version 1.x
* JupyterLab 2.x for version 2.x
* JupyterLab 3.x for version 3.x
* A GitLab account for the server extension

## Installation

### Install the server and lab extension

For Jupyterlab >= 3.0, both extensions are installed from the Python package:

```bash
pip install jupyterlab-gitlab
```

For Jupyterlab < 3.0, you have to install the server and lab extensions separately:

```bash
jupyter labextension install jupyterlab-gitlab
pip install jupyterlab-gitlab
```

### Getting your credentials from GitLab

1. Go to <https://gitlab.com/profile/personal_access_tokens> or from GitLab, go to your `Settings` > `Access Tokens`.
1. Under `Name`, enter a short description, to identify the purpose
   of this token. I recommend something like: `jupyterlab-gitlab`.
1. Under Scopes, check the `api` scope.
1. Click `Create personal access token`. You will see your new personal access token (a 21 characters string).
   Click on the copy to clipboard icon and and paste it locally in a text file for now.
   If you have a password manager like 1password, use that.

This is the only time you'll see this token in GitLab. If you lose it, you'll
need to create another one.

You should now add the credentials you got from GitLab to your notebook configuration file.
Instructions for generating a configuration file can be found
[here](http://jupyter-notebook.readthedocs.io/en/stable/config_overview.html#configure-nbserver).
Once you have identified this file, add the following line to it:

```python
c.GitLabConfig.access_token = "< YOUR_ACCESS_TOKEN >"
```

where `< YOUR_ACCESS_TOKEN >` is the string value you obtained above.
It can also be an OAuth2 token.

## Customization

### Customizing the server extension

You saw how to add your `access_token` to the notebook configuration file.
There are other parameters than you can modify using that file.
Those are the default values:

```python
c.GitLabConfig.allow_client_side_access_token = False
c.GitLabConfig.url = "https://gitlab.com"
c.GitLabConfig.validate_cert = True
```

If you run your own GitLab instance for example, update `c.GitLabConfig.url` to point to it.

### Customizing the lab extension

You can set the plugin to start showing a particular repository at launch time.
Open the "Advanced Settings" editor in the JupyterLab Settings menu,
and under the GitLab settings add

```json
{
  "baseUrl": "https://gitlab.com",
  "defaultRepo": "owner/repository"
}
```

where `owner` is the GitLab user or group,
and `repository` is the name of the repository you want to open.

The `baseUrl` can also be updated to point to your own GitLab instance.
If you use the server extension, this url is only used for the `Open this repository on GitLab` button.

## Troubleshoot

If you are seeing the frontend extension, but it is not working, check
that the server extension is enabled:

```bash
jupyter server extension list
```

If the server extension is installed and enabled, but you are not seeing
the frontend extension, check the frontend extension is installed:

```bash
jupyter labextension list
```

## Contributing

### Development install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Change directory to the jupyterlab-gitlab directory
# Install package in development mode
pip install -e .
# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Rebuild extension Typescript source after making changes
jlpm run build
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm run watch
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `jlpm run build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Uninstall

```bash
pip uninstall jupyterlab-gitlab
```

For JupyterLab < 3, you will also need to run the following command after removing the Python package:

```bash
jupyter labextension uninstall jupyterlab-gitlab
```
