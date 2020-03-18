# JupyterLab GitLab

A JupyterLab extension for browsing GitLab repositories (in read-only mode).

This extension is based on [jupyterlab-github](https://github.com/jupyterlab/jupyterlab-github).
All credit to the JupyterLab team, and especially [Ian Rose](https://github.com/ian-r-rose), for the github extension!

Thanks as well to [Mark Ghiorso](https://gitlab.com/ghiorso) for the [jupyterlab_gitlab](https://gitlab.com/ENKI-portal/jupyterlab_gitlab)
extension where I took some inspiration. It didn't fit my needs (no server extension) so I decided to create my own based on a recent
version of jupyterlab-github instead (v0.10.0).

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

### Remarks

This extension has both a client-side component (that is, Javascript that is bundled
with JupyterLab), and a server-side component (that is, Python code that is added
to the Jupyter notebook server). This extension _will_ work without the server extension,
with some drawbacks:

- requests will be unauthenticated and only give access to public repositories
- unauthenticated requests can impose rate-limits depending on your GitLab instance
  (meaning you might have to wait before regaining access)
- only the 20 first results are returned (pagination links are not followed)

For those reasons, you should set up the server extension as well as the lab extension.
This process is described in the [installation](#Installation) section.

## Prerequisites

- JupyterLab 1.x for version < 2.0
- JupyterLab 2.0 for version >= 2.0
- A GitLab account for the server extension

## Installation

As discussed above, this extension has both a server extension and a lab extension.
We recommend installing both to allow authentication and pagination.
The purpose of the server extension is to add GitLab credentials that you will need to acquire
from https://gitlab.com/profile/personal_access_tokens, and then to proxy your request to GitLab.
Note that OAuth2 token are also supported.

### 1. Installing the lab extension

To install the lab extension, enter the following in your terminal:

```bash
jupyter labextension install jupyterlab-gitlab
```

With only this installed, the extension should work.

### 2. Getting your credentials from GitLab

You need to create a personal access token to authenticate yourself to GitLab.

1. Go to https://gitlab.com/profile/personal_access_tokens or from GitLab, go to your `Settings`_ > `Access Tokens`_.
1. Under `Name`, enter a short description, to identify the purpose
   of this token. I recommend something like: `jupyterlab-gitlab`.
1. Under Scopes, check the `api` scope.
1. Click `Create personal access token`. You will see your new personal access token (a 21 characters string).
   Click on the copy to clipboard icon and and paste it locally in a text file for now.
   If you have a password manager like 1password, use that.

This is the only time you'll see this token in GitLab. If you lose it, you'll
need to create another one.

### 3. Installing the server extension

Install the server extension using pip, and then enable it:

```bash
pip install jupyterlab-gitlab
```

If you are running Notebook 5.3 or later, this will automatically enable the extension.
If not, enable the server extension by running:

```bash
jupyter serverextension enable --sys-prefix jupyterlab_gitlab
```

You can check if the server extension is enabled by running:

```bash
jupyter serverextension list
```

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
