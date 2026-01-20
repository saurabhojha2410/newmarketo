/**
 * Report Generator Service
 * Generates structured QA reports
 */
class ReportGenerator {
    /**
     * Generate final QA report
     * @param {Object} functionResults - Results from function-based comparison
     * @param {Object} semanticResults - Results from AI semantic comparison
     * @param {boolean} functionPassed - Whether function checks passed
     * @param {boolean} aiSkipped - Whether AI comparison was skipped
     * @returns {Object} Complete QA report
     */
    generate(functionResults, semanticResults, functionPassed, aiSkipped) {
        // Collect all issues
        const issues = this.collectIssues(functionResults, semanticResults);

        // Determine overall status
        const overallStatus = this.determineOverallStatus(
            functionResults,
            semanticResults,
            functionPassed
        );

        // Generate human-readable summary
        const summary = this.generateSummary(
            functionResults,
            semanticResults,
            overallStatus,
            aiSkipped
        );

        return {
            overall_status: overallStatus,
            timestamp: new Date().toISOString(),
            exact_match_results: this.formatFunctionResults(functionResults),
            semantic_match_results: this.formatSemanticResults(semanticResults),
            issues,
            summary,
            metadata: {
                function_checks_passed: functionPassed,
                ai_comparison_run: !aiSkipped,
                ai_mock_mode: semanticResults?.mock_mode || false
            }
        };
    }

    /**
     * Collect all issues from both comparison types
     */
    collectIssues(functionResults, semanticResults) {
        const issues = [];

        // Function-based issues
        for (const [key, result] of Object.entries(functionResults)) {
            if (result.issues && result.issues.length > 0) {
                issues.push(...result.issues.map(i => ({
                    type: 'function',
                    category: key,
                    message: i,
                    severity: 'critical'
                })));
            }
        }

        // Semantic issues
        if (semanticResults) {
            for (const [key, result] of Object.entries(semanticResults)) {
                if (result?.issues && result.issues.length > 0) {
                    issues.push(...result.issues.map(i => ({
                        type: 'semantic',
                        category: key,
                        message: i,
                        severity: 'warning'
                    })));
                }
            }
        }

        return issues;
    }

    /**
     * Determine overall pass/fail status
     */
    determineOverallStatus(functionResults, semanticResults, functionPassed) {
        // If function checks failed, it's a hard fail
        if (!functionPassed) {
            return 'FAIL';
        }

        // Check semantic results
        if (semanticResults && !semanticResults.overall_match) {
            return 'FAIL';
        }

        // Check individual semantic results
        if (semanticResults) {
            for (const [key, result] of Object.entries(semanticResults)) {
                if (result?.status === 'FAIL') {
                    return 'FAIL';
                }
            }
        }

        return 'PASS';
    }

    /**
     * Format function results for output
     */
    formatFunctionResults(results) {
        const formatted = {};

        for (const [key, result] of Object.entries(results)) {
            formatted[key] = {
                status: result.status,
                ...(result.expected && { expected: result.expected }),
                ...(result.found && { found: result.found }),
                ...(result.matched && { matched: result.matched }),
                ...(result.missing && { missing: result.missing }),
                ...(result.message && { message: result.message }),
                ...(result.issues && result.issues.length > 0 && { issues: result.issues })
            };
        }

        return formatted;
    }

    /**
     * Format semantic results for output
     */
    formatSemanticResults(results) {
        if (!results) {
            return null;
        }

        return {
            headings: results.headings ? {
                status: results.headings.status,
                confidence: results.headings.confidence,
                explanation: results.headings.explanation
            } : null,
            body_copy: results.body_copy ? {
                status: results.body_copy.status,
                confidence: results.body_copy.confidence,
                explanation: results.body_copy.explanation
            } : null,
            offer: results.offer ? {
                status: results.offer.status,
                confidence: results.offer.confidence,
                explanation: results.offer.explanation
            } : null,
            overall_match: results.overall_match,
            ai_summary: results.summary
        };
    }

    /**
     * Generate human-readable summary
     */
    generateSummary(functionResults, semanticResults, overallStatus, aiSkipped) {
        const parts = [];

        if (overallStatus === 'PASS') {
            parts.push('✅ Email passed all QA checks.');
        } else {
            parts.push('❌ Email failed QA checks.');
        }

        // Summarize function results
        const funcFailed = Object.entries(functionResults)
            .filter(([_, r]) => r.status === 'FAIL')
            .map(([k, _]) => k.replace('_', ' '));

        if (funcFailed.length > 0) {
            parts.push(`Function checks failed: ${funcFailed.join(', ')}.`);
        } else {
            parts.push('All function-based checks passed.');
        }

        // Summarize semantic results
        if (aiSkipped) {
            parts.push('AI semantic comparison was skipped.');
        } else if (semanticResults) {
            if (semanticResults.mock_mode) {
                parts.push('Note: AI comparison ran in mock mode (configure OPENAI_API_KEY for full analysis).');
            }

            if (semanticResults.overall_match) {
                parts.push('Semantic analysis confirms content matches reference document.');
            } else {
                parts.push('Semantic analysis detected potential content mismatches.');
            }
        }

        return parts.join(' ');
    }
}

module.exports = new ReportGenerator();
