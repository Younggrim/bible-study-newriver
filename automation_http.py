#!/usr/bin/env python3
"""
Small HTTP helper shared by check_new_videos.py and check_video_links.py.

It exists because of one environment problem. On the machine these repos are
authored from, all traffic goes through a TLS-inspecting corporate proxy whose
CA certificate has no Authority Key Identifier extension. Python's OpenSSL
rejects that outright:

    CERTIFICATE_VERIFY_FAILED: Missing Authority Key Identifier

curl validates against the system trust store and works fine. So rather than
failing whenever a script is run by hand, this transparently falls back to curl
the first time urllib hits an SSL error, and stays on curl for the rest of the
run. On a CI runner urllib works and curl is never used.

Both transports report the same thing: an integer HTTP status and the body as
text. A status of 0 means the request never completed.
"""
import json
import os
import ssl
import subprocess
import sys
import urllib.error
import urllib.request

USER_AGENT = "Mozilla/5.0 (compatible; bible-study-automation)"
DEFAULT_TIMEOUT = 20

# Flipped to "curl" permanently if urllib cannot do TLS in this environment.
_transport = "urllib"
_warned = False


def _ssl_context():
    cafile = os.environ.get("SSL_CERT_FILE") or os.environ.get("REQUESTS_CA_BUNDLE")
    if cafile and os.path.isfile(cafile):
        try:
            return ssl.create_default_context(cafile=cafile)
        except (OSError, ssl.SSLError):
            pass
    return None


def _get_urllib(url, timeout):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout,
                                    context=_ssl_context()) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        # A 401 or 404 is a real answer, not a failure.
        return e.code, e.read().decode("utf-8", "replace")


def _get_curl(url, timeout):
    conf = "\n".join([
        f'url = "{url}"',
        f'user-agent = "{USER_AGENT}"',
        f'max-time = {timeout}',
        "silent", "show-error", "location",
        'write-out = "\\n%{http_code}"',
    ]) + "\n"
    # encoding and errors are explicit because text=True otherwise decodes with
    # the locale's encoding, and under a C locale that is ASCII. Every feed this
    # module reads carries curly quotes and en-dashes in its titles, so a run in
    # a C locale failed on the first one with UnicodeDecodeError while the urllib
    # transport, which has always used .decode("utf-8", "replace"), handled the
    # same body fine. This makes the two transports behave the way the module
    # docstring says they do.
    r = subprocess.run(["curl", "-K", "-"], input=conf,
                       capture_output=True, text=True,
                       encoding="utf-8", errors="replace",
                       timeout=timeout + 15)
    if r.returncode != 0 and not r.stdout:
        raise OSError(r.stderr.strip() or f"curl exit {r.returncode}")
    body, _, code = r.stdout.rpartition("\n")
    return (int(code.strip()) if code.strip().isdigit() else 0), body


def get(url, timeout=DEFAULT_TIMEOUT):
    """Fetch a URL. Returns (status, body_text). Raises on transport failure
    so callers can retry, but returns normally for real HTTP error codes."""
    global _transport, _warned
    if _transport == "urllib":
        try:
            return _get_urllib(url, timeout)
        except (ssl.SSLError, ssl.SSLCertVerificationError):
            _transport = "curl"
            if not _warned:
                _warned = True
                print("NOTE: urllib cannot verify TLS in this environment, "
                      "falling back to curl for the rest of this run.",
                      file=sys.stderr)
        except urllib.error.URLError as e:
            # An SSL problem often arrives wrapped in URLError.
            if isinstance(getattr(e, "reason", None), ssl.SSLError):
                _transport = "curl"
                if not _warned:
                    _warned = True
                    print("NOTE: urllib cannot verify TLS in this environment, "
                          "falling back to curl for the rest of this run.",
                          file=sys.stderr)
            else:
                raise
    return _get_curl(url, timeout)


def get_json(url, timeout=DEFAULT_TIMEOUT):
    """Returns (status, parsed_or_None). Unparseable body yields None."""
    status, body = get(url, timeout)
    if status != 200 or not body.strip():
        return status, None
    try:
        return status, json.loads(body)
    except ValueError:
        return status, None


def transport():
    """Which transport the last request used, for diagnostics."""
    return _transport
