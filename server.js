const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

// Services
const documentParser = require('./services/documentParser');
const emailFetcher = require('./services/emailFetcher');
const functionComparator = require('./services/functionComparator');
const semanticComparator = require('./services/semanticComparator');
const reportGenerator = require('./services/reportGenerator');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.docx', '.pdf', '.txt'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only DOCX, PDF, and TXT files are allowed'));
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Store for uploaded document content
let documentStore = {
    text: null,
    filename: null,
    uploadedAt: null
};

// API Routes

// Upload document
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = req.file.path;
        const ext = path.extname(req.file.originalname).toLowerCase();

        // Parse document to extract text
        const extractedText = await documentParser.parse(filePath, ext);

        // Store the extracted text
        documentStore = {
            text: extractedText,
            filename: req.file.originalname,
            uploadedAt: new Date().toISOString()
        };

        // Clean up uploaded file
        fs.unlinkSync(filePath);

        res.json({
            success: true,
            filename: req.file.originalname,
            textLength: extractedText.length,
            preview: extractedText.substring(0, 500) + (extractedText.length > 500 ? '...' : '')
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Fetch email from URL
app.post('/api/fetch-email', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        const emailContent = await emailFetcher.fetch(url);

        res.json({
            success: true,
            textLength: emailContent.text.length,
            preview: emailContent.text.substring(0, 500) + (emailContent.text.length > 500 ? '...' : ''),
            ctaButtons: emailContent.ctaButtons,
            links: emailContent.links
        });
    } catch (error) {
        console.error('Fetch error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Run comparison
app.post('/api/compare', async (req, res) => {
    try {
        const { url, config } = req.body;

        if (!documentStore.text) {
            return res.status(400).json({ error: 'Please upload a reference document first' });
        }

        if (!url) {
            return res.status(400).json({ error: 'Email URL is required' });
        }

        // Fetch email content
        const emailContent = await emailFetcher.fetch(url);

        // Comparison configuration with defaults
        const comparisonConfig = {
            ctaTexts: config?.ctaTexts || [],
            ctaUrls: config?.ctaUrls || [],
            requiredKeywords: config?.requiredKeywords || [],
            unsubscribeText: config?.unsubscribeText || 'unsubscribe',
            footerTexts: config?.footerTexts || [],
            ...config
        };

        // Step 1: Run function-based comparison (strict)
        const functionResults = functionComparator.compare(
            documentStore.text,
            emailContent,
            comparisonConfig
        );

        // Step 2: Check if function comparison passed
        const functionPassed = Object.values(functionResults).every(r => r.status === 'PASS');

        let semanticResults = null;
        let aiSkipped = false;

        if (functionPassed) {
            // Step 3: Run AI semantic comparison
            try {
                semanticResults = await semanticComparator.compare(
                    documentStore.text,
                    emailContent.text
                );
            } catch (aiError) {
                console.error('AI comparison error:', aiError);
                semanticResults = {
                    error: aiError.message,
                    headings: { status: 'SKIPPED', reason: 'AI unavailable' },
                    body_copy: { status: 'SKIPPED', reason: 'AI unavailable' },
                    offer: { status: 'SKIPPED', reason: 'AI unavailable' }
                };
                aiSkipped = true;
            }
        } else {
            aiSkipped = true;
            semanticResults = {
                headings: { status: 'SKIPPED', reason: 'Function comparison failed' },
                body_copy: { status: 'SKIPPED', reason: 'Function comparison failed' },
                offer: { status: 'SKIPPED', reason: 'Function comparison failed' }
            };
        }

        // Generate final report
        const report = reportGenerator.generate(
            functionResults,
            semanticResults,
            functionPassed,
            aiSkipped
        );

        res.json(report);
    } catch (error) {
        console.error('Comparison error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get current document info
app.get('/api/document', (req, res) => {
    if (documentStore.text) {
        res.json({
            hasDocument: true,
            filename: documentStore.filename,
            uploadedAt: documentStore.uploadedAt,
            textLength: documentStore.text.length
        });
    } else {
        res.json({ hasDocument: false });
    }
});

// Clear document
app.delete('/api/document', (req, res) => {
    documentStore = { text: null, filename: null, uploadedAt: null };
    res.json({ success: true });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`📧 Email QA System running at http://localhost:${PORT}`);
});
