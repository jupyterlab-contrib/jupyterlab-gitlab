// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ToolbarButton } from '@jupyterlab/apputils';

import { URLExt } from '@jupyterlab/coreutils';

import { FileBrowser } from '@jupyterlab/filebrowser';

import { refreshIcon } from '@jupyterlab/ui-components';

import { Message } from '@lumino/messaging';

import { ISignal, Signal } from '@lumino/signaling';

import { PanelLayout, Widget } from '@lumino/widgets';

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
    this.userName = new GitLabUserInput();
    this.userName.node.title = 'Click to edit user/group';
    this._browser.toolbar.addItem('user', this.userName);
    this.userName.nameChanged.connect(this._onUserChanged, this);
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
        const localPath =
          this._browser.model.manager.services.contents.localPath(
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
      iconClass: 'jp-GitLab-icon jp-Icon jp-Icon-16',
      tooltip: 'Open this repository on GitLab'
    });
    this._openGitLabButton.addClass('jp-GitLab-toolbar-item');
    this._browser.toolbar.addItem('GitLab', this._openGitLabButton);

    // Add our own refresh button, since the other one is hidden
    // via CSS.
    const refresher = new ToolbarButton({
      icon: refreshIcon,
      onClick: () => {
        this._browser.model.refresh();
      },
      tooltip: 'Refresh File List'
    });
    refresher.addClass('jp-GitLab-toolbar-item');
    this._browser.toolbar.addItem('gh-refresher', refresher);

    // Set up a listener to check the username.
    this._browser.model.pathChanged.connect(this._onPathChanged, this);
    // Trigger an initial pathChanged to check for the username.
    this._onPathChanged();

    this._drive.rateLimitedState.changed.connect(this._updateErrorPanel, this);
  }

  /**
   * An editable widget hosting the current user name.
   */
  readonly userName: GitLabUserInput;

  /**
   * React to a change in user.
   */
  private _onUserChanged() {
    if (this._changeGuard) {
      return;
    }
    this._changeGuard = true;
    this._browser.model.cd(`/${this.userName.name}`).then(() => {
      this._changeGuard = false;
      this._updateErrorPanel();
      // Once we have the new listing, maybe give the file listing
      // focus. Once the input element is removed, the active element
      // appears to revert to document.body. If the user has subsequently
      // focused another element, don't focus the browser listing.
      if (document.activeElement === document.body) {
        const listing = (this._browser.layout as PanelLayout).widgets[3];
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
      this.userName.name = resource.user;
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
      const listing = (this._browser.layout as PanelLayout).widgets[3];
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
      const listing = (this._browser.layout as PanelLayout).widgets[3];
      listing.node.appendChild(this._errorPanel.node);
      return;
    }

    // If we have an invalid user, make an error panel.
    if (!validUser) {
      const message = resource.user
        ? `"${resource.user}" appears to be an invalid user name!`
        : 'Please enter a GitLab user name';
      this._errorPanel = new GitLabErrorPanel(message);
      const listing = (this._browser.layout as PanelLayout).widgets[3];
      listing.node.appendChild(this._errorPanel.node);
      return;
    }
  }

  private _browser: FileBrowser;
  private _drive: GitLabDrive;
  private _errorPanel: GitLabErrorPanel | null = null;
  private _openGitLabButton: ToolbarButton;
  private _changeGuard = false;
}

/**
 * A widget that hosts an editable field,
 * used to host the currently active GitLab
 * user name.
 */
export class GitLabUserInput extends Widget {
  constructor() {
    super();
    this.addClass('jp-GitLabUserInput');
    const layout = (this.layout = new PanelLayout());
    const wrapper = new Widget();
    wrapper.addClass('jp-GitLabUserInput-wrapper');
    this._input = document.createElement('input');
    this._input.placeholder = 'GitLab User or Group';
    this._input.className = 'jp-GitLabUserInput-input';
    wrapper.node.appendChild(this._input);
    layout.addWidget(wrapper);
  }

  /**
   * The current name of the field.
   */
  get name(): string {
    return this._name;
  }
  set name(value: string) {
    if (value === this._name) {
      return;
    }
    const old = this._name;
    this._name = value;
    this._input.value = value;
    this._nameChanged.emit({
      oldValue: old,
      newValue: value
    });
  }

  /**
   * A signal for when the name changes.
   */
  get nameChanged(): ISignal<this, { newValue: string; oldValue: string }> {
    return this._nameChanged;
  }

  /**
   * Handle the DOM events for the widget.
   *
   * @param event - The DOM event sent to the widget.
   *
   * #### Notes
   * This method implements the DOM `EventListener` interface and is
   * called in response to events on the main area widget's node. It should
   * not be called directly by user code.
   */
  handleEvent(event: KeyboardEvent): void {
    switch (event.type) {
      case 'keydown':
        switch (event.keyCode) {
          case 13: // Enter
            event.stopPropagation();
            event.preventDefault();
            this.name = this._input.value;
            this._input.blur();
            break;
          default:
            break;
        }
        break;
      case 'blur':
        event.stopPropagation();
        event.preventDefault();
        this.name = this._input.value;
        break;
      case 'focus':
        event.stopPropagation();
        event.preventDefault();
        this._input.select();
        break;
      default:
        break;
    }
  }

  /**
   * Handle `after-attach` messages for the widget.
   */
  protected onAfterAttach(msg: Message): void {
    this._input.addEventListener('keydown', this);
    this._input.addEventListener('blur', this);
    this._input.addEventListener('focus', this);
  }

  /**
   * Handle `before-detach` messages for the widget.
   */
  protected onBeforeDetach(msg: Message): void {
    this._input.removeEventListener('keydown', this);
    this._input.removeEventListener('blur', this);
    this._input.removeEventListener('focus', this);
  }

  private _name = '';
  private _nameChanged = new Signal<
    this,
    { newValue: string; oldValue: string }
  >(this);
  private _input: HTMLInputElement;
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
