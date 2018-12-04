// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { PanelLayout, Widget } from '@phosphor/widgets';

import { ToolbarButton } from '@jupyterlab/apputils';

import { URLExt } from '@jupyterlab/coreutils';

import { FileBrowser } from '@jupyterlab/filebrowser';

import { ObservableValue } from '@jupyterlab/observables';

import { GitLabDrive, parsePath } from './contents';

/**
 * Widget for hosting the GitLab filebrowser.
 */
export class GitLabFileBrowser extends Widget {
  constructor(browser: FileBrowser, drive: GitLabDrive) {
    super();
    this.addClass('jp-GitLabBrowser');
    this.layout = new PanelLayout();
    (this.layout as PanelLayout).addWidget(browser);
    this._browser = browser;
    this._drive = drive;

    // Create an editable name for the user/org name.
    this.userName = new GitLabEditableName('', '<Edit User>');
    this.userName.addClass('jp-GitLabEditableUserName');
    this.userName.node.title = 'Click to edit user/organization';
    this._browser.toolbar.addItem('user', this.userName);
    this.userName.name.changed.connect(
      this._onUserChanged,
      this
    );
    // Create a button that opens GitLab at the appropriate
    // repo+directory.
    this._openGitLabButton = new ToolbarButton({
      onClick: () => {
        let url = this._drive.baseUrl;
        // If there is no valid user, open the GitLab homepage.
        if (!this._drive.validUser) {
          window.open(url);
          return;
        }
        const localPath = this._browser.model.manager.services.contents.localPath(
          this._browser.model.path
        );
        const resource = parsePath(localPath);
        url = URLExt.join(url, resource.user);
        if (resource.repository) {
          url = URLExt.join(
            url,
            resource.repository,
            'tree',
            'master',
            resource.path
          );
        }
        window.open(url);
      },
      iconClassName: 'jp-GitLab-icon jp-Icon jp-Icon-16',
      tooltip: 'Open this repository on GitLab'
    });
    this._openGitLabButton.addClass('jp-GitLab-toolbar-item');
    this._browser.toolbar.addItem('GitLab', this._openGitLabButton);

    // Add our own refresh button, since the other one is hidden
    // via CSS.
    let refresher = new ToolbarButton({
      iconClassName: 'jp-RefreshIcon jp-Icon jp-Icon-16',
      onClick: () => {
        this._browser.model.refresh();
      },
      tooltip: 'Refresh File List'
    });
    refresher.addClass('jp-GitLab-toolbar-item');
    this._browser.toolbar.addItem('gh-refresher', refresher);

    // Set up a listener to check the username.
    this._browser.model.pathChanged.connect(
      this._onPathChanged,
      this
    );
    // Trigger an initial pathChanged to check for the username.
    this._onPathChanged();

    this._drive.rateLimitedState.changed.connect(
      this._updateErrorPanel,
      this
    );
  }

  /**
   * An editable widget hosting the current user name.
   */
  readonly userName: GitLabEditableName;

  /**
   * React to a change in user.
   */
  private _onUserChanged(
    sender: ObservableValue,
    args: ObservableValue.IChangedArgs
  ) {
    if (this._changeGuard) {
      return;
    }
    this._changeGuard = true;
    this._browser.model.cd(`/${args.newValue as string}`).then(() => {
      this._changeGuard = false;
      this._updateErrorPanel();
      // Once we have the new listing, maybe give the file listing
      // focus. Once the input element is removed, the active element
      // appears to revert to document.body. If the user has subsequently
      // focused another element, don't focus the browser listing.
      if (document.activeElement === document.body) {
        const listing = (this._browser.layout as PanelLayout).widgets[2];
        listing.node.focus();
      }
    });
  }

  /**
   * React to the path changing for the browser.
   */
  private _onPathChanged(): void {
    const localPath = this._browser.model.manager.services.contents.localPath(
      this._browser.model.path
    );
    const resource = parsePath(localPath);

    // If we are not already changing the user name, set it.
    if (!this._changeGuard) {
      this._changeGuard = true;
      this.userName.name.set(resource.user);
      this._changeGuard = false;
      this._updateErrorPanel();
    }

    return;
  }

  /**
   * React to a change in the validity of the drive.
   */
  private _updateErrorPanel(): void {
    const localPath = this._browser.model.manager.services.contents.localPath(
      this._browser.model.path
    );
    const resource = parsePath(localPath);
    const rateLimited = this._drive.rateLimitedState.get();
    const validUser = this._drive.validUser;

    // If we currently have an error panel, remove it.
    if (this._errorPanel) {
      const listing = (this._browser.layout as PanelLayout).widgets[2];
      listing.node.removeChild(this._errorPanel.node);
      this._errorPanel.dispose();
      this._errorPanel = null;
    }

    // If we are being rate limited, make an error panel.
    if (rateLimited) {
      this._errorPanel = new GitLabErrorPanel(
        'You have been rate limited by GitLab! ' +
          'You will need to wait about an hour before ' +
          'continuing'
      );
      const listing = (this._browser.layout as PanelLayout).widgets[2];
      listing.node.appendChild(this._errorPanel.node);
      return;
    }

    // If we have an invalid user, make an error panel.
    if (!validUser) {
      const message = resource.user
        ? `"${resource.user}" appears to be an invalid user name!`
        : 'Please enter a GitLab user name';
      this._errorPanel = new GitLabErrorPanel(message);
      const listing = (this._browser.layout as PanelLayout).widgets[2];
      listing.node.appendChild(this._errorPanel.node);
      return;
    }
  }

  private _browser: FileBrowser;
  private _drive: GitLabDrive;
  private _errorPanel: GitLabErrorPanel | null;
  private _openGitLabButton: ToolbarButton;
  private _changeGuard = false;
}

/**
 * A widget that hosts an editable field,
 * used to host the currently active GitLab
 * user name.
 */
export class GitLabEditableName extends Widget {
  constructor(initialName: string = '', placeholder?: string) {
    super();
    this.addClass('jp-GitLabEditableName');
    this._nameNode = document.createElement('div');
    this._nameNode.className = 'jp-GitLabEditableName-display';
    this._editNode = document.createElement('input');
    this._editNode.className = 'jp-GitLabEditableName-input';

    this._placeholder = placeholder || '<Edit Name>';

    this.node.appendChild(this._nameNode);
    this.name = new ObservableValue(initialName);
    this._nameNode.textContent = initialName || this._placeholder;

    this.node.onclick = () => {
      if (this._pending) {
        return;
      }
      this._pending = true;
      Private.changeField(this._nameNode, this._editNode).then(value => {
        this._pending = false;
        if (this.name.get() !== value) {
          this.name.set(value);
        }
      });
    };

    this.name.changed.connect((s, args) => {
      if (args.oldValue !== args.newValue) {
        this._nameNode.textContent =
          (args.newValue as string) || this._placeholder;
      }
    });
  }

  /**
   * The current name of the field.
   */
  readonly name: ObservableValue;

  private _pending = false;
  private _placeholder: string;
  private _nameNode: HTMLElement;
  private _editNode: HTMLInputElement;
}

/**
 * A widget hosting an error panel for the browser,
 * used if there is an invalid user name or if we
 * are being rate-limited.
 */
export class GitLabErrorPanel extends Widget {
  constructor(message: string) {
    super();
    this.addClass('jp-GitLabErrorPanel');
    const image = document.createElement('div');
    const text = document.createElement('div');
    image.className = 'jp-GitLabErrorImage';
    text.className = 'jp-GitLabErrorText';
    text.textContent = message;
    this.node.appendChild(image);
    this.node.appendChild(text);
  }
}

/**
 * A module-Private namespace.
 */
namespace Private {
  /**
   * Given a text node and an input element, replace the text
   * node wiht the input element, allowing the user to reset the
   * value of the text node.
   *
   * @param text - The node to make editable.
   *
   * @param edit - The input element to replace it with.
   *
   * @returns a Promise that resolves when the editing is complete,
   *   or has been canceled.
   */
  export function changeField(
    text: HTMLElement,
    edit: HTMLInputElement
  ): Promise<string> {
    // Replace the text node with an the input element.
    let parent = text.parentElement as HTMLElement;
    let initialValue = text.textContent || '';
    edit.value = initialValue;
    parent.replaceChild(edit, text);
    edit.focus();

    // Highlight the input element
    let index = edit.value.lastIndexOf('.');
    if (index === -1) {
      edit.setSelectionRange(0, edit.value.length);
    } else {
      edit.setSelectionRange(0, index);
    }

    return new Promise<string>((resolve, reject) => {
      edit.onblur = () => {
        // Set the text content of the original node, then
        // replace the node.
        parent.replaceChild(text, edit);
        text.textContent = edit.value || initialValue;
        resolve(edit.value);
      };
      edit.onkeydown = (event: KeyboardEvent) => {
        switch (event.keyCode) {
          case 13: // Enter
            event.stopPropagation();
            event.preventDefault();
            edit.blur();
            break;
          case 27: // Escape
            event.stopPropagation();
            event.preventDefault();
            edit.value = initialValue;
            edit.blur();
            break;
          default:
            break;
        }
      };
    });
  }
}
