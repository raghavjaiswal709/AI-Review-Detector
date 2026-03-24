import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, PDFFont, rgb, StandardFonts, degrees } from "pdf-lib";

// ── Inline homoglyph map ────────────────────────────────────────────────────
// Kept here (not imported from watermark.ts) so this server-side route stays
// fully self-contained and avoids any Next.js client/server bundle conflicts.
// ISO-8859-1 diacritic substitution — Courier supports all these code points.
const ROUTE_HOMOGLYPH_MAP: Record<string, string> = {
    'a': 'à', 'c': 'ç', 'e': 'è', 'i': 'ì', 'n': 'ñ',
    'o': 'ò', 'u': 'ù', 'y': 'ÿ',
    'A': 'À', 'C': 'Ç', 'E': 'È', 'I': 'Ì', 'N': 'Ñ',
    'O': 'Ò', 'U': 'Ù', 'Y': 'Ý',
};

function applyHomoglyphs(text: string): string {
    return text.split('').map(c => ROUTE_HOMOGLYPH_MAP[c] ?? c).join('');
}

// ── Wraps text into lines that fit within maxWidth at the given fontSize ────
function wrapText(
    text: string,
    font: PDFFont,
    fontSize: number,
    maxWidth: number
): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, fontSize) > maxWidth && current) {
            lines.push(current);
            current = word;
        } else {
            current = candidate;
        }
    }
    if (current) lines.push(current);
    return lines;
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const pdfFile = formData.get("pdf") as File;
        const prompt = formData.get("prompt") as string;
        const method = formData.get("method") as string;

        if (!pdfFile || !prompt) {
            return NextResponse.json(
                { error: "PDF file and prompt are required" },
                { status: 400 }
            );
        }

        const pdfBytes = await pdfFile.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();
        const lastPage = pages[pages.length - 1];
        const firstPage = pages[0];

        const { width } = lastPage.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        // =====================================================================
        // LAYER 1 — Method-specific injection
        // Each method encodes the instruction differently in the PDF content
        // stream. Every Layer 1 block is individually try-caught: if anything
        // fails (e.g. an unsupported glyph in the chosen font), Layer 1 is
        // silently skipped — Layers 2 and 3 still carry the full instruction.
        // =====================================================================

        if (method === "white-text") {
            // ── White Text ──────────────────────────────────────────────────
            // Plain instruction, white color, near-zero opacity, Helvetica.
            // Invisible to humans; copy-paste and text-extraction recover it.
            try {
                const fontSize = 1;
                const textWidth = font.widthOfTextAtSize(prompt, fontSize);
                const x = (width - textWidth) / 2;

                lastPage.drawText(prompt, {
                    x,
                    y: 15,
                    size: fontSize,
                    font,
                    color: rgb(1, 1, 1),
                    opacity: 0.01,
                });
            } catch (e) {
                console.warn("[PaperShield] white-text Layer 1 skipped:", e);
            }

        } else if (method === "different-language") {
            // ── Symbol Language ─────────────────────────────────────────────
            // ZapfDingbats maps each ASCII byte to a dingbat symbol glyph.
            // A human sees decorative symbols; PDF text-extraction and LLM
            // text-processing recover the original ASCII instruction bytes.
            //
            // Only printable ASCII characters are safe to pass to ZapfDingbats
            // (range 0x21–0x7E). Characters outside that range (smart quotes,
            // accents, etc.) are stripped to prevent encoding errors.
            try {
                const dingbatsFont = await pdfDoc.embedFont(StandardFonts.ZapfDingbats);
                const symbolFontSize = 3;

                // Filter to ZapfDingbats-safe range: printable ASCII 0x21–0x7E + space
                const safePrompt = prompt
                    .split("")
                    .filter(ch => {
                        const code = ch.charCodeAt(0);
                        return code === 0x20 || (code >= 0x21 && code <= 0x7E);
                    })
                    .join("");

                if (safePrompt.length > 0) {
                    const symbolLines = wrapText(safePrompt, font, symbolFontSize, width - 60);
                    symbolLines.forEach((line, i) => {
                        lastPage.drawText(line, {
                            x: 30,
                            y: 30 + i * (symbolFontSize + 2), // above ghost-text zone (y=6–20)
                            size: symbolFontSize,
                            font: dingbatsFont,
                            color: rgb(0.72, 0.72, 0.72), // imperceptible to humans, readable by LLM vision
                            opacity: 1.0,
                        });
                    });
                }
            } catch (e) {
                console.warn("[PaperShield] different-language Layer 1 skipped:", e);
            }

        } else if (method === "font-embedding") {
            // ── Font Embedding ──────────────────────────────────────────────
            // ISO-8859-1 diacritic substitution via Courier (monospace).
            // Each substituted character (à, è, ì, ò, ù …) is within the
            // WinAnsi/ISO-8859-1 range that Courier fully supports.
            // The content stream bytes differ from plain ASCII — software
            // approximation of the SwapP1–SwapP12 custom-font steganography
            // from the research paper.
            try {
                const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);
                const encodedText = applyHomoglyphs(prompt);
                const fontSize = 1;
                // Courier is monospace (600 units/char), so width is always exact.
                const textWidth = courierFont.widthOfTextAtSize(encodedText, fontSize);
                const x = Math.max(0, (width - textWidth) / 2);

                lastPage.drawText(encodedText, {
                    x,
                    y: 12,
                    size: fontSize,
                    font: courierFont,
                    color: rgb(1, 1, 1),
                    opacity: 0.01,
                });
            } catch (e) {
                console.warn("[PaperShield] font-embedding Layer 1 skipped:", e);
            }
        }

        // =====================================================================
        // LAYER 2 — Ghost text (plain text, all methods)
        //
        // When a reviewer uploads the PDF to an LLM, the LLM renders each page
        // as an image and reads it with vision. Layer 1 (white/encoded text)
        // disappears in the rendered image. Ghost text uses rgb(0.82, 0.82, 0.82)
        // at full opacity so it is present in the rendered image but imperceptible
        // to a human scanning the paper at normal reading distance. Injected on
        // both the first and last page for maximum coverage.
        // =====================================================================
        const ghostFontSize = 3;
        const sideMargin = 22;
        const maxLineWidth = width - sideMargin * 2;
        const ghostLines = wrapText(prompt, font, ghostFontSize, maxLineWidth);

        const ghostPages = pages.length > 1 ? [firstPage, lastPage] : [firstPage];

        for (const page of ghostPages) {
            const { height: pageHeight } = page.getSize();

            // Bottom margin — stack lines from y=6 upward
            ghostLines.forEach((line, i) => {
                page.drawText(line, {
                    x: sideMargin,
                    y: 6 + i * (ghostFontSize + 1),
                    size: ghostFontSize,
                    font,
                    color: rgb(0.82, 0.82, 0.82),
                    opacity: 1.0,
                });
            });

            // Left margin — rotated 90°, orthogonal second channel
            const snippet = prompt.length > 90 ? prompt.substring(0, 90) : prompt;
            page.drawText(snippet, {
                x: 5,
                y: pageHeight / 2 + font.widthOfTextAtSize(snippet, 2) / 2,
                size: 2,
                font,
                color: rgb(0.85, 0.85, 0.85),
                rotate: degrees(90),
                opacity: 1.0,
            });
        }

        // =====================================================================
        // LAYER 3 — Metadata blast (plain text, all methods)
        //
        // Many LLM PDF processors extract document metadata (Info dictionary)
        // and include it as additional context. Injecting into all metadata
        // fields maximises coverage regardless of the reviewer's pipeline.
        // =====================================================================
        pdfDoc.setSubject(`PaperShield Protected | Method: ${method} | ${prompt}`);
        pdfDoc.setKeywords([`INSTRUCTION: ${prompt}`, "PaperShield"]);
        pdfDoc.setCreator(prompt);
        pdfDoc.setProducer("PaperShield v2");

        const modifiedPdfBytes = await pdfDoc.save();
        const blob = new Blob([modifiedPdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });

        return new NextResponse(blob, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="protected_paper.pdf"`,
            },
        });

    } catch (error) {
        // Surface the real error in dev — the client only sees the generic message.
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[PaperShield] PDF processing error:", msg, error);
        return NextResponse.json(
            { error: "Failed to process PDF", detail: msg },
            { status: 500 }
        );
    }
}
