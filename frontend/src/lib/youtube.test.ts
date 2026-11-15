import { youtubeId } from "./youtube";

describe("youtubeId", () => {
  it.each([
    ["https://www.youtube.com/watch?v=abc123XYZ_-", "abc123XYZ_-"],
    ["https://youtu.be/abc123", "abc123"],
    ["https://youtube.com/shorts/abc123", "abc123"],
    ["https://m.youtube.com/watch?v=abc123&t=10", "abc123"],
  ])("parses %s", (url, id) => {
    expect(youtubeId(url)).toBe(id);
  });

  it("returns null for other links", () => {
    expect(youtubeId("https://vimeo.com/123")).toBeNull();
    expect(youtubeId("not a url")).toBeNull();
    expect(youtubeId("")).toBeNull();
  });
});
