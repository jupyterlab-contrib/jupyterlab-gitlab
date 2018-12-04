# JupyterLab GitLab

A JupyterLab extension for accessing GitLab repositories.

### What this extension is

When you install this extension, an additional filebrowser tab will be added
to the left area of JupyterLab. This filebrowser allows you to select GitLab
organizations and users, browse their repositories, and open the files in those
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
with a major caveat: when making unauthenticated requests to GitLab
(as we must do to get repository data), GitLab imposes fairly strict rate-limits
on how many requests we can make. As such, you are likely to hit that limit
within a few minutes of work. You will then have to wait up to an hour to regain access.

For that reason, we recommend that you take the time and effort to set up the server
extension as well as the lab extension, which will allow you to access higher rate-limits.
This process is described in the [installation](#Installation) section.

## Prerequisites

- JupyterLab 0.35
- A GitLab account for the serverextension

## Installation

As discussed above, this extension has both a serverextension and a labextension.
We recommend installing both so as to not be rate-limited.
The purpose of the serverextension is to add GitLab credentials that you will need to acquire
from https://gitlab.com/settings/developers, and then to proxy your request to GitLab.

### 1. Installing the labextension

To install the labextension, enter the following in your terminal:

```bash
jupyter labextension install @jupyterlab/gitlab
```

With only this installed, the extension should work, and you can experience the joys of
being rate-limited first-hand!

### 2. Getting your credentials from GitLab

There are two approaches to getting credentials from GitLab:
(1) you can get an access token, (2) you can register an OAuth app.
The second approach is not recommended, and will be removed in a future release.

#### Getting an access token (**recommended**)

You can get an access token by following these steps:

1.  [Verify](https://help.gitlab.com/articles/verifying-your-email-address) your email address with GitLab.
1.  Go to your account settings on GitLab and select "Developer Settings" from the left panel.
1.  On the left, select "Personal access tokens"
1.  Click the "Generate new token" button, and enter your password.
1.  Give the token a description, and check the "**repo**" scope box.
1.  Click "Generate token"
1.  You should be given a string which will be your access token.

Remember that this token is effectively a password for your GitLab account.
_Do not_ share it online or check the token into version control,
as people can use it to access all of your data on GitLab.

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

where `owner` is the GitLab user/org,
and `repository` is the name of the repository you want to open.
