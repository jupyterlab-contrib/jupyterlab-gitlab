import base64
import binascii
import re
import json
import copy

import tornado
import tornado.gen as gen
from tornado.httputil import url_concat
from tornado.httpclient import AsyncHTTPClient, HTTPRequest, HTTPError

from traitlets import Unicode, Bool
from traitlets.config import Configurable

from jupyter_server.utils import url_path_join
from jupyter_server.base.handlers import APIHandler

link_regex = re.compile(r'<([^>]*)>;\s*rel="([\w]*)\"')


class GitLabConfig(Configurable):
    """
    Allows configuration of access to the GitLab api
    """

    allow_client_side_access_token = Bool(
        False,
        config=True,
        help=(
            "If True the access token specified in the JupyterLab settings "
            "will take precedence. If False the token specified in JupyterLab "
            "will be ignored. Storing your access token in the client can "
            "present a security risk so be careful if enabling this setting."
        ),
    )
    url = Unicode(
        "https://gitlab.com", config=True, help="The url for the GitLab instance."
    )
    access_token = Unicode(
        "", config=True, help=("A personal access or OAuth2 token for GitLab.")
    )
    validate_cert = Bool(
        True,
        config=True,
        help=(
            "Whether to validate the servers' SSL certificate on requests "
            "made to the GitLab api. In general this is a bad idea so only "
            "disable SSL validation if you know what you are doing!"
        ),
    )


class GitLabHandler(APIHandler):
    """
    A proxy for the GitLab API v4.

    The purpose of this proxy is to provide authentication to the API requests
    which allows for a higher rate limit. Without this, the rate limit on
    unauthenticated calls is so limited as to be practically useless.
    """

    @tornado.web.authenticated
    @gen.coroutine
    def get(self, path):
        """
        Proxy API requests to GitLab, adding authentication parameter(s) if
        they have been set.
        """

        # Get access to the notebook config object
        c = GitLabConfig(config=self.config)
        # The server only accepts url safe base64 encoded path.
        # This is to avoid tornado route matching decoding the url
        # and replacing %2F with / in the url.
        # We use namespaced API calls and NAMESPACE/PROJECT_NAME is
        # already encoded as NAMESPACE%2FPROJECT_NAME
        # https://docs.gitlab.com/ee/api/#namespaced-path-encoding
        try:
            path = base64.urlsafe_b64decode(path).decode("utf-8")
        except binascii.Error as e:
            raise HTTPError(
                400,
                "The server only accepts url safe base64 encoded path: {}".format(e),
            )
        try:
            query = self.request.query_arguments
            params = {key: query[key][0].decode() for key in query}
            api_path = url_path_join(c.url, "api", "v4", path)
            params["per_page"] = 100

            access_token = params.pop("private_token", None)
            if access_token and c.allow_client_side_access_token:
                token = access_token
            elif access_token and not c.allow_client_side_access_token:
                msg = (
                    "Client side (JupyterLab) access tokens have been "
                    "disabled for security reasons.\nPlease remove your "
                    "access token from JupyterLab and instead add it to "
                    "your notebook configuration file:\n"
                    "c.GitLabConfig.access_token = '<TOKEN>'\n"
                )
                raise HTTPError(403, msg)
            elif c.access_token != "":
                token = c.access_token
            else:
                token = ""

            if token:
                headers = {"Authorization": "Bearer {}".format(token)}
            else:
                headers = {}
            api_path = url_concat(api_path, params)
            client = AsyncHTTPClient()
            request = HTTPRequest(
                api_path,
                validate_cert=c.validate_cert,
                user_agent="JupyterLab GitLab",
                headers=headers,
            )
            response = yield client.fetch(request)
            data = json.loads(response.body.decode("utf-8"))

            # Check if we need to paginate results.
            # If so, get pages until all the results
            # are loaded into the data buffer.
            next_page_path = self._maybe_get_next_page_path(response)
            while next_page_path:
                request = copy.copy(request)
                request.url = next_page_path
                response = yield client.fetch(request)
                next_page_path = self._maybe_get_next_page_path(response)
                data.extend(json.loads(response.body.decode("utf-8")))

            # Send the results back.
            self.finish(json.dumps(data))

        except HTTPError as err:
            self.set_status(err.code)
            message = err.response.body if err.response else str(err.code)
            self.finish(message)

    def _maybe_get_next_page_path(self, response):
        # If there is a 'Link' header in the response, we
        # need to paginate.
        link_headers = response.headers.get_list("Link")
        next_page_path = None
        if link_headers:
            links = {}
            matched = link_regex.findall(link_headers[0])
            for match in matched:
                links[match[1]] = match[0]
            next_page_path = links.get("next", None)

        return next_page_path


def setup_handlers(web_app):
    base_url = web_app.settings["base_url"]
    endpoint = url_path_join(base_url, "gitlab")
    handlers = [(endpoint + "/(.*)", GitLabHandler)]
    web_app.add_handlers(".*$", handlers)
