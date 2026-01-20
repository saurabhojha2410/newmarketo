const fetch = require('node-fetch');
const cheerio = require('cheerio');

/**
 * Email Fetcher Service
 * Fetches "View in Browser" email URLs and extracts content
 */
class EmailFetcher {
    // Common tracking parameter patterns to ignore
    trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'elqTrack', 'elqTrackId', 'mkt_tok', 'mc_cid', 'mc_eid',
        'sfmc_id', 'subscriber_id', 'contact_id', 'lead_id',
        '_hsenc', '_hsmi', 'hsa_', 'fbclid', 'gclid', 'msclkid',
        'trk', 'track', 'tracking', 'ref', 'source'
    ];

    // Personalization token patterns
    personalizationPatterns = [
        /\{\{[^}]+\}\}/g,           // {{firstname}}
        /\[\[[^\]]+\]\]/g,          // [[firstname]]
        /%[A-Z_]+%/g,               // %FIRSTNAME%
        /\$\{[^}]+\}/g,             // ${firstname}
        /<\/?[a-z]+:[^>]+>/gi,      // Custom Marketo/SFMC tags
    ];

    /**
     * Fetch email content from URL
     * @param {string} url - The "View in Browser" URL
     * @returns {Promise<Object>} Extracted email content
     */
    async fetch(url) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml'
                },
                timeout: 30000
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch email: HTTP ${response.status}`);
            }

            const html = await response.text();
            return this.parseEmail(html);
        } catch (error) {
            throw new Error(`Failed to fetch email from URL: ${error.message}`);
        }
    }

    /**
     * Parse email HTML and extract structured content
     */
    parseEmail(html) {
        const $ = cheerio.load(html);

        // Remove script and style tags
        $('script, style, head, meta, link').remove();

        // Extract CTA buttons (links with button-like styling or specific classes)
        const ctaButtons = this.extractCTAs($);

        // Extract all links
        const links = this.extractLinks($);

        // Extract clean text
        const text = this.extractText($);

        // Check for unsubscribe
        const hasUnsubscribe = this.findUnsubscribe($);

        // Extract footer content
        const footer = this.extractFooter($);

        return {
            text,
            html,
            ctaButtons,
            links,
            hasUnsubscribe,
            footer
        };
    }

    /**
     * Extract CTA buttons from email
     */
    extractCTAs($) {
        const ctas = [];
        const ctaSelectors = [
            'a.button', 'a.btn', 'a.cta',
            'a[class*="button"]', 'a[class*="btn"]', 'a[class*="cta"]',
            'a[style*="background"]',
            '.button a', '.btn a', '.cta a'
        ];

        $(ctaSelectors.join(', ')).each((i, el) => {
            const $el = $(el);
            const text = $el.text().trim();
            const href = $el.attr('href') || '';

            if (text && href) {
                ctas.push({
                    text,
                    url: href,
                    cleanUrl: this.stripTrackingParams(href)
                });
            }
        });

        // Also look for prominent links (uppercase, action words)
        $('a').each((i, el) => {
            const $el = $(el);
            const text = $el.text().trim();
            const href = $el.attr('href') || '';

            // Check if it looks like a CTA
            const ctaKeywords = /^(shop|buy|get|learn|discover|start|try|sign|register|subscribe|download|view|see|explore|claim|grab|save)/i;
            if (text && href && ctaKeywords.test(text) && !ctas.find(c => c.text === text)) {
                ctas.push({
                    text,
                    url: href,
                    cleanUrl: this.stripTrackingParams(href)
                });
            }
        });

        return ctas;
    }

    /**
     * Extract all links from email
     */
    extractLinks($) {
        const links = [];

        $('a[href]').each((i, el) => {
            const $el = $(el);
            const text = $el.text().trim();
            const href = $el.attr('href') || '';

            if (href && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
                links.push({
                    text: text || '[no text]',
                    url: href,
                    cleanUrl: this.stripTrackingParams(href)
                });
            }
        });

        return links;
    }

    /**
     * Extract clean text from email
     */
    extractText($) {
        // Get body text
        let text = $('body').text() || $.root().text();

        // Remove personalization tokens
        this.personalizationPatterns.forEach(pattern => {
            text = text.replace(pattern, '');
        });

        // Normalize whitespace
        text = text
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n/g, '\n\n')
            .trim();

        return text;
    }

    /**
     * Find unsubscribe link/text
     */
    findUnsubscribe($) {
        const unsubText = $('body').text().toLowerCase();
        const hasUnsubText = unsubText.includes('unsubscribe') ||
            unsubText.includes('opt out') ||
            unsubText.includes('opt-out');

        const unsubLink = $('a[href*="unsubscribe"], a[href*="optout"], a[href*="opt-out"]').length > 0;

        return {
            hasText: hasUnsubText,
            hasLink: unsubLink,
            found: hasUnsubText || unsubLink
        };
    }

    /**
     * Extract footer content
     */
    extractFooter($) {
        // Try to find footer element
        let footerText = '';

        const footerSelectors = ['footer', '.footer', '[class*="footer"]', '#footer'];
        for (const selector of footerSelectors) {
            const footer = $(selector).first();
            if (footer.length) {
                footerText = footer.text().trim();
                break;
            }
        }

        // If no footer found, get last portion of email
        if (!footerText) {
            const allText = $('body').text();
            const lines = allText.split('\n').filter(l => l.trim());
            footerText = lines.slice(-5).join('\n');
        }

        return footerText;
    }

    /**
     * Strip tracking parameters from URL
     */
    stripTrackingParams(url) {
        try {
            const urlObj = new URL(url);

            // Remove known tracking params
            this.trackingParams.forEach(param => {
                urlObj.searchParams.delete(param);
                // Also handle params that start with these
                for (const [key] of urlObj.searchParams) {
                    if (key.toLowerCase().startsWith(param.toLowerCase())) {
                        urlObj.searchParams.delete(key);
                    }
                }
            });

            return urlObj.toString();
        } catch {
            return url;
        }
    }
}

module.exports = new EmailFetcher();
