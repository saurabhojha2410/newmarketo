const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

/**
 * Document Parser Service
 * Extracts clean plain text from DOCX, PDF, and TXT files
 */
class DocumentParser {
    /**
     * Parse a document and extract plain text
     * @param {string} filePath - Path to the file
     * @param {string} extension - File extension (.docx, .pdf, .txt)
     * @returns {Promise<string>} Extracted plain text
     */
    async parse(filePath, extension) {
        switch (extension.toLowerCase()) {
            case '.docx':
                return this.parseDocx(filePath);
            case '.pdf':
                return this.parsePdf(filePath);
            case '.txt':
                return this.parseTxt(filePath);
            default:
                throw new Error(`Unsupported file type: ${extension}`);
        }
    }

    /**
     * Parse DOCX file using mammoth
     */
    async parseDocx(filePath) {
        const buffer = fs.readFileSync(filePath);
        const result = await mammoth.extractRawText({ buffer });
        return this.normalizeText(result.value);
    }

    /**
     * Parse PDF file using pdf-parse
     */
    async parsePdf(filePath) {
        const buffer = fs.readFileSync(filePath);
        const result = await pdfParse(buffer);
        return this.normalizeText(result.text);
    }

    /**
     * Parse plain text file
     */
    async parseTxt(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return this.normalizeText(content);
    }

    /**
     * Normalize extracted text
     * - Remove excessive whitespace
     * - Normalize line endings
     * - Remove formatting artifacts
     */
    normalizeText(text) {
        return text
            // Normalize line endings
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            // Remove excessive blank lines
            .replace(/\n{3,}/g, '\n\n')
            // Remove excessive spaces
            .replace(/[ \t]+/g, ' ')
            // Trim lines
            .split('\n')
            .map(line => line.trim())
            .join('\n')
            // Final trim
            .trim();
    }
}

module.exports = new DocumentParser();
