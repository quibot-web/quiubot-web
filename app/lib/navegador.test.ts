import { describe, expect, it } from "vitest";
import { esSafari, nombreNavegador } from "./navegador";

describe("nombreNavegador", () => {
  it("reconoce Safari, Chrome, Edge y Firefox (Chrome y Edge también dicen 'Safari' en su user agent)", () => {
    expect(nombreNavegador("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.1 Safari/605.1.15")).toBe("Safari 26.6");
    expect(nombreNavegador("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.8103.79 Safari/537.36")).toBe("Chrome 157.0");
    expect(nombreNavegador("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.1")).toBe("Edge 157.0");
    expect(nombreNavegador("Mozilla/5.0 (Windows NT 10.0; rv:140.0) Gecko/20100101 Firefox/140.0")).toBe("Firefox 140.0");
    expect(esSafari("Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.1 Safari/605.1.15")).toBe(true);
    expect(esSafari("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0 Safari/537.36")).toBe(false);
  });
});
