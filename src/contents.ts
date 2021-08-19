// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { Signal, ISignal } from '@lumino/signaling';

import { PathExt, URLExt } from '@jupyterlab/coreutils';

import { DocumentRegistry } from '@jupyterlab/docregistry';

import { ObservableValue } from '@jupyterlab/observables';

import { Contents, ServerConnection } from '@jupyterlab/services';

import {
  browserApiRequest,
  proxiedApiRequest,
  GitLabRepo,
  GitLabContents,
  GitLabFileContents
} from './gitlab';

import * as base64js from 'base64-js';

export const DEFAULT_GITLAB_BASE_URL = 'https://gitlab.com';

/**
 * A Contents.IDrive implementation that serves as a read-only
 * view onto GitLab repositories.
 */
export class GitLabDrive implements Contents.IDrive {
  /**
   * Construct a new drive object.
   *
   * @param options - The options used to initialize the object.
   */
  constructor(registry: DocumentRegistry) {
    this._serverSettings = ServerConnection.makeSettings();
    this._fileTypeForPath = (path: string) => {
      const types = registry.getFileTypesForPath(path);
      return types.length === 0 ? registry.getFileType('text')! : types[0];
    };

    this.baseUrl = DEFAULT_GITLAB_BASE_URL;

    // Test an api request to the notebook server
    // to see if the server proxy is installed.
    // If so, use that. If not, warn the user and
    // use the client-side implementation.
    // The path is expected to be url safe base64 encoded by the
    // server proxy
    this._useProxy = new Promise<boolean>(resolve => {
      // GET /templates/licenses
      // https://docs.gitlab.com/ee/api/templates/licenses.html
      // GET /version requires an authenticated user
      // https://docs.gitlab.com/ee/api/version.html
      const requestUrl = URLExt.join(
        this._serverSettings.baseUrl,
        'gitlab',
        Private.b64EncodeUrlSafe('/templates/licenses')
      );
      proxiedApiRequest<any>(requestUrl, this._serverSettings)
        .then(() => {
          resolve(true);
        })
        .catch(() => {
          console.warn(
            'The JupyterLab GitLab server extension appears ' +
              'to be missing. If you do not install it with application ' +
              'credentials, you are likely to be rate limited by GitLab ' +
              'very quickly'
          );
          resolve(false);
        });
    });

    // Initialize the rate-limited observable.
    this.rateLimitedState = new ObservableValue(false);
  }

  /**
   * The name of the drive.
   */
  get name(): 'GitLab' {
    return 'GitLab';
  }

  /**
   * State for whether the user is valid.
   */
  get validUser(): boolean {
    return this._validUser;
  }

  /**
   * Settings for the notebook server.
   */
  get serverSettings(): ServerConnection.ISettings {
    return this._serverSettings;
  }

  /**
   * State for whether the drive is being rate limited by GitLab.
   */
  readonly rateLimitedState: ObservableValue;

  /**
   * A signal emitted when a file operation takes place.
   */
  get fileChanged(): ISignal<Contents.IDrive, Contents.IChangedArgs> {
    return this._fileChanged;
  }

  /**
   * Test whether the manager has been disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose of the resources held by the manager.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
    Signal.clearData(this);
  }

  /**
   * The GitLab base URL
   */
  get baseUrl(): string {
    return this._baseUrl;
  }

  /**
   * The GitLab base URL is set by the settingsRegistry change hook
   */
  set baseUrl(url: string) {
    this._baseUrl = url;
  }

  /**
   * The GitLab access token
   */
  get accessToken(): string | null | undefined {
    return this._accessToken;
  }

  /**
   * The GitLab access token is set by the settingsRegistry change hook
   */
  set accessToken(token: string | null | undefined) {
    this._accessToken = token;
  }

  /**
   * Get a file or directory.
   *
   * @param path: The path to the file.
   *
   * @param options: The options used to fetch the file.
   *
   * @returns A promise which resolves with the file content.
   */
  get(
    path: string,
    options?: Contents.IFetchOptions
  ): Promise<Contents.IModel> {
    const resource = parsePath(path);
    // If the org has not been set, return an empty directory
    // placeholder.
    if (resource.user === '') {
      this._validUser = false;
      return Promise.resolve(Private.dummyDirectory);
    }

    // If the group has been set and the path is empty, list
    // the repositories for the group.
    if (resource.user && !resource.repository) {
      return this._listRepos(resource.user);
    }

    // If no path is given, get a list of files and directories
    // at the root of the project
    // https://docs.gitlab.com/ee/api/repositories.html#list-repository-tree
    // GET /projects/:id/repository/tree
    let endUrl = 'tree';
    // Otherwise check if we want to retrieve a file or directory content
    if (resource.path) {
      if (options && (options.type === 'file' || options.type === 'notebook')) {
        // Get file from repository
        // https://docs.gitlab.com/ee/api/repository_files.html#get-file-from-repository
        // GET /projects/:id/repository/files/:file_path
        // Note that:
        // - we can't use GET /projects/:id/repository/tree?path=file_path (it returns 200 with an empty [])
        // - ref is required and hard coded to master
        endUrl =
          URLExt.join('files', encodeURIComponent(resource.path)) +
          '?ref=master';
      } else {
        // Get a list of repository files and directories in the project
        // https://docs.gitlab.com/ee/api/repositories.html#list-repository-tree
        // GET /projects/:id/repository/tree?path=path
        endUrl = URLExt.join(
          'tree',
          '?path=' + encodeURIComponent(resource.path)
        );
      }
    }
    // Use namespaced API calls: resource.user + '%2F' + resource.repository
    // See https://docs.gitlab.com/ee/api/README.html#namespaced-path-encoding
    const apiPath = URLExt.join(
      'projects',
      encodeURIComponent(resource.user) +
        '%2F' +
        encodeURIComponent(resource.repository),
      'repository',
      endUrl
    );
    return this._apiRequest<GitLabContents>(apiPath)
      .then(contents => {
        // Set the states
        this._validUser = true;
        if (this.rateLimitedState.get() !== false) {
          this.rateLimitedState.set(false);
        }

        return Private.gitLabContentsToJupyterContents(
          path,
          contents,
          this._fileTypeForPath
        );
      })
      .catch((err: ServerConnection.ResponseError) => {
        if (err.response.status === 404) {
          console.warn(
            'GitLab: cannot find group/repo. ' +
              'Perhaps you misspelled something?'
          );
          this._validUser = false;
          return Private.dummyDirectory;
        } else if (
          err.response.status === 403 &&
          err.message.indexOf('rate limit') !== -1
        ) {
          if (this.rateLimitedState.get() !== true) {
            this.rateLimitedState.set(true);
          }
          console.error(err.message);
          return Promise.reject(err);
        } else {
          console.error(err.message);
          return Promise.reject(err);
        }
      });
  }

  /**
   * Get an encoded download url given a file path.
   *
   * @param path - An absolute POSIX file path on the server.
   */
  getDownloadUrl(path: string): Promise<string> {
    // Parse the path into user/repo/path
    const resource = parsePath(path);
    // Error if the user has not been set
    if (!resource.user) {
      return Promise.reject('GitLab: no active group');
    }

    // Error if there is no path.
    if (!resource.path) {
      return Promise.reject('GitLab: No file selected');
    }

    // Create the url to get the raw file from the repository
    // https://docs.gitlab.com/ee/api/repository_files.html#get-raw-file-from-repository
    // GET /projects/:id/repository/files/:file_path/raw
    const apiUrl = URLExt.join(this.baseUrl, 'api', 'v4');
    const rawUrl =
      URLExt.join(
        apiUrl,
        'projects',
        encodeURIComponent(resource.user) +
          '%2F' +
          encodeURIComponent(resource.repository),
        'repository',
        'files',
        encodeURIComponent(resource.path),
        'raw'
      ) + '?ref=master';
    return Promise.resolve(rawUrl);
  }

  /**
   * Create a new untitled file or directory in the specified directory path.
   *
   * @param options: The options used to create the file.
   *
   * @returns A promise which resolves with the created file content when the
   *    file is created.
   */
  newUntitled(options: Contents.ICreateOptions = {}): Promise<Contents.IModel> {
    return Promise.reject('Repository is read only');
  }

  /**
   * Delete a file.
   *
   * @param path - The path to the file.
   *
   * @returns A promise which resolves when the file is deleted.
   */
  delete(path: string): Promise<void> {
    return Promise.reject('Repository is read only');
  }

  /**
   * Rename a file or directory.
   *
   * @param path - The original file path.
   *
   * @param newPath - The new file path.
   *
   * @returns A promise which resolves with the new file contents model when
   *   the file is renamed.
   */
  rename(path: string, newPath: string): Promise<Contents.IModel> {
    return Promise.reject('Repository is read only');
  }

  /**
   * Save a file.
   *
   * @param path - The desired file path.
   *
   * @param options - Optional overrides to the model.
   *
   * @returns A promise which resolves with the file content model when the
   *   file is saved.
   */
  save(
    path: string,
    options: Partial<Contents.IModel>
  ): Promise<Contents.IModel> {
    return Promise.reject('Repository is read only');
  }

  /**
   * Copy a file into a given directory.
   *
   * @param path - The original file path.
   *
   * @param toDir - The destination directory path.
   *
   * @returns A promise which resolves with the new contents model when the
   *  file is copied.
   */
  copy(fromFile: string, toDir: string): Promise<Contents.IModel> {
    return Promise.reject('Repository is read only');
  }

  /**
   * Create a checkpoint for a file.
   *
   * @param path - The path of the file.
   *
   * @returns A promise which resolves with the new checkpoint model when the
   *   checkpoint is created.
   */
  createCheckpoint(path: string): Promise<Contents.ICheckpointModel> {
    return Promise.reject('Repository is read only');
  }

  /**
   * List available checkpoints for a file.
   *
   * @param path - The path of the file.
   *
   * @returns A promise which resolves with a list of checkpoint models for
   *    the file.
   */
  listCheckpoints(path: string): Promise<Contents.ICheckpointModel[]> {
    return Promise.resolve([]);
  }

  /**
   * Restore a file to a known checkpoint state.
   *
   * @param path - The path of the file.
   *
   * @param checkpointID - The id of the checkpoint to restore.
   *
   * @returns A promise which resolves when the checkpoint is restored.
   */
  restoreCheckpoint(path: string, checkpointID: string): Promise<void> {
    return Promise.reject('Repository is read only');
  }

  /**
   * Delete a checkpoint for a file.
   *
   * @param path - The path of the file.
   *
   * @param checkpointID - The id of the checkpoint to delete.
   *
   * @returns A promise which resolves when the checkpoint is deleted.
   */
  deleteCheckpoint(path: string, checkpointID: string): Promise<void> {
    return Promise.reject('Read only');
  }

  /**
   * List the repositories for the currently active user.
   */
  private _listRepos(user: string): Promise<Contents.IModel> {
    // First, check if the `user` string is actually an group.
    // It will return with an error if not, and we can try
    // the user path.
    const apiPath = URLExt.encodeParts(URLExt.join('groups', user, 'projects'));
    return this._apiRequest<GitLabRepo[]>(apiPath)
      .catch(err => {
        // If we can't find the org, it may be a user.
        if (err.response.status === 404) {
          const reposPath = URLExt.encodeParts(
            URLExt.join('users', user, 'projects')
          );
          return this._apiRequest<GitLabRepo[]>(reposPath);
        }
        throw err;
      })
      .then(repos => {
        // Set the states
        this._validUser = true;
        if (this.rateLimitedState.get() !== false) {
          this.rateLimitedState.set(false);
        }
        return Private.reposToDirectory(repos);
      })
      .catch(err => {
        if (
          err.response.status === 403 &&
          err.message.indexOf('rate limit') !== -1
        ) {
          if (this.rateLimitedState.get() !== true) {
            this.rateLimitedState.set(true);
          }
        } else {
          console.error(err.message);
          console.warn(
            'GitLab: cannot find user. ' + 'Perhaps you misspelled something?'
          );
          this._validUser = false;
        }
        return Private.dummyDirectory;
      });
  }

  /**
   * Determine whether to make the call via the
   * notebook server proxy or not.
   */
  private _apiRequest<T>(apiPath: string): Promise<T> {
    return this._useProxy.then(useProxy => {
      const parts = apiPath.split('?');
      let path = parts[0];
      const query = (parts[1] || '').split('&');
      const params: { [key: string]: string } = {};
      for (const param of query) {
        if (param) {
          const [key, value] = param.split('=');
          params[key] = value;
        }
      }
      let requestUrl: string;
      if (useProxy === true) {
        requestUrl = URLExt.join(this._serverSettings.baseUrl, 'gitlab');
        // add the access token if defined
        if (this.accessToken) {
          params['private_token'] = this.accessToken;
        }
      } else {
        requestUrl = URLExt.join(this.baseUrl, 'api', 'v4');
      }
      if (path) {
        if (useProxy === true) {
          // The path is expected to be url safe base64 encoded by the
          // server proxy
          path = Private.b64EncodeUrlSafe(path);
        }
        requestUrl = URLExt.join(requestUrl, path);
      }
      const newQuery = Object.keys(params)
        .map(key => `${key}=${params[key]}`)
        .join('&');
      requestUrl += '?' + newQuery;
      if (useProxy === true) {
        return proxiedApiRequest<T>(requestUrl, this._serverSettings);
      } else {
        return browserApiRequest<T>(requestUrl);
      }
    });
  }

  private _baseUrl = '';
  private _accessToken: string | null | undefined;
  private _validUser = false;
  private _serverSettings: ServerConnection.ISettings;
  private _useProxy: Promise<boolean>;
  private _fileTypeForPath: (path: string) => DocumentRegistry.IFileType;
  private _isDisposed = false;
  private _fileChanged = new Signal<this, Contents.IChangedArgs>(this);
}

/**
 * Specification for a file in a repository.
 */
export interface IGitLabResource {
  /**
   * The user or group for the resource.
   */
  readonly user: string;

  /**
   * The repository in the group/user.
   */
  readonly repository: string;

  /**
   * The path in the repository to the resource.
   */
  readonly path: string;
}

/**
 * Parse a path into a IGitLabResource.
 */
export function parsePath(path: string): IGitLabResource {
  const parts = path.split('/');
  const user = parts.length > 0 ? parts[0] : '';
  const repository = parts.length > 1 ? parts[1] : '';
  const repoPath = parts.length > 2 ? URLExt.join(...parts.slice(2)) : '';
  return { user, repository, path: repoPath };
}

/**
 * Private namespace for utility functions.
 */
namespace Private {
  /**
   * A dummy contents model indicating an invalid or
   * nonexistent repository.
   */
  export const dummyDirectory: Contents.IModel = {
    type: 'directory',
    path: '',
    name: '',
    format: 'json',
    content: [],
    created: '',
    writable: false,
    last_modified: '',
    mimetype: ''
  };

  /**
   * Given a JSON GitLabContents object returned by the GitLab API v4,
   * convert it to the Jupyter Contents.IModel.
   *
   * @param path - the path to the contents model in the repository.
   *
   * @param contents - the GitLabContents object.
   *
   * @param fileTypeForPath - a function that, given a path, returns
   *   a DocumentRegistry.IFileType, used by JupyterLab to identify different
   *   openers, icons, etc.
   *
   * @returns a Contents.IModel object.
   */
  export function gitLabContentsToJupyterContents(
    path: string,
    contents: GitLabContents | GitLabContents[],
    fileTypeForPath: (path: string) => DocumentRegistry.IFileType
  ): Contents.IModel {
    if (Array.isArray(contents)) {
      // If we have an array, it is a directory of GitLabContents.
      // Iterate over that and convert all of the items in the array/
      return {
        name: PathExt.basename(path),
        path: path,
        format: 'json',
        type: 'directory',
        writable: false,
        created: '',
        last_modified: '',
        mimetype: '',
        content: contents.map(c => {
          return gitLabContentsToJupyterContents(
            PathExt.join(path, c.name),
            c,
            fileTypeForPath
          );
        })
      } as Contents.IModel;
    } else if (
      contents.type === 'blob' ||
      // eslint-disable-next-line no-prototype-builtins
      contents.hasOwnProperty('file_name')
    ) {
      // If it is a file or blob, convert to a file
      // blob is the type returned for files by GET /projects/:id/repository/tree
      // file_name is the property checked when getting a file from a repository
      // with GET /projects/:id/repository/files/:file_path (no type is returned)
      const fileType = fileTypeForPath(path);
      const fileContents = (contents as GitLabFileContents).content;
      let content: any;
      switch (fileType.fileFormat) {
        case 'text':
          content =
            fileContents !== undefined
              ? Private.b64DecodeUTF8(fileContents)
              : null;
          break;
        case 'base64':
          content = fileContents !== undefined ? fileContents : null;
          break;
        case 'json':
          content =
            fileContents !== undefined
              ? JSON.parse(Private.b64DecodeUTF8(fileContents))
              : null;
          break;
        default:
          throw new Error(`Unexpected file format: ${fileType.fileFormat}`);
      }
      return {
        name: PathExt.basename(path),
        path: path,
        format: fileType.fileFormat,
        type: 'file',
        created: '',
        writable: false,
        last_modified: '',
        mimetype: fileType.mimeTypes[0],
        content
      };
    } else if (contents.type === 'tree') {
      // If it is a tree, convert to a directory.
      // tree is the type returned for directories by GET /projects/:id/repository/tree
      return {
        name: PathExt.basename(path),
        path: path,
        format: 'json',
        type: 'directory',
        created: '',
        writable: false,
        last_modified: '',
        mimetype: '',
        content: null
      };
    } else if (contents.type === 'commit') {
      // If it is a submodule, throw an error for now
      // Investigate if we can open them
      throw makeError(
        400,
        `Cannot open "${contents.name}" because it is a submodule`
      );
    } else {
      throw makeError(
        500,
        `"${contents.name}" has and unexpected type: ${contents.type}`
      );
    }
  }

  /**
   * Given an array of JSON GitLabRepo objects returned by the GitLab API v4,
   * convert it to the Jupyter Contents.IModel conforming to a directory of
   * those repositories.
   *
   * @param repo - the GitLabRepo object.
   *
   * @returns a Contents.IModel object.
   */
  export function reposToDirectory(repos: GitLabRepo[]): Contents.IModel {
    // If it is a directory, convert to that.
    const content: Contents.IModel[] = repos.map(repo => {
      return {
        name: repo.name,
        path: repo.path_with_namespace,
        format: 'json',
        type: 'directory',
        created: '',
        writable: false,
        last_modified: '',
        mimetype: '',
        content: null
      } as Contents.IModel;
    });

    return {
      name: '',
      path: '',
      format: 'json',
      type: 'directory',
      created: '',
      last_modified: '',
      writable: false,
      mimetype: '',
      content
    };
  }

  /**
   * Wrap an API error in a hacked-together error object
   * masquerading as an `ServerConnection.ResponseError`.
   */
  export function makeError(
    code: number,
    message: string
  ): ServerConnection.ResponseError {
    const response = new Response(message, {
      status: code,
      statusText: message
    });
    return new ServerConnection.ResponseError(response, message);
  }

  /**
   * Decoder from bytes to UTF-8.
   */
  const decoder = new TextDecoder('utf8');

  /**
   * Decode a base-64 encoded string into unicode.
   *
   * See https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding#Solution_2_%E2%80%93_rewrite_the_DOMs_atob()_and_btoa()_using_JavaScript's_TypedArrays_and_UTF-8
   */
  export function b64DecodeUTF8(str: string): string {
    const bytes = base64js.toByteArray(str.replace(/\n/g, ''));
    return decoder.decode(bytes);
  }

  /**
   * Encode a string using the URL- and filesystem-safe alphabet,
   * which substitutes - instead of + and _ instead of / in the standard Base64 alphabet.
   * The result can still contain =.
   *
   * Equivalent to Python https://docs.python.org/3/library/base64.html#base64.urlsafe_b64encode
   * Can be decoded from Python in the server extension using urlsafe_b64decode
   * https://docs.python.org/3/library/base64.html#base64.urlsafe_b64decode
   */
  export function b64EncodeUrlSafe(str: string): string {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_');
  }
}
