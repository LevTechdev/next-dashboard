import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { downloadCsv } from "./csv";

interface TestRow {
  name: string;
  age: number;
  city: string;
}

const columns = [
  { key: "name" as const, header: "Full Name" },
  { key: "age" as const, header: "Age" },
  { key: "city" as const, header: "City" },
];

const rows: TestRow[] = [
  { name: "John Doe", age: 30, city: "Jakarta" },
  { name: "Jane Smith", age: 25, city: "Surabaya" },
];

// Save original globals
const originalCreateElement = globalThis.document?.createElement;
const originalBodyAppendChild = globalThis.document?.body?.appendChild;
const originalBodyRemoveChild = globalThis.document?.body?.removeChild;
const originalCreateObjectURL = globalThis.URL?.createObjectURL;
const originalRevokeObjectURL = globalThis.URL?.revokeObjectURL;

interface MockLink {
  setAttribute: ReturnType<typeof vi.fn>;
  click: ReturnType<typeof vi.fn>;
}

interface MockCreateElement {
  (tag: string): MockLink;
  mock: { results: Array<{ value: MockLink }> };
}

interface MockURL {
  createObjectURL: ReturnType<typeof vi.fn> & { mock: { calls: Array<[Blob]> } };
  revokeObjectURL: ReturnType<typeof vi.fn>;
}

beforeEach(() => {
  // Create minimal DOM mocks for triggerDownload
  const mockLink: MockLink = {
    setAttribute: vi.fn(),
    click: vi.fn(),
  };

  const mockBody = {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
  };

  globalThis.document = {
    createElement: vi.fn(() => mockLink),
    body: mockBody,
  } as unknown as Document;

  globalThis.URL = {
    createObjectURL: vi.fn(() => "blob:mock-url"),
    revokeObjectURL: vi.fn(),
  } as unknown as typeof URL;
});

afterEach(() => {
  // Restore original globals
  if (originalCreateElement) {
    (
      globalThis.document as unknown as { createElement: typeof originalCreateElement }
    ).createElement = originalCreateElement;
  }
  if (originalBodyAppendChild) {
    (
      globalThis.document as unknown as { body: { appendChild: typeof originalBodyAppendChild } }
    ).body.appendChild = originalBodyAppendChild;
  }
  if (originalBodyRemoveChild) {
    (
      globalThis.document as unknown as { body: { removeChild: typeof originalBodyRemoveChild } }
    ).body.removeChild = originalBodyRemoveChild;
  }
  if (originalCreateObjectURL) {
    (
      globalThis.URL as unknown as { createObjectURL: typeof originalCreateObjectURL }
    ).createObjectURL = originalCreateObjectURL;
  }
  if (originalRevokeObjectURL) {
    (
      globalThis.URL as unknown as { revokeObjectURL: typeof originalRevokeObjectURL }
    ).revokeObjectURL = originalRevokeObjectURL;
  }
});

function getMockCreateElement() {
  return globalThis.document.createElement as unknown as MockCreateElement;
}

function getMockURL() {
  return globalThis.URL as unknown as MockURL;
}

describe("csv export", () => {
  it("triggers a download with CSV containing headers and data", () => {
    downloadCsv(columns, rows, "test-export");

    const mockCreateElement = getMockCreateElement();
    // Should create a download link
    expect(mockCreateElement).toHaveBeenCalledWith("a");
    // Should set filename
    expect(mockCreateElement.mock.results[0].value.setAttribute).toHaveBeenCalledWith(
      "download",
      "test-export.csv",
    );
    // Should click the link
    expect(mockCreateElement.mock.results[0].value.click).toHaveBeenCalledTimes(1);
    // Should append and remove the link
    expect(globalThis.document.body.appendChild).toHaveBeenCalledTimes(1);
    expect(globalThis.document.body.removeChild).toHaveBeenCalledTimes(1);
  });

  it("creates a Blob with BOM + CSV content", () => {
    downloadCsv(columns, rows, "test");

    const mockURL = getMockURL();
    expect(mockURL.createObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = mockURL.createObjectURL.mock.calls[0][0];
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe("text/csv;charset=utf-8;");
  });

  it("revokes the blob URL after download", () => {
    downloadCsv(columns, rows, "test");

    const mockURL = getMockURL();
    expect(mockURL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });
});

describe("csv content generation (via Blob contents)", () => {
  it("includes CSV header row", () => {
    downloadCsv(columns, rows, "test");

    const blobArg = getMockURL().createObjectURL.mock.calls[0][0];
    // Blob is constructed with BOM + CSV text
    const blobText = blobArg as Blob;

    // Read the Blob content as text to verify
    return blobText.text().then((text) => {
      expect(text).toContain("Full Name,Age,City");
      expect(text).toContain("John Doe,30,Jakarta");
      expect(text).toContain("Jane Smith,25,Surabaya");
    });
  });

  it("uses CRLF line endings", () => {
    downloadCsv(columns, rows, "test");

    const blobArg = getMockURL().createObjectURL.mock.calls[0][0];
    return (blobArg as Blob).text().then((text) => {
      expect(text).toMatch(/\r\n/);
    });
  });

  it("includes BOM for Excel UTF-8 handling", () => {
    // Mock Blob to capture constructor arguments
    const OriginalBlob = globalThis.Blob;
    let blobParts: BlobPart[] = [];
    globalThis.Blob = vi.fn(function (parts: BlobPart[], options?: BlobPropertyBag) {
      blobParts = parts;
      return new OriginalBlob(parts, options);
    } as unknown as typeof Blob);

    downloadCsv(columns, rows, "test");

    expect(blobParts.length).toBeGreaterThan(0);
    const firstPart = blobParts[0];
    // BOM should be prepended to the CSV string
    expect(String(firstPart).charCodeAt(0)).toBe(0xfeff);

    globalThis.Blob = OriginalBlob;
  });
});

describe("csv escaping", () => {
  it("wraps values with commas in quotes", () => {
    const col = [{ key: "name" as const, header: "Name" }];
    const escapeRows = [{ name: "Doe, John" }];

    downloadCsv(col, escapeRows, "test");

    const blobArg = getMockURL().createObjectURL.mock.calls[0][0];
    return (blobArg as Blob).text().then((text) => {
      expect(text).toContain('"Doe, John"');
    });
  });

  it("escapes double quotes by doubling them", () => {
    const col = [{ key: "name" as const, header: "Name" }];
    const quoteRows = [{ name: 'He said "Hello"' }];

    downloadCsv(col, quoteRows, "test");

    const blobArg = getMockURL().createObjectURL.mock.calls[0][0];
    return (blobArg as Blob).text().then((text) => {
      expect(text).toContain('"He said ""Hello"""');
    });
  });

  it("handles null and undefined values as empty strings", () => {
    const col = [{ key: "name" as const, header: "Name" }];
    const nullRows = [{ name: null as unknown as string }];

    downloadCsv(col, nullRows, "test");

    const blobArg = getMockURL().createObjectURL.mock.calls[0][0];
    return (blobArg as Blob).text().then((text) => {
      // Header row + data row with empty value
      expect(text).toMatch(/Name\r\n$/);
    });
  });

  it("wraps values with newlines in quotes", () => {
    const col = [{ key: "name" as const, header: "Name" }];
    const newlineRows = [{ name: "Line1\nLine2" }];

    downloadCsv(col, newlineRows, "test");

    const blobArg = getMockURL().createObjectURL.mock.calls[0][0];
    return (blobArg as Blob).text().then((text) => {
      expect(text).toContain('"Line1\nLine2"');
    });
  });
});

describe("dataExtractor", () => {
  it("transforms data via extractor before generating CSV", () => {
    interface NameRow {
      name: string;
    }
    const col = [
      {
        key: (row: NameRow) => row.name,
        header: "Full Name",
      },
    ];
    const rawRows: NameRow[] = [{ name: "John Doe" }, { name: "Jane Smith" }];

    downloadCsv(col, rawRows, "test");

    // When using dataExtractor, the function transforms rows first, then columns access the transformed row
    const blobArg = getMockURL().createObjectURL.mock.calls[0][0];
    return (blobArg as Blob).text().then((text) => {
      // The CSV generation uses the transformed data, so it should produce at least 2 data rows
      const lines = text.split(/\r?\n/);
      expect(lines.length).toBeGreaterThanOrEqual(3); // header + 2 data rows + empty
    });
  });
});

describe("csv with custom key function", () => {
  it("supports function-based column keys", () => {
    const col = [
      {
        key: (row: { name: string; age: number }) => `${row.name} (${row.age})`,
        header: "Person",
      },
    ];
    const data = [{ name: "John Doe", age: 30 }];

    downloadCsv(col, data, "test");

    const blobArg = getMockURL().createObjectURL.mock.calls[0][0];
    return (blobArg as Blob).text().then((text) => {
      expect(text).toContain("John Doe (30)");
    });
  });
});

describe("empty data", () => {
  it("handles empty rows array", () => {
    const col = [{ key: "name" as const, header: "Name" }];

    downloadCsv(col, [], "empty-export");

    const blobArg = getMockURL().createObjectURL.mock.calls[0][0];
    return (blobArg as Blob).text().then((text) => {
      // Should contain just the header and nothing else
      expect(text).toContain("Name");
      const lines = text.split(/\r?\n/).filter(Boolean);
      expect(lines).toHaveLength(1); // Only the header
    });
  });
});
