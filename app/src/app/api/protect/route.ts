import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

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

        const { width, height } = lastPage.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        if (method === "white-text") {
            // White text injection — invisible text on white background
            const fontSize = 1; // Very small font size
            const textWidth = font.widthOfTextAtSize(prompt, fontSize);
            const x = (width - textWidth) / 2;
            const y = 15; // Near bottom of page

            lastPage.drawText(prompt, {
                x,
                y,
                size: fontSize,
                font,
                color: rgb(1, 1, 1), // White text
                opacity: 0.01, // Nearly invisible
            });
        } else if (method === "different-language") {
            // For different language method, we embed the actual prompt text
            // but style it to look like symbol characters by making it very small
            // and positioning it where it won't be noticed
            // The actual wingdings conversion happens visually but the underlying
            // text remains the prompt for copy-paste extraction by LLMs
            const fontSize = 1;
            const x = 20;
            const y = 10;

            lastPage.drawText(prompt, {
                x,
                y,
                size: fontSize,
                font,
                color: rgb(0.95, 0.95, 0.95), // Nearly white
                opacity: 0.02,
            });
        } else if (method === "font-embedding") {
            // Font embedding is guided — we still inject the prompt as white text
            // as a fallback, but the real font-embedding requires manual setup
            const fontSize = 1;
            const x = 20;
            const y = 10;

            lastPage.drawText(prompt, {
                x,
                y,
                size: fontSize,
                font,
                color: rgb(1, 1, 1),
                opacity: 0.01,
            });
        }

        // Add metadata to PDF for tracking
        pdfDoc.setSubject(`PaperShield Protected | Method: ${method}`);

        const modifiedPdfBytes = await pdfDoc.save();

        // Convert to a proper Web API Blob so Next.js doesn't corrupt the binary data
        // pdf-lib returns Uint8Array, we wrap it in a Blob for a clean binary response
        const blob = new Blob([modifiedPdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });

        return new NextResponse(blob, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="protected_paper.pdf"`,
            },
        });
    } catch (error) {
        console.error("PDF processing error:", error);
        return NextResponse.json(
            { error: "Failed to process PDF" },
            { status: 500 }
        );
    }
}
