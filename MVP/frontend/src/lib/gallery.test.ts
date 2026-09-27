import { describe, expect, it } from "vitest";
import { galleryImages } from "./gallery";

describe("galleryImages", () => {
  it("uses every photo the API returns, in order", () => {
    expect(
      galleryImages({
        image_url: "/images/listings/a.jpg",
        image_urls: ["/images/listings/a.jpg", "/images/listings/b.jpg", "/images/listings/c.jpg"],
      }),
    ).toEqual(["/images/listings/a.jpg", "/images/listings/b.jpg", "/images/listings/c.jpg"]);
  });

  it("falls back to the cover photo for a snapshot exported before image_urls existed", () => {
    expect(galleryImages({ image_url: "/images/listings/a.jpg" })).toEqual(["/images/listings/a.jpg"]);
  });

  it("keeps the MG Road seed listing's prototype gallery", () => {
    expect(galleryImages({ image_url: "/images/listings/mg-road-premium-unipole.png", image_urls: [] })).toEqual([
      "/images/listings/mg-road-premium-unipole.png",
      "/images/gallery/mg-road-unipole-1.png",
      "/images/gallery/mg-road-unipole-2.png",
    ]);
  });

  it("is empty when the listing has no photo", () => {
    expect(galleryImages({ image_url: null, image_urls: [] })).toEqual([]);
  });

  it("caps at the four slots the bento gallery has", () => {
    const urls = ["a", "b", "c", "d", "e"].map((n) => `/images/listings/${n}.jpg`);
    expect(galleryImages({ image_url: urls[0], image_urls: urls })).toEqual(urls.slice(0, 4));
  });
});
