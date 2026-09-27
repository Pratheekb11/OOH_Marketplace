"""P0-2: listing descriptions are plain text, never markup.

Scraped descriptions arrive as HTML (`<p>Skywalk Advertising…</p>`) and the
page rendered the tags literally. Descriptions are cleaned on the way in (so
new rows are stored clean) AND on the way out (so rows already in the hosted
database are fixed the moment the API deploys, without a data migration).

Paragraph structure survives as blank lines, so the page can still split it.
"""
from app.models import Listing, ListingStatus
from scripts.export_static import listing_json
from scripts.import_scraped import listing_fields


def post_listing(client, headers, description):
    response = client.post(
        "/api/v1/listings",
        json={
            "title": "Skywalk - Ashok Nagar",
            "space_type": "Skywalk",
            "description": description,
            "location": "Ashok Nagar, Bengaluru",
            "price_per_day": 30000.0,
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def insert_raw(session_factory, description):
    """Simulate a row that was imported before cleaning existed."""
    with session_factory() as db:
        listing = Listing(
            owner_id=1,
            title="Legacy scraped row",
            space_type="Skywalk",
            description=description,
            location="Ashok Nagar, Bengaluru",
            price_per_day=30000.0,
            status=ListingStatus.active,
        )
        db.add(listing)
        db.commit()
        return listing.id


def test_paragraph_tags_are_removed(actors):
    created = post_listing(actors["client"], actors["owner"], "<p>Skywalk Advertising in Ashok Nagar.</p>")
    assert created["description"] == "Skywalk Advertising in Ashok Nagar."


def test_paragraphs_become_blank_line_separated(actors):
    created = post_listing(actors["client"], actors["owner"], "<p>First paragraph.</p>\n<p>Second paragraph.</p>")
    assert created["description"] == "First paragraph.\n\nSecond paragraph."


def test_line_breaks_become_newlines(actors):
    created = post_listing(actors["client"], actors["owner"], "Line one<br>Line two<br/>Line three")
    assert created["description"] == "Line one\nLine two\nLine three"


def test_entities_are_decoded(actors):
    created = post_listing(actors["client"], actors["owner"], "<p>Print &amp; install &ndash; 24&nbsp;hrs</p>")
    assert created["description"] == "Print & install – 24 hrs"


def test_script_and_style_content_is_dropped(actors):
    created = post_listing(
        actors["client"],
        actors["owner"],
        "<script>alert(1)</script><style>p{color:red}</style><p>Visible text</p>",
    )
    assert created["description"] == "Visible text"


def test_inline_tags_are_unwrapped_and_whitespace_collapsed(actors):
    created = post_listing(
        actors["client"], actors["owner"], "<div>  High   <strong>visibility</strong>\n\t junction  </div>"
    )
    assert created["description"] == "High visibility junction"


def test_plain_text_is_unchanged(actors):
    created = post_listing(actors["client"], actors["owner"], "A 40ft hoarding facing Outer Ring Road.")
    assert created["description"] == "A 40ft hoarding facing Outer Ring Road."


def test_update_is_cleaned_too(actors):
    client = actors["client"]
    created = post_listing(client, actors["owner"], "clean")
    response = client.put(
        f"/api/v1/listings/{created['id']}",
        json={
            "title": "Skywalk - Ashok Nagar",
            "space_type": "Skywalk",
            "description": "<p>Updated <em>copy</em></p>",
            "location": "Ashok Nagar, Bengaluru",
            "price_per_day": 30000.0,
        },
        headers=actors["owner"],
    )
    assert response.status_code == 200, response.text
    assert response.json()["description"] == "Updated copy"


def test_rows_stored_with_html_are_cleaned_on_read(client):
    test_client, session_factory = client
    listing_id = insert_raw(session_factory, "<p>Skywalk Advertising in Ashok Nagar displays campaigns.</p>")

    detail = test_client.get(f"/api/v1/listings/{listing_id}")
    assert detail.status_code == 200
    assert detail.json()["description"] == "Skywalk Advertising in Ashok Nagar displays campaigns."

    browse = test_client.get("/api/v1/listings")
    assert [i["description"] for i in browse.json()["items"]] == [
        "Skywalk Advertising in Ashok Nagar displays campaigns."
    ]


def test_static_snapshot_description_is_clean(client):
    _, session_factory = client
    listing_id = insert_raw(session_factory, "<p>Snapshot &amp; copy</p>")
    with session_factory() as db:
        row = listing_json(db.get(Listing, listing_id))
    assert row["description"] == "Snapshot & copy"


def test_importer_stores_clean_description():
    record = {
        "title": "Skywalk - Ashok Nagar Bengaluru, 30102",
        "location": "Ashok Nagar, Bengaluru",
        "price_per_day": 30000.0,
        "description": "<p>Skywalk Advertising in Ashok Nagar.</p> ",
        "source_id": "abc",
    }
    fields = listing_fields(record, owner_id=1, image_url=None)
    assert fields["description"] == "Skywalk Advertising in Ashok Nagar."
