// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ServerConnection } from '@jupyterlab/services';

/**
 * Make a client-side request to the GitLab API.
 *
 * @param url - the api path for the GitLab API v4
 *   (not including the base url).
 *
 * @returns a Promise resolved with the JSON response.
 */
export function browserApiRequest<T>(url: string): Promise<T> {
  return window.fetch(url).then(response => {
    if (response.status !== 200) {
      return response.json().then(data => {
        throw new ServerConnection.ResponseError(response, data.message);
      });
    }
    return response.json();
  });
}

/**
 * Make a request to the notebook server proxy for the
 * GitLab API.
 *
 * @param url - the api path for the GitLab API v4
 *   (not including the base url)
 *
 * @param settings - the settings for the current notebook server.
 *
 * @returns a Promise resolved with the JSON response.
 */
export function proxiedApiRequest<T>(
  url: string,
  settings: ServerConnection.ISettings
): Promise<T> {
  return ServerConnection.makeRequest(url, {}, settings).then(response => {
    if (response.status !== 200) {
      return response.json().then(data => {
        throw new ServerConnection.ResponseError(response, data.message);
      });
    }
    return response.json();
  });
}

/**
 * Typings representing contents from the GitLab API v4.
 * Cf: https://docs.gitlab.com/ee/api/repositories.html#list-repository-tree
 *     https://docs.gitlab.com/ee/api/repository_files.html#get-file-from-repository
 *
 * GET /projects/:id/repository/tree returns
 * {
 *   "id": "a1e8f8d745cc87e3a9248358d9352bb7f9a0aeba",
 *   "name": "html",
 *   "type": "tree",
 *   "path": "files/html",
 *   "mode": "040000"
 * },
 */
export interface GitLabContents {
  /**
   * The type of the file.
   */
  type: 'blob' | 'tree' | 'commit';

  /**
   * The id of the file.
   */
  id: string;

  /**
   * The name of the file.
   */
  name: string;

  /**
   * The path of the file in the repository.
   */
  path: string;

  /**
   * The mode of the file.
   */
  mode: string;
}

/**
 * Typings representing file contents from the GitLab API v4.
 * Cf: https://docs.gitlab.com/ee/api/repository_files.html#get-file-from-repository
 *
 * GET /projects/:id/repository/files/:file_path returns
 * {
 *   "file_name": "key.rb",
 *   "file_path": "app/models/key.rb",
 *   "size": 1476,
 *   "encoding": "base64",
 *   "content": "IyA9PSBTY2hlbWEgSW5mb3...",
 *   "content_sha256": "4c294617b60715c1d218e61164a3abd4808a4284cbc30e6728a01ad9aada4481",
 *   "ref": "master",
 *   "blob_id": "79f7bbd25901e8334750839545a9bd021f0e4c83",
 *   "commit_id": "d5a3ff139356ce33e37e73add446f16869741b50",
 *   "last_commit_id": "570e7b2abdd848b95f2f578043fc23bd6f6fd24d"
 * }
 */
export interface GitLabFileContents extends GitLabContents {
  /**
   * The type of the contents.
   */
  // tslint:disable-next-line
  file_name: string;

  /**
   * The path of the file in the repository.
   */
  // tslint:disable-next-line
  file_path: string;

  /**
   * The size of the file (in bytes).
   */
  size: number;

  /**
   * The type of the contents.
   */
  type: 'blob';

  /**
   * Encoding of the content. All files are base64 encoded.
   */
  encoding: 'base64';

  /**
   * The actual base64 encoded contents.
   */
  content?: string;

  /**
   * The sha256 of the content.
   */
  // tslint:disable-next-line
  content_sha256: string;
}

/**
 * Typings representing a blob from the GitLab API v4.
 * Cf: https://docs.gitlab.com/ee/api/repositories.html#get-a-blob-from-repository
 *
 * GET /projects/:id/repository/blobs/:sha
 * {
 *     "content": "IyB0ZXN0LWludGVybmFsCgo=",
 *     "encoding": "base64",
 *     "sha": "a99be0b82f46e12138740ae0cf1bd73e40a7f6af",
 *     "size": 17
 * }
 */
export interface GitLabBlob {
  /**
   * The base64-encoded contents of the file.
   */
  content: string;

  /**
   * The encoding of the contents. Always base64.
   */
  encoding: 'base64';

  /**
   * The unique sha for the blob.
   */
  sha: string;

  /**
   * The size of the blob, in bytes.
   */
  size: number;
}

/**
 * Typings representing repositories from the GitLab API v4.
 * Cf: https://docs.gitlab.com/ee/api/groups.html#list-a-groups-projects
 *
 * #### Notes
 *   This is incomplete.
 */
export interface GitLabRepo {
  /**
   * ID for the repository.
   */
  id: number;

  /**
   * A description of the repository.
   */
  description: string;

  /**
   * The repository default branch.
   */
  // tslint:disable-next-line
  default_branch: string;

  /**
   * The name of the repository.
   */
  name: string;

  /**
   * The name of the repository, including the namespace (user or group name).
   */
  // tslint:disable-next-line
  name_with_namespace: string;

  /**
   * The path of the repository.
   */
  path: string;

  /**
   * The path of the repository, including the namesapce (user or group path).
   */
  // tslint:disable-next-line
  path_with_namespace: string;

  /**
   * The URL for the repository in the GitLab UI.
   */
  // tslint:disable-next-line
  web_url: string;
}
