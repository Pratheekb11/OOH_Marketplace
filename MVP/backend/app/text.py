"""Plain-text normalisation for listing copy.

Scraped descriptions arrive as HTML fragments (`<p>Skywalk Advertising…</p>`)
and the listing page renders text, not markup, so the tags showed up
literally. `html_to_text` keeps what a reader needs -- the words and the
paragraph breaks -- and drops the rest. Paragraphs come out separated by a
blank line and forced line breaks by a single newline, which is all the
frontend splits on.
"""
from __future__ import annotations

import re
from html import unescape
from html.parser import HTMLParser

_TAG = re.compile(r"<\s*/?\s*[a-zA-Z!]")
_SPACE = re.compile(r"[ \t\r\n\f\v ]+")
_HORIZONTAL_SPACE = re.compile(r"[ \t\f\v ]+")

# Markers that cannot occur in real text, swapped for newlines at the end.
_PARA = "\x00P\x00"
_LINE = "\x00L\x00"

_BLOCK_TAGS = {
    "address", "article", "aside", "blockquote", "dd", "div", "dl", "dt", "figcaption",
    "figure", "footer", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "li", "main",
    "nav", "ol", "p", "pre", "section", "table", "tr", "ul",
}
_SKIP_TAGS = {"script", "style", "template", "noscript", "head", "title"}


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in _SKIP_TAGS:
            self._skip_depth += 1
        elif tag == "br":
            self.parts.append(_LINE)
        elif tag in _BLOCK_TAGS:
            self.parts.append(_PARA)

    def handle_startendtag(self, tag, attrs):
        if tag == "br":
            self.parts.append(_LINE)
        elif tag in _BLOCK_TAGS:
            self.parts.append(_PARA)

    def handle_endtag(self, tag):
        if tag in _SKIP_TAGS:
            self._skip_depth = max(0, self._skip_depth - 1)
        elif tag in _BLOCK_TAGS:
            self.parts.append(_PARA)

    def handle_data(self, data):
        if not self._skip_depth:
            self.parts.append(_SPACE.sub(" ", data))


def _join(paragraphs: list[list[str]]) -> str:
    cleaned = []
    for lines in paragraphs:
        kept = [line for line in (_HORIZONTAL_SPACE.sub(" ", raw).strip() for raw in lines) if line]
        if kept:
            cleaned.append("\n".join(kept))
    return "\n\n".join(cleaned)


def html_to_text(value: str | None) -> str:
    """Strip markup from `value`, keeping paragraph and line breaks."""
    if not value:
        return ""
    if not _TAG.search(value):
        # Already plain text (an owner typed it): keep their own blank-line
        # paragraphs and line breaks, just tidy the spacing.
        text = unescape(value).replace("\r\n", "\n")
        return _join([p.split("\n") for p in re.split(r"\n\s*\n", text)])

    parser = _TextExtractor()
    parser.feed(value)
    parser.close()
    flat = "".join(parser.parts)
    return _join([p.split(_LINE) for p in flat.split(_PARA)])
