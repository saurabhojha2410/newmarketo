const OpenAI = require('openai');

/**
 * Semantic Comparator Service
 * Uses AI to perform semantic comparison of email content
 */
class SemanticComparator {
    constructor() {
        this.openai = null;
        this.initialized = false;
    }

    /**
     * Initialize OpenAI client
     */
    initialize() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey) {
            this.openai = new OpenAI({ apiKey });
            this.initialized = true;
        }
    }

    /**
     * Compare document and email content semantically
     * @param {string} documentText - Reference document text
     * @param {string} emailText - Email content text
     * @returns {Promise<Object>} Semantic comparison results
     */
    async compare(documentText, emailText) {
        // Try to initialize if not already
        if (!this.initialized) {
            this.initialize();
        }

        // If OpenAI is not available, use mock comparison
        if (!this.openai) {
            console.log('OpenAI not configured, using mock semantic comparison');
            return this.mockCompare(documentText, emailText);
        }

        try {
            const prompt = this.buildPrompt(documentText, emailText);

            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert email QA analyst. Compare the reference document with the email content and determine if they semantically match. Focus on:
1. HEADINGS: Do the main headings/titles convey the same message?
2. BODY COPY: Does the body content convey the same information? (rewording is allowed)
3. OFFER: If there's an offer/promotion, is the value/terms preserved exactly?

Respond in JSON format only.`
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.1,
                response_format: { type: "json_object" }
            });

            const result = JSON.parse(response.choices[0].message.content);
            return this.formatResult(result);
        } catch (error) {
            console.error('OpenAI API error:', error);
            throw new Error(`AI comparison failed: ${error.message}`);
        }
    }

    /**
     * Build comparison prompt
     */
    buildPrompt(documentText, emailText) {
        return `REFERENCE DOCUMENT:
"""
${documentText.substring(0, 4000)}
"""

EMAIL CONTENT:
"""
${emailText.substring(0, 4000)}
"""

Compare the email content against the reference document and respond with this exact JSON structure:
{
    "headings": {
        "status": "PASS" or "FAIL",
        "confidence": 0.0-1.0,
        "explanation": "brief explanation",
        "issues": ["list of issues if any"]
    },
    "body_copy": {
        "status": "PASS" or "FAIL",
        "confidence": 0.0-1.0,
        "explanation": "brief explanation",
        "issues": ["list of issues if any"]
    },
    "offer": {
        "status": "PASS" or "FAIL" or "N/A",
        "confidence": 0.0-1.0,
        "explanation": "brief explanation",
        "issues": ["list of issues if any"]
    },
    "overall_semantic_match": true or false,
    "summary": "overall summary of comparison"
}`;
    }

    /**
     * Format API result
     */
    formatResult(result) {
        return {
            headings: {
                status: result.headings?.status || 'PASS',
                confidence: result.headings?.confidence || 0.9,
                explanation: result.headings?.explanation || '',
                issues: result.headings?.issues || []
            },
            body_copy: {
                status: result.body_copy?.status || 'PASS',
                confidence: result.body_copy?.confidence || 0.9,
                explanation: result.body_copy?.explanation || '',
                issues: result.body_copy?.issues || []
            },
            offer: {
                status: result.offer?.status || 'N/A',
                confidence: result.offer?.confidence || 1.0,
                explanation: result.offer?.explanation || '',
                issues: result.offer?.issues || []
            },
            overall_match: result.overall_semantic_match !== false,
            summary: result.summary || 'Semantic comparison completed'
        };
    }

    /**
     * Mock comparison for when OpenAI is not available
     */
    mockCompare(documentText, emailText) {
        // Simple similarity check based on word overlap
        const docWords = new Set(documentText.toLowerCase().split(/\s+/).filter(w => w.length > 3));
        const emailWords = new Set(emailText.toLowerCase().split(/\s+/).filter(w => w.length > 3));

        let matchCount = 0;
        for (const word of docWords) {
            if (emailWords.has(word)) matchCount++;
        }

        const similarity = docWords.size > 0 ? matchCount / docWords.size : 0;
        const passes = similarity > 0.3;

        return {
            headings: {
                status: passes ? 'PASS' : 'FAIL',
                confidence: similarity,
                explanation: 'Mock comparison based on word overlap',
                issues: passes ? [] : ['Low word match - potential content mismatch']
            },
            body_copy: {
                status: passes ? 'PASS' : 'FAIL',
                confidence: similarity,
                explanation: 'Mock comparison based on word overlap',
                issues: passes ? [] : ['Low word match - potential content mismatch']
            },
            offer: {
                status: 'N/A',
                confidence: 1.0,
                explanation: 'Unable to detect offer content in mock mode',
                issues: []
            },
            overall_match: passes,
            summary: `Mock semantic comparison: ${Math.round(similarity * 100)}% word overlap. ${passes ? 'Content appears similar.' : 'Significant differences detected.'} For accurate results, configure OPENAI_API_KEY.`,
            mock_mode: true
        };
    }
}

module.exports = new SemanticComparator();
