"""Input normalization with no dependency on a particular proxy."""
import base64
from dataclasses import dataclass, field
import hashlib
import json
from pathlib import Path
import sys


@dataclass
class Exchange:
    request: str = None
    response: str = None
    metadata: dict = field(default_factory=dict)


def text_bytes(raw):
    return raw.decode('utf-8', errors='backslashreplace')


def header_lines(items):
    return '\n'.join(f"{item['name']}: {item['value']}" for item in items)


def from_har(entry):
    request, response = entry['request'], entry['response']
    post = request.get('postData', {})
    body = post.get('text', '')
    if not body and post.get('params'):
        body = '[HAR form parameters; original body absent]\n' + json.dumps(post['params'], ensure_ascii=False, indent=2)
    content = response.get('content', {})
    response_body = content.get('text', '[Body absent from HAR]')
    if content.get('encoding') == 'base64' and 'text' in content:
        response_body = text_bytes(base64.b64decode(response_body, validate=True))
    metadata = {'url': request['url']}
    if 'startedDateTime' in entry:
        metadata['timestamp'] = entry['startedDateTime']
    if isinstance(entry.get('time'), (int, float)) and entry['time'] >= 0:
        metadata['duration_ms'] = entry['time']
    if isinstance(content.get('size'), (int, float)) and content['size'] >= 0:
        metadata['response_bytes'] = content['size']
    return Exchange(
        f"{request['method']} {request['url']} {request.get('httpVersion') or 'HTTP/?'}\n{header_lines(request.get('headers', []))}\n\n{body}",
        f"{response.get('httpVersion') or 'HTTP/?'} {response['status']} {response.get('statusText', '')}\n{header_lines(response.get('headers', []))}\n\n{response_body}",
        metadata,
    )


def load(args):
    digests = []

    def read(path):
        raw = sys.stdin.buffer.read() if str(path) == '-' else Path(path).read_bytes()
        digests.append(hashlib.sha256(raw).hexdigest())
        return text_bytes(raw)

    if args.request:
        exchanges = [Exchange(read(args.request), read(args.response) if args.response else None)]
    elif args.har:
        entries = json.loads(read(args.har))['log']['entries']
        if args.entry is not None:
            if not 1 <= args.entry <= len(entries):
                raise ValueError('HAR entry is outside the available range')
            entries = [entries[args.entry - 1]]
        exchanges = [from_har(entry) for entry in entries]
    else:
        data = json.loads(read(args.exchange))
        values = data if isinstance(data, list) else [data]
        exchanges = []
        for item in values:
            if not isinstance(item, dict) or not any(key in item for key in ('request', 'response')):
                raise ValueError('Each exchange requires request and/or response text')
            for key in ('request', 'response'):
                if key in item and not isinstance(item[key], str):
                    raise ValueError('HTTP messages must be strings')
            metadata = item.get('metadata', {})
            if not isinstance(metadata, dict):
                raise ValueError('metadata must be an object')
            exchanges.append(Exchange(item.get('request'), item.get('response'), metadata))
    if not exchanges:
        raise ValueError('Input has no exchanges')
    for exchange in exchanges:
        for name in ('request', 'response'):
            if getattr(exchange, name) is not None and not isinstance(getattr(exchange, name), str):
                raise ValueError('HTTP messages must be strings')
    return exchanges, digests
