// Email QA System - Frontend Application (STATELESS VERSION)
// Document text is stored in browser, not on server
const API_BASE = '';

// State - stored in browser
let documentText = null;
let documentFilename = null;
let emailFetched = false;

// DOM Elements
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const uploadedFile = document.getElementById('uploaded-file');
const fileName = document.getElementById('file-name');
const fileChars = document.getElementById('file-chars');
const removeFileBtn = document.getElementById('remove-file');
const uploadStatus = document.getElementById('upload-status');

const emailUrl = document.getElementById('email-url');
const fetchBtn = document.getElementById('fetch-btn');
const emailPreview = document.getElementById('email-preview');
const emailChars = document.getElementById('email-chars');
const previewContent = document.getElementById('preview-content');
const urlStatus = document.getElementById('url-status');

const configToggle = document.getElementById('config-toggle');
const configContent = document.getElementById('config-content');
const stepConfig = document.getElementById('step-config');

const compareBtn = document.getElementById('compare-btn');
const btnText = compareBtn.querySelector('.btn-text');
const btnLoading = compareBtn.querySelector('.btn-loading');

const resultsSection = document.getElementById('results-section');
const statusBadge = document.getElementById('status-badge');
const badgeIcon = document.getElementById('badge-icon');
const badgeText = document.getElementById('badge-text');
const statusSummary = document.getElementById('status-summary');
const functionResults = document.getElementById('function-results');
const semanticResults = document.getElementById('semantic-results');
const functionBadge = document.getElementById('function-badge');
const semanticBadge = document.getElementById('semantic-badge');
const issuesCard = document.getElementById('issues-card');
const issuesList = document.getElementById('issues-list');
const jsonOutput = document.getElementById('json-output');
const newCompareBtn = document.getElementById('new-compare-btn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    setupEventListeners();
});

function setupEventListeners() {
    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', handleDragOver);
    uploadZone.addEventListener('dragleave', handleDragLeave);
    uploadZone.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileSelect);
    removeFileBtn.addEventListener('click', removeFile);

    fetchBtn.addEventListener('click', fetchEmail);
    emailUrl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchEmail();
    });

    configToggle.addEventListener('click', toggleConfig);
    compareBtn.addEventListener('click', runComparison);
    newCompareBtn.addEventListener('click', resetComparison);
}

// Load saved data from localStorage (persists across server restarts)
function loadFromLocalStorage() {
    const saved = localStorage.getItem('emailqa_document');
    if (saved) {
        const data = JSON.parse(saved);
        documentText = data.text;
        documentFilename = data.filename;
        showUploadedFile(data.filename, data.text.length);
    }
}

function saveToLocalStorage() {
    if (documentText) {
        localStorage.setItem('emailqa_document', JSON.stringify({
            text: documentText,
            filename: documentFilename
        }));
    }
}

function handleDragOver(e) {
    e.preventDefault();
    uploadZone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length) uploadFile(files[0]);
}

function handleFileSelect(e) {
    if (e.target.files.length) uploadFile(e.target.files[0]);
}

async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        uploadStatus.textContent = 'Processing...';
        uploadStatus.className = 'step-status';

        const res = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            body: formData
        });

        const data = await res.json();
        if (data.success) {
            // Store the full text returned from server
            const textRes = await fetch(`${API_BASE}/api/upload`, {
                method: 'POST',
                body: formData
            });
            const textData = await textRes.json();

            // Actually we need to get full text, let's use the preview for now
            // and request full text from a new endpoint
            documentFilename = data.filename;

            // For stateless: we need server to return full text
            // Let's fetch it properly
            await fetchFullDocumentText(file);
        } else {
            throw new Error(data.error);
        }
    } catch (e) {
        uploadStatus.textContent = 'Error';
        uploadStatus.className = 'step-status error';
        alert('Upload failed: ' + e.message);
    }
}

// Read file directly in browser for stateless operation
async function fetchFullDocumentText(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            body: formData
        });

        const data = await res.json();
        if (data.success) {
            // Request the full extracted text
            const fullRes = await fetch(`${API_BASE}/api/document/text`);
            const fullData = await fullRes.json();

            if (fullData.text) {
                documentText = fullData.text;
                documentFilename = data.filename;
                saveToLocalStorage();
                showUploadedFile(data.filename, documentText.length);
            }
        }
    } catch (e) {
        console.error('Error getting full text:', e);
        uploadStatus.textContent = 'Error';
        uploadStatus.className = 'step-status error';
    }
}

function showUploadedFile(name, chars) {
    fileName.textContent = name;
    fileChars.textContent = `${chars.toLocaleString()} characters extracted`;
    uploadZone.hidden = true;
    uploadedFile.hidden = false;
    uploadStatus.textContent = 'Ready';
    uploadStatus.className = 'step-status ready';
    updateCompareButton();
}

function removeFile() {
    localStorage.removeItem('emailqa_document');
    documentText = null;
    documentFilename = null;
    uploadZone.hidden = false;
    uploadedFile.hidden = true;
    uploadStatus.textContent = '';
    uploadStatus.className = 'step-status';
    updateCompareButton();
}

async function fetchEmail() {
    const url = emailUrl.value.trim();
    if (!url) {
        alert('Please enter an email URL');
        return;
    }

    try {
        fetchBtn.disabled = true;
        urlStatus.textContent = 'Fetching...';
        urlStatus.className = 'step-status';

        const res = await fetch(`${API_BASE}/api/fetch-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const data = await res.json();
        if (data.success) {
            emailChars.textContent = `${data.textLength.toLocaleString()} characters`;
            previewContent.textContent = data.preview;
            emailPreview.hidden = false;
            urlStatus.textContent = 'Ready';
            urlStatus.className = 'step-status ready';
            emailFetched = true;
            updateCompareButton();
        } else {
            throw new Error(data.error);
        }
    } catch (e) {
        urlStatus.textContent = 'Error';
        urlStatus.className = 'step-status error';
        alert('Fetch failed: ' + e.message);
    } finally {
        fetchBtn.disabled = false;
    }
}

function toggleConfig() {
    stepConfig.classList.toggle('expanded');
    configContent.hidden = !stepConfig.classList.contains('expanded');
}

function updateCompareButton() {
    compareBtn.disabled = !(documentText && emailFetched);
}

function getConfig() {
    const parse = (id) => document.getElementById(id).value.trim().split('\n').filter(Boolean);
    return {
        ctaTexts: parse('cta-texts'),
        ctaUrls: parse('cta-urls'),
        requiredKeywords: parse('keywords'),
        footerTexts: parse('footer-texts')
    };
}

async function runComparison() {
    const url = emailUrl.value.trim();
    const config = getConfig();

    try {
        btnText.hidden = true;
        btnLoading.hidden = false;
        compareBtn.disabled = true;

        // STATELESS: Send document text with request
        const res = await fetch(`${API_BASE}/api/compare`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url,
                config,
                documentText: documentText  // Send stored document text
            })
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);
        displayResults(data);
    } catch (e) {
        alert('Comparison failed: ' + e.message);
    } finally {
        btnText.hidden = false;
        btnLoading.hidden = true;
        compareBtn.disabled = false;
    }
}

function displayResults(data) {
    resultsSection.hidden = false;
    resultsSection.scrollIntoView({ behavior: 'smooth' });

    const isPassing = data.overall_status === 'PASS';
    statusBadge.className = `status-badge ${isPassing ? 'pass' : 'fail'}`;
    badgeIcon.textContent = isPassing ? '✓' : '✗';
    badgeText.textContent = data.overall_status;
    statusSummary.textContent = data.summary;

    renderFunctionResults(data.exact_match_results);
    renderSemanticResults(data.semantic_match_results);
    renderIssues(data.issues);

    jsonOutput.textContent = JSON.stringify(data, null, 2);
}

function renderFunctionResults(results) {
    functionResults.innerHTML = '';
    let passCount = 0, total = 0;

    for (const [key, result] of Object.entries(results)) {
        total++;
        if (result.status === 'PASS') passCount++;
        const item = createResultItem(key.replace(/_/g, ' '), result);
        functionResults.appendChild(item);
    }

    functionBadge.textContent = `${passCount}/${total}`;
    functionBadge.className = `card-badge ${passCount === total ? 'pass' : 'fail'}`;
}

function renderSemanticResults(results) {
    semanticResults.innerHTML = '';
    if (!results) {
        semanticBadge.textContent = 'SKIPPED';
        semanticBadge.className = 'card-badge skipped';
        const p = document.createElement('p');
        p.style.color = 'var(--text-muted)';
        p.textContent = 'AI semantic comparison was not run.';
        semanticResults.appendChild(p);
        return;
    }

    let passCount = 0, total = 0;
    const keys = ['headings', 'body_copy', 'offer'];

    for (const key of keys) {
        const result = results[key];
        if (!result) continue;
        total++;
        if (result.status === 'PASS') passCount++;
        const item = createSemanticItem(key.replace(/_/g, ' '), result);
        semanticResults.appendChild(item);
    }

    if (results.overall_match !== undefined) {
        semanticBadge.textContent = results.overall_match ? 'PASS' : 'FAIL';
        semanticBadge.className = `card-badge ${results.overall_match ? 'pass' : 'fail'}`;
    }
}

function createResultItem(label, result) {
    const div = document.createElement('div');
    div.className = 'result-item';

    const statusClass = result.status === 'PASS' ? 'pass' : result.status === 'SKIPPED' ? 'skipped' : 'fail';
    const icon = result.status === 'PASS' ? '✓' : result.status === 'SKIPPED' ? '—' : '✗';

    div.innerHTML = `
        <div class="result-icon ${statusClass}">${icon}</div>
        <div class="result-content">
            <div class="result-label">${label}</div>
            ${result.message ? `<div class="result-detail">${result.message}</div>` : ''}
            ${result.issues?.length ? `<div class="result-detail" style="color:var(--error)">${result.issues[0]}</div>` : ''}
        </div>
    `;
    return div;
}

function createSemanticItem(label, result) {
    const div = document.createElement('div');
    div.className = 'result-item';

    const statusClass = result.status === 'PASS' ? 'pass' : result.status === 'N/A' || result.status === 'SKIPPED' ? 'skipped' : 'fail';
    const icon = result.status === 'PASS' ? '✓' : result.status === 'N/A' || result.status === 'SKIPPED' ? '—' : '✗';

    div.innerHTML = `
        <div class="result-icon ${statusClass}">${icon}</div>
        <div class="result-content">
            <div class="result-label">${label}</div>
            ${result.explanation ? `<div class="result-detail">${result.explanation}</div>` : ''}
            ${result.confidence !== undefined ? `<div class="result-confidence">Confidence: ${Math.round(result.confidence * 100)}%</div>` : ''}
        </div>
    `;
    return div;
}

function renderIssues(issues) {
    if (!issues || issues.length === 0) {
        issuesCard.hidden = true;
        return;
    }

    issuesCard.hidden = false;
    issuesList.innerHTML = '';

    for (const issue of issues) {
        const li = document.createElement('li');
        li.className = 'issue-item';
        li.innerHTML = `
            <span class="issue-type">${issue.type}</span>
            <span class="issue-message">${issue.message}</span>
        `;
        issuesList.appendChild(li);
    }
}

function resetComparison() {
    resultsSection.hidden = true;
    emailPreview.hidden = true;
    emailUrl.value = '';
    urlStatus.textContent = '';
    urlStatus.className = 'step-status';
    emailFetched = false;
    updateCompareButton();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
