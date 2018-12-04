# JupyterLab GitLab

A JupyterLab extension for accessing GitLab repositories.

This extension is based on [jupyterlab-github](https://github.com/jupyterlab/jupyterlab-github).
All credit to the JupyterLab team for the initial extension!

Thanks as well to [Mark Ghiorso](https://gitlab.com/ghiorso) for the [jupyterlab_gitlab](https://gitlab.com/ENKI-portal/jupyterlab_gitlab)
extension where I took some inspiration. It didn't fit my needs so I decided to create my own.

### What this extension is

When you install this extension, an additional filebrowser tab will be added
to the left area of JupyterLab. This filebrowser allows you to select GitLab
groups and users, browse their repositories, and open the files in those
repositories. If those files are notebooks, you can run them just as you would
any other notebook. You can also attach a kernel to text files and run those.
Basically, you should be able to open any file in a repository that JupyterLab can handle.

### What this extension is not

This is not an extension that provides full GitLab access, such as
saving files, making commits, forking repositories, etc.
For it to be so, it would need to more-or-less reinvent the GitLab website,
which represents a huge increase in complexity for the extension.

### A note on rate-limiting

This extension has both a client-side component (that is, Javascript that is bundled
with JupyterLab), and a server-side component (that is, Python code that is added
to the Jupyter notebook server). This extension _will_ work with out the server extension,
with some drawbacks:

- requests will be unauthenticated and only give access to public repositories
- unauthenticated requests can impose rate-limits depending on your GitLab instance
  (meaning you might have to wait before regaining access)
- only 20 first results are returned (pagination links are not followed)

For that reason, you should set up the server extension as well as the lab extension.
This process is described in the [installation](#Installation) section.

## Prerequisites

- JupyterLab 0.35
- A GitLab account for the serverextension

## Installation

As discussed above, this extension has both a serverextension and a labextension.
We recommend installing both to allow authentication and pagination.
The purpose of the serverextension is to add GitLab credentials that you will need to acquire
from https://gitlab.com/profile/personal_access_tokens, and then to proxy your request to GitLab.

### 1. Installing the labextension

To install the labextension, enter the following in your terminal:

```bash
jupyter labextension install @jupyterlab/gitlab
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

This is the only time you'll see this token in GitLab. If you lost it, you'll
need to create another one.

### 3. Installing the serverextension

Install the serverextension using pip, and then enable it:

```bash
pip install jupyterlab_gitlab
```

If you are running Notebook 5.2 or earlier, enable the server extension by running

```bash
jupyter serverextension enable --sys-prefix jupyterlab_gitlab
```

You now need to add the credentials you got from GitLab
to your notebook configuration file. Instructions for generating a configuration
file can be found [here](http://jupyter-notebook.readthedocs.io/en/stable/config_overview.html#configure-nbserver)
Once you have identified this file, add the following lines to it:

```python
c.GitLabConfig.access_token = '< YOUR_ACCESS_TOKEN >'
```

where "`< YOUR_ACCESS_TOKEN >`" is the string value you obtained above.

With this, you should be done! Launch JupyterLab and look for the GitLab tab on the left!

## Customization

You can set the plugin to start showing a particular repository at launch time.
Open the "Advanced Settings" editor in the Settings menu,
and under the GitLab settings add

```json
{
  "defaultRepo": "owner/repository"
}
```

where `owner` is the GitLab user/group,
and `repository` is the name of the repository you want to open.
