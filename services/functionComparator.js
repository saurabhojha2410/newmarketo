/**
 * Function-Based Comparator Service
 * Implements deterministic rule-based comparison for strict QA checks
 */
class FunctionComparator {
    /**
     * Run all function-based comparisons
     * @param {string} documentText - Reference document text
     * @param {Object} emailContent - Parsed email content
     * @param {Object} config - Comparison configuration
     * @returns {Object} Comparison results
     */
    compare(documentText, emailContent, config) {
        const results = {};

        // CTA Text comparison
        results.cta_text = this.compareCTAText(
            documentText,
            emailContent.ctaButtons,
            config.ctaTexts
        );

        // CTA URL comparison
        results.cta_url = this.compareCTAUrls(
            emailContent.ctaButtons,
            config.ctaUrls
        );

        // Unsubscribe check
        results.unsubscribe = this.checkUnsubscribe(
            emailContent,
            config.unsubscribeText
        );

        // Footer/Legal compliance check
        results.footer = this.checkFooter(
            emailContent.footer,
            emailContent.text,
            config.footerTexts
        );

        // Required keywords check
        results.keywords = this.checkKeywords(
            emailContent.text,
            config.requiredKeywords
        );

        return results;
    }

    /**
     * Compare CTA text (exact match, case-insensitive)
     */
    compareCTAText(documentText, emailCTAs, expectedCTAs) {
        if (!expectedCTAs || expectedCTAs.length === 0) {
            // Auto-detect CTAs from document if not specified
            return {
                status: 'PASS',
                message: 'No specific CTAs configured for comparison',
                found: emailCTAs.map(c => c.text)
            };
        }

        const issues = [];
        const matched = [];
        const emailCTATexts = emailCTAs.map(c => c.text.toLowerCase().trim());

        for (const expectedCTA of expectedCTAs) {
            const normalizedExpected = expectedCTA.toLowerCase().trim();
            const found = emailCTATexts.some(t =>
                t === normalizedExpected ||
                t.includes(normalizedExpected) ||
                normalizedExpected.includes(t)
            );

            if (found) {
                matched.push(expectedCTA);
            } else {
                issues.push(`CTA "${expectedCTA}" not found in email`);
            }
        }

        return {
            status: issues.length === 0 ? 'PASS' : 'FAIL',
            expected: expectedCTAs,
            found: emailCTAs.map(c => c.text),
            matched,
            issues
        };
    }

    /**
     * Compare CTA URLs (ignore tracking params)
     */
    compareCTAUrls(emailCTAs, expectedUrls) {
        if (!expectedUrls || expectedUrls.length === 0) {
            return {
                status: 'PASS',
                message: 'No specific URLs configured for comparison',
                found: emailCTAs.map(c => c.cleanUrl)
            };
        }

        const issues = [];
        const matched = [];

        for (const expectedUrl of expectedUrls) {
            const cleanExpected = this.normalizeUrl(expectedUrl);
            const found = emailCTAs.some(c => {
                const cleanFound = this.normalizeUrl(c.cleanUrl);
                return cleanFound === cleanExpected ||
                    cleanFound.includes(cleanExpected) ||
                    cleanExpected.includes(cleanFound);
            });

            if (found) {
                matched.push(expectedUrl);
            } else {
                issues.push(`URL "${expectedUrl}" not found in email CTAs`);
            }
        }

        return {
            status: issues.length === 0 ? 'PASS' : 'FAIL',
            expected: expectedUrls,
            found: emailCTAs.map(c => c.cleanUrl),
            matched,
            issues
        };
    }

    /**
     * Check for unsubscribe link/text
     */
    checkUnsubscribe(emailContent, requiredText = 'unsubscribe') {
        const hasUnsubscribe = emailContent.hasUnsubscribe?.found;
        const textLower = emailContent.text.toLowerCase();
        const hasRequiredText = textLower.includes(requiredText.toLowerCase());

        if (!hasUnsubscribe && !hasRequiredText) {
            return {
                status: 'FAIL',
                message: 'No unsubscribe link or text found',
                required: requiredText,
                issues: ['Missing unsubscribe link/text - COMPLIANCE ISSUE']
            };
        }

        return {
            status: 'PASS',
            hasLink: emailContent.hasUnsubscribe?.hasLink || false,
            hasText: emailContent.hasUnsubscribe?.hasText || hasRequiredText
        };
    }

    /**
     * Check footer/legal compliance text
     */
    checkFooter(footerText, fullText, requiredTexts = []) {
        // Default compliance texts if none specified
        const defaultCompliance = [
            'all rights reserved',
            'privacy policy',
            'terms'
        ];

        const textsToCheck = requiredTexts.length > 0 ? requiredTexts : defaultCompliance;
        const searchText = (footerText + ' ' + fullText).toLowerCase();
        const issues = [];
        const found = [];

        for (const text of textsToCheck) {
            if (searchText.includes(text.toLowerCase())) {
                found.push(text);
            } else {
                issues.push(`Required footer text "${text}" not found`);
            }
        }

        // At least some compliance text should be present
        if (found.length === 0 && requiredTexts.length > 0) {
            return {
                status: 'FAIL',
                required: textsToCheck,
                found: [],
                issues
            };
        }

        return {
            status: issues.length === 0 ? 'PASS' : 'FAIL',
            required: textsToCheck,
            found,
            issues
        };
    }

    /**
     * Check for required keywords in email
     */
    checkKeywords(emailText, requiredKeywords = []) {
        if (!requiredKeywords || requiredKeywords.length === 0) {
            return {
                status: 'PASS',
                message: 'No specific keywords configured for comparison'
            };
        }

        const textLower = emailText.toLowerCase();
        const missing = [];
        const found = [];

        for (const keyword of requiredKeywords) {
            if (textLower.includes(keyword.toLowerCase())) {
                found.push(keyword);
            } else {
                missing.push(keyword);
            }
        }

        return {
            status: missing.length === 0 ? 'PASS' : 'FAIL',
            required: requiredKeywords,
            found,
            missing,
            issues: missing.map(k => `Required keyword "${k}" not found in email`)
        };
    }

    /**
     * Normalize URL for comparison
     */
    normalizeUrl(url) {
        try {
            const urlObj = new URL(url);
            // Remove trailing slash, lowercase host
            return urlObj.origin.toLowerCase() + urlObj.pathname.replace(/\/$/, '');
        } catch {
            return url.toLowerCase().replace(/\/$/, '');
        }
    }
}

module.exports = new FunctionComparator();
