/* ============================================
   SM Corporation Chalan Generator - JavaScript
   ============================================ */

// DOM Elements
const inputSection = document.getElementById('input-section');
const savedSection = document.getElementById('saved-section');
const previewSection = document.getElementById('preview-section');
const chalanForm = document.getElementById('chalan-form');
const itemsTableBody = document.getElementById('itemsTableBody');
const chalanPreview = document.getElementById('chalan-preview');
const savedChalansList = document.getElementById('savedChalansList');
const chalanNoInput = document.getElementById('chalanNo');

// Buttons
const addItemBtn = document.getElementById('addItemBtn');
const generateBtn = document.getElementById('generateBtn');
const viewSavedBtn = document.getElementById('viewSavedBtn');
const backToFormBtn = document.getElementById('backToFormBtn');
const printBtn = document.getElementById('printBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const newChalanBtn = document.getElementById('newChalanBtn');

// Storage key
const STORAGE_KEY = 'sm_corporation_chalans';
const CHALAN_COUNTER_KEY = 'sm_corporation_chalan_counter';
const BILL_COUNTER_KEY = 'sm_corporation_bill_counter';
const QUOTATION_COUNTER_KEY = 'sm_corporation_quotation_counter';

// Current chalan data
let currentChalanData = null;

// Current mode (chalan or bill)
let currentMode = 'chalan';

const docNumberState = {
    chalan: { auto: '', value: '', manual: false },
    bill: { auto: '', value: '', manual: false },
    quotation: { auto: '', value: '', manual: false }
};

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeChalanNumber();
    setTodayDate();
    attachEventListeners();
    setupModeToggle();
    attachItemCalculation();
    attachDocNumberListener();
    attachBillVatToggle();
    attachBillAitToggle();
    setupPreviewScaling();
});

function initializeChalanNumber() {
    let counter = localStorage.getItem(CHALAN_COUNTER_KEY);
    if (!counter) {
        counter = 1;
        localStorage.setItem(CHALAN_COUNTER_KEY, counter);
    }
    
    // Initialize bill counter if not exists
    let billCounter = localStorage.getItem(BILL_COUNTER_KEY);
    if (!billCounter) {
        billCounter = 1;
        localStorage.setItem(BILL_COUNTER_KEY, billCounter);
    }

    let quotationCounter = localStorage.getItem(QUOTATION_COUNTER_KEY);
    if (!quotationCounter) {
        quotationCounter = 1;
        localStorage.setItem(QUOTATION_COUNTER_KEY, quotationCounter);
    }

    applyDocumentNumberForMode('chalan');
}

function formatChalanNumber(num) {
    return String(num).padStart(4, '0');
}

function getAutoNumberForMode(mode) {
    const counter = mode === 'bill'
        ? localStorage.getItem(BILL_COUNTER_KEY) || '1'
        : mode === 'quotation'
            ? localStorage.getItem(QUOTATION_COUNTER_KEY) || '1'
            : localStorage.getItem(CHALAN_COUNTER_KEY) || '1';
    return formatChalanNumber(counter);
}

function persistCurrentDocNumber() {
    const state = docNumberState[currentMode];
    const value = chalanNoInput.value.trim();
    state.value = value;
    state.manual = value !== '' && value !== state.auto;
}

function syncManualNumberToCounter() {
    const state = docNumberState[currentMode];
    const value = chalanNoInput.value.trim();

    if (!value) {
        state.manual = false;
        state.value = '';
        applyDocumentNumberForMode(currentMode);
        return;
    }

    if (!state.manual) {
        return;
    }

    if (!/^\d+$/.test(value)) {
        return;
    }

    const manualNumber = parseInt(value, 10);
    const nextNumber = manualNumber + 1;

    if (currentMode === 'bill') {
        localStorage.setItem(BILL_COUNTER_KEY, String(nextNumber));
        updateAutoNumberForMode('bill', formatChalanNumber(nextNumber));
    } else if (currentMode === 'quotation') {
        localStorage.setItem(QUOTATION_COUNTER_KEY, String(nextNumber));
        updateAutoNumberForMode('quotation', formatChalanNumber(nextNumber));
    } else {
        localStorage.setItem(CHALAN_COUNTER_KEY, String(nextNumber));
        updateAutoNumberForMode('chalan', formatChalanNumber(nextNumber));
    }
}

function applyDocumentNumberForMode(mode) {
    const state = docNumberState[mode];
    const autoValue = getAutoNumberForMode(mode);
    state.auto = autoValue;
    chalanNoInput.dataset.auto = autoValue;

    const manualValue = (state.value || '').trim();
    if (state.manual && manualValue) {
        chalanNoInput.value = manualValue;
    } else {
        chalanNoInput.value = autoValue;
        state.value = autoValue;
        state.manual = false;
    }
}

function updateAutoNumberForMode(mode, autoValue) {
    const state = docNumberState[mode];
    state.auto = autoValue;

    if (currentMode !== mode) {
        return;
    }

    chalanNoInput.dataset.auto = autoValue;
    if (!state.manual) {
        chalanNoInput.value = autoValue;
        state.value = autoValue;
    }
}

function incrementChalanNumber() {
    let counter = parseInt(localStorage.getItem(CHALAN_COUNTER_KEY) || '1');
    counter++;
    localStorage.setItem(CHALAN_COUNTER_KEY, counter);
    return counter;
}

function incrementBillNumber() {
    let counter = parseInt(localStorage.getItem(BILL_COUNTER_KEY) || '1');
    counter++;
    localStorage.setItem(BILL_COUNTER_KEY, counter);
    return counter;
}

function incrementQuotationNumber() {
    let counter = parseInt(localStorage.getItem(QUOTATION_COUNTER_KEY) || '1');
    counter++;
    localStorage.setItem(QUOTATION_COUNTER_KEY, counter);
    return counter;
}

function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
}

function attachEventListeners() {
    addItemBtn.addEventListener('click', addItemRow);
    generateBtn.addEventListener('click', generateChalan);
    viewSavedBtn.addEventListener('click', showSavedChalans);
    backToFormBtn.addEventListener('click', showInputForm);
    printBtn.addEventListener('click', printChalan);
    downloadPdfBtn.addEventListener('click', downloadPdf);
    newChalanBtn.addEventListener('click', startNewChalan);
}

function attachDocNumberListener() {
    chalanNoInput.addEventListener('input', () => {
        persistCurrentDocNumber();
    });
    chalanNoInput.addEventListener('blur', () => {
        syncManualNumberToCounter();
    });
    chalanNoInput.addEventListener('change', () => {
        syncManualNumberToCounter();
    });
}

function attachBillVatToggle() {
    const vatModeSelect = document.getElementById('billVatMode');
    const vatAmountGroup = document.getElementById('billVatAmountGroup');
    const vatAmountInput = document.getElementById('billVatAmount');

    if (!vatModeSelect || !vatAmountGroup || !vatAmountInput) {
        return;
    }

    const applyVatVisibility = () => {
        const includeVat = vatModeSelect.value === 'include';
        vatAmountGroup.style.display = includeVat ? '' : 'none';
        if (!includeVat) {
            vatAmountInput.value = '';
        }
    };

    vatModeSelect.addEventListener('change', applyVatVisibility);
    applyVatVisibility();
}

function attachBillAitToggle() {
    const aitModeSelect = document.getElementById('billAitMode');
    const aitAmountGroup = document.getElementById('billAitAmountGroup');
    const aitAmountInput = document.getElementById('billAitAmount');

    if (!aitModeSelect || !aitAmountGroup || !aitAmountInput) {
        return;
    }

    const applyAitVisibility = () => {
        const includeAit = aitModeSelect.value === 'include';
        aitAmountGroup.style.display = includeAit ? '' : 'none';
        if (!includeAit) {
            // Clear any stale amount so it can never leak into calculations.
            aitAmountInput.value = '';
        }
    };

    aitModeSelect.addEventListener('change', applyAitVisibility);
    applyAitVisibility();
}

// Normalize a money input to a non-negative number. blank/invalid -> 0,
// negatives are clamped (matches the min="0" on the charge inputs).
function normalizeMoney(value) {
    const n = parseFloat(value);
    if (Number.isNaN(n)) return 0;
    return n > 0 ? n : 0;
}

// Paginate document items into page groups.
//   normalCapacity - max item rows on a non-final page (no totals/footer)
//   finalCapacity  - max item rows on the final page (totals/footer present)
//
// Strategy (minimum pages + front-filled rows):
//   1. Compute the minimum number of pages P such that the final page holds at
//      most finalCapacity rows and every earlier page at most normalCapacity:
//        total <= normalCapacity * (P - 1) + finalCapacity
//   2. Allocate rows from the FRONT. Each non-final page takes the maximum
//      number of real items it can hold while still leaving at least one item
//      for every remaining page (so the final page always gets >= 1 real item
//      and never exceeds finalCapacity).
//
// Real items are therefore front-loaded: an earlier page never shows a blank
// slot while a real item that could legally occupy it still exists on a later
// page. Blank rows are only presentation fillers added after allocation.
// Examples (no AIT): 13 items -> [12, 1], 20 -> [12, 7, 1], 29 -> [12, 12, 5].
function paginateItems(items, normalCapacity, finalCapacity) {
    const total = items.length;
    if (total === 0) {
        return [{ items: [], isLastPage: true }];
    }
    if (total <= finalCapacity) {
        return [{ items: items.slice(), isLastPage: true }];
    }

    const P = Math.ceil((total - finalCapacity) / normalCapacity) + 1;
    const pages = [];
    let start = 0;
    for (let p = 0; p < P - 1; p++) {
        const remainingItems = total - start;
        const pagesAfterCurrent = P - p - 1;
        // Take as many real items as this page can hold, while leaving at least
        // one real item for every remaining page (including the final page).
        const take = Math.max(1, Math.min(normalCapacity, remainingItems - pagesAfterCurrent));
        pages.push({ items: items.slice(start, start + take), isLastPage: false });
        start += take;
    }

    pages.push({ items: items.slice(start), isLastPage: true });
    return pages;
}

// Chalan uses the same front-filled pagination strategy as the Bill, but with
// its own measured page capacities (12 items on a normal page, 8 on the final
// page which also carries the quantity-total row, Quantity-in-Word row and
// signatory footer). The distribution itself is identical to paginateItems().
function paginateChalanItems(items, normalCapacity, finalCapacity) {
    return paginateItems(items, normalCapacity, finalCapacity);
}

// Render `count` empty presentation-only item rows.
//
// These fill a page's item-grid to its fixed capacity so a Bill/Chalan stays a
// full-height A4 form even with a single item. They are purely visual:
//   - no real item data (so they never affect subtotal/total/Taka-in-word)
//   - empty serial cells (so item numbering is untouched)
//   - they never persist into the saved dataset and never add pages
//
// isBillMode controls the column set: Bill uses Sl/Desc/Qty/Rate/Amount,
// Chalan uses Sl. No/Description/Origin/Packaging/Quantity.
function renderBlankItemRows(count, isBillMode) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += isBillMode ? `
            <tr>
                <td class="col-sl"></td>
                <td class="col-desc"></td>
                <td class="col-quantity"></td>
                <td class="col-rate"></td>
                <td class="col-amount"></td>
            </tr>
        ` : `
            <tr>
                <td class="col-sl"></td>
                <td class="col-desc"></td>
                <td class="col-origin"></td>
                <td class="col-packaging"></td>
                <td class="col-quantity"></td>
            </tr>
        `;
    }
    return html;
}

// ============================================
// Mode Toggle (Chalan / Bill)
// ============================================

function setupModeToggle() {
    const modeButtons = document.querySelectorAll('.mode-btn');
    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-mode');
            switchMode(mode);
            
            // Update active state
            modeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

function switchMode(mode) {
    persistCurrentDocNumber();
    currentMode = mode;
    
    // Update form title
    const formTitle = document.getElementById('form-title');
    const docNoLabel = document.getElementById('docNoLabel');
    const generateBtnText = document.getElementById('generateBtnText');
    const printBtnText = document.getElementById('printBtnText');
    const newDocBtnText = document.getElementById('newDocBtnText');
    const savedSectionTitle = document.getElementById('savedSectionTitle');
    const viewSavedBtnText = document.getElementById('viewSavedBtnText');
    
    if (mode === 'bill') {
        formTitle.textContent = 'Bill Generator';
        docNoLabel.textContent = 'Bill No';
        generateBtnText.textContent = 'Generate Bill';
        printBtnText.textContent = 'Print Bill';
        newDocBtnText.textContent = 'New Bill';
        savedSectionTitle.textContent = 'Saved Bills';
        viewSavedBtnText.textContent = 'View Saved Bills';

        applyModeVisibility();
        applyDocumentNumberForMode(mode);
    } else if (mode === 'quotation') {
        formTitle.textContent = 'Quotation Generator';
        docNoLabel.textContent = 'Quotation No';
        generateBtnText.textContent = 'Generate Quotation';
        printBtnText.textContent = 'Print Quotation';
        newDocBtnText.textContent = 'New Quotation';
        savedSectionTitle.textContent = 'Saved Quotations';
        viewSavedBtnText.textContent = 'View Saved Quotations';

        applyModeVisibility();
        applyDocumentNumberForMode(mode);
    } else {
        formTitle.textContent = 'Chalan Generator';
        docNoLabel.textContent = 'Chalan No';
        generateBtnText.textContent = 'Generate Chalan';
        printBtnText.textContent = 'Print Chalan';
        newDocBtnText.textContent = 'New Chalan';
        savedSectionTitle.textContent = 'Saved Chalans';
        viewSavedBtnText.textContent = 'View Saved Chalans';

        applyModeVisibility();
        applyDocumentNumberForMode(mode);
    }
}

function applyModeVisibility() {
    const showChalan = currentMode === 'chalan';
    const showBill = currentMode === 'bill';
    const showQuotation = currentMode === 'quotation';

    document.querySelectorAll('.chalan-only').forEach(el => el.style.display = showChalan ? '' : 'none');
    document.querySelectorAll('.bill-only').forEach(el => el.style.display = showBill ? '' : 'none');
    document.querySelectorAll('.quote-only').forEach(el => el.style.display = showQuotation ? '' : 'none');
    document.querySelectorAll('.chalan-bill-only').forEach(el => el.style.display = (showChalan || showBill) ? '' : 'none');
}

function attachItemCalculation() {
    // Listen for changes on quantity and rate in bill mode
    document.addEventListener('input', (e) => {
        if (currentMode === 'bill' && (e.target.classList.contains('item-quantity') || e.target.classList.contains('item-rate'))) {
            calculateRowAmount(e.target.closest('tr'));
        }
    });
}

function calculateRowAmount(row) {
    if (!row) return;
    
    const quantityInput = row.querySelector('.item-quantity');
    const rateInput = row.querySelector('.item-rate');
    const amountInput = row.querySelector('.item-amount');
    
    if (quantityInput && rateInput && amountInput) {
        const quantity = parseFloat(quantityInput.value) || 0;
        const rate = parseFloat(rateInput.value) || 0;
        const amount = quantity * rate;
        amountInput.value = amount > 0 ? Math.round(amount) : '';
    }
}

// ============================================
// Item Management
// ============================================

function addItemRow() {
    const rowCount = itemsTableBody.querySelectorAll('tr').length + 1;
    const newRow = document.createElement('tr');

    newRow.innerHTML = `
        <td class="sl-no">${rowCount}</td>
        <td class="chalan-bill-only"><input type="text" class="item-desc" placeholder="Item description"></td>
        <td class="chalan-only"><input type="text" class="item-origin" placeholder="Origin"></td>
        <td class="chalan-only"><input type="text" class="item-packaging" placeholder="Packaging"></td>
        <td class="chalan-bill-only"><input type="text" class="item-quantity" placeholder="Qty"></td>
        <td class="quote-only" style="display:none;"><input type="text" class="item-quote-product" placeholder="Product name"></td>
        <td class="quote-only" style="display:none;"><input type="text" class="item-quote-packing" placeholder="Packing"></td>
        <td class="quote-only" style="display:none;"><input type="text" class="item-quote-origin" placeholder="Country"></td>
        <td class="quote-only" style="display:none;"><input type="text" class="item-quote-price" placeholder="Price per kg"></td>
        <td class="bill-only" style="display:none;"><input type="number" class="item-rate" placeholder="Rate" step="0.01"></td>
        <td class="bill-only" style="display:none;"><input type="number" class="item-amount" placeholder="Amount" step="0.01" readonly></td>
        <td><button type="button" class="btn-remove" onclick="removeItem(this)">x</button></td>
    `;

    itemsTableBody.appendChild(newRow);
    applyModeVisibility();
}

function removeItem(button) {
    const row = button.closest('tr');
    if (itemsTableBody.querySelectorAll('tr').length > 1) {
        row.remove();
        updateSerialNumbers();
    }
}

function updateSerialNumbers() {
    const rows = itemsTableBody.querySelectorAll('tr');
    rows.forEach((row, index) => {
        row.querySelector('.sl-no').textContent = index + 1;
    });
}

// ============================================
// Chalan Generation
// ============================================

function generateChalan() {
    const chalanData = collectFormData();
    if (!validateFormData(chalanData)) {
        return;
    }

    currentChalanData = chalanData;
    renderChalanPreview(chalanData);
    showPreviewSection();
}

function collectFormData() {
    const items = [];
    const rows = itemsTableBody.querySelectorAll('tr');

    rows.forEach((row, index) => {
        const desc = row.querySelector('.item-desc')?.value.trim() || '';
        const quantity = row.querySelector('.item-quantity')?.value.trim() || '';

        if (currentMode === 'bill') {
            const rate = row.querySelector('.item-rate')?.value.trim() || '';
            const amount = row.querySelector('.item-amount')?.value.trim() || '';

            if (desc || quantity || rate || amount) {
                items.push({
                    sl: index + 1,
                    description: desc,
                    quantity: quantity,
                    rate: rate,
                    amount: amount
                });
            }
        } else if (currentMode === 'quotation') {
            const productName = row.querySelector('.item-quote-product')?.value.trim() || '';
            const packing = row.querySelector('.item-quote-packing')?.value.trim() || '';
            const origin = row.querySelector('.item-quote-origin')?.value.trim() || '';
            const price = row.querySelector('.item-quote-price')?.value.trim() || '';

            if (productName || packing || origin || price) {
                items.push({
                    sl: index + 1,
                    productName: productName,
                    packing: packing,
                    origin: origin,
                    price: price
                });
            }
        } else {
            const origin = row.querySelector('.item-origin')?.value.trim() || '';
            const packaging = row.querySelector('.item-packaging')?.value.trim() || '';

            if (desc || origin || packaging || quantity) {
                items.push({
                    sl: index + 1,
                    description: desc,
                    origin: origin,
                    packaging: packaging,
                    quantity: quantity
                });
            }
        }
    });

    return {
        mode: currentMode,
        chalanNo: document.getElementById('chalanNo').value,
        date: document.getElementById('date').value,
        poNo: document.getElementById('poNo').value.trim(),
        customerName: document.getElementById('customerName').value.trim(),
        customerPhone: document.getElementById('customerPhone').value.trim(),
        customerAddress: document.getElementById('customerAddress').value.trim(),
        quantityUnit: document.getElementById('quantityUnit').value,
        quoteTo: document.getElementById('quoteTo')?.value.trim() || '',
        quoteAttentionName: document.getElementById('quoteAttentionName')?.value.trim() || '',
        quoteAttentionDesignation: document.getElementById('quoteAttentionDesignation')?.value.trim() || '',
        quoteTerms: document.getElementById('quoteTerms')?.value.trim() || '',
        quoteValidTill: document.getElementById('quoteValidTill')?.value || '',
        quoteIncludeVat: document.getElementById('quoteIncludeVat')?.value || 'include',
        quoteIncludeDelivery: document.getElementById('quoteIncludeDelivery')?.value || 'include',
        quoteIncludeAit: document.getElementById('quoteIncludeAit')?.value || 'include',
        laborBill: document.getElementById('laborBill')?.value.trim() || '',
        transportBill: document.getElementById('transportBill')?.value.trim() || '',
        billVatMode: document.getElementById('billVatMode')?.value || 'exclude',
        billVatAmount: document.getElementById('billVatAmount')?.value.trim() || '',
        billAitMode: document.getElementById('billAitMode')?.value || 'exclude',
        billAitAmount: document.getElementById('billAitAmount')?.value.trim() || '',
        items: items,
        createdAt: new Date().toISOString()
    };
}

function validateFormData(data) {
    if (data.mode === 'quotation' && !data.quoteTo) {
        alert('Please enter recipient name');
        document.getElementById('quoteTo').focus();
        return false;
    }
    if (data.mode !== 'quotation' && !data.customerName) {
        alert('Please enter customer name');
        document.getElementById('customerName').focus();
        return false;
    }
    if (!data.date) {
        alert('Please select a date');
        document.getElementById('date').focus();
        return false;
    }
    if (data.items.length === 0) {
        alert('Please add at least one item');
        return false;
    }
    return true;
}

function renderChalanPreview(data) {
    if (data.mode === 'quotation') {
        renderQuotationPreview(data);
        return;
    }
    const isBillMode = data.mode === 'bill';
    const formattedDate = formatDate(data.date);

    if (isBillMode) {
        renderPaginatedBillPreview(data, formattedDate);
        return;
    }

    renderPaginatedChalanPreview(data, formattedDate);
}

function renderPaginatedChalanPreview(data, formattedDate) {
    // --- Measured page capacities (in item rows) ---------------------------
    // Measured on the A4 pdf-export layout (see scripts/print-check.mjs and
    // scripts/full-matrix.mjs): an A4 sheet's usable inner
    // height is ~971px. The fixed chrome (header 202 + info rows 138 + thead 49
    // + wrapper margins) leaves ~562px for the item grid on a normal page; with
    // the Page-X-of-Y line (~21px) that fits exactly 12 item rows (44px each).
    // The final page must also carry the Chalan total (quantity) row, the
    // Quantity-In-Word row and the Authorized Signatory footer (~97px) plus the
    // page line, so it fits exactly 8 item rows + 1 total row. Going above
    // either capacity pushes the signatory/page line past the sheet edge.
    const CHALAN_NORMAL_PAGE_CAPACITY = 12;
    const CHALAN_FINAL_PAGE_CAPACITY = 8;

    const quantityUnit = data.quantityUnit || 'kg';
    const items = data.items || [];

    // Totals are computed across ALL pages (not just the final page).
    let totalQuantity = 0;
    items.forEach((item) => {
        totalQuantity += parseFloat(item.quantity) || 0;
    });

    // Balanced pagination using the shared strategy: normal pages hold up to 12
    // items, the final page up to 8 (plus its total/footer).
    const chunks = paginateChalanItems(items, CHALAN_NORMAL_PAGE_CAPACITY, CHALAN_FINAL_PAGE_CAPACITY);

    const tableHeaders = `
        <th class="col-sl">Sl. No</th>
        <th class="col-desc">Description</th>
        <th class="col-origin">Origin</th>
        <th class="col-packaging">Packaging</th>
        <th class="col-quantity">Quantity</th>
    `;

    const totalQuantityValue = totalQuantity ? totalQuantity + ' ' + quantityUnit : '';

    const totalRowHtml = `
        <tr class="chalan-total-row">
            <td colspan="4" style="text-align: right; padding-right: 20px;">Total</td>
            <td class="col-quantity">${totalQuantityValue}</td>
        </tr>
    `;

    const takaValue = totalQuantity ? numberToWords(totalQuantity) + ' ' + quantityUnit : '';

    const pagesHtml = chunks.map((page, pageIndex) => {
        const pageItems = page.items;
        const isLastPage = !!page.isLastPage;

        let itemRowsHtml = pageItems.map((item) => `
            <tr>
                <td class="col-sl">${item.sl}</td>
                <td class="col-desc">${escapeHtml(item.description)}</td>
                <td class="col-origin">${escapeHtml(item.origin)}</td>
                <td class="col-packaging">${escapeHtml(item.packaging)}</td>
                <td class="col-quantity">${escapeHtml(item.quantity)} ${quantityUnit}</td>
            </tr>
        `).join('');

        // Fill each page's item grid to its fixed capacity with presentation
        // only blank rows. Normal pages fill to CHALAN_NORMAL_PAGE_CAPACITY;
        // the final page fills to CHALAN_FINAL_PAGE_CAPACITY and then carries
        // the total row + Quantity-In-Word + signatory. Blanks carry no data,
        // so quantity totals / Quantity-In-Word / saved items are unaffected.
        const pageCapacity = isLastPage ? CHALAN_FINAL_PAGE_CAPACITY : CHALAN_NORMAL_PAGE_CAPACITY;
        itemRowsHtml += renderBlankItemRows(Math.max(0, pageCapacity - pageItems.length), false);

        const footerHtml = isLastPage ? `
            <div class="chalan-footer">
                <div class="chalan-taka-row">
                    <label>Quantity(In Word)</label>
                    <span>${takaValue}</span>
                </div>

                <div class="chalan-signatory">
                    Authorized Signatory
                </div>
            </div>
        ` : '';

        const pageNoHtml = chunks.length > 1
            ? `<span class="bill-page-no">Page ${pageIndex + 1} of ${chunks.length}</span>`
            : '';

        const sheetClass = isLastPage ? 'bill-sheet' : 'bill-sheet bill-sheet-break';

        return `
            <div class="${sheetClass}">
            <div class="chalan-content bill-page">
                <div class="chalan-header">
                    <div class="chalan-logo-section">
                        <img src="logo.png" alt="SM Corporation" class="chalan-logo">
                        <div class="chalan-company-info">
                            <h1>SM CORPORATION</h1>
                            <div class="chalan-contact">
                                <div class="contact-item phone">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                    <span>01713675689</span>
                                </div>
                                <div class="contact-item facebook">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                                    <span>smcorporation.official.page</span>
                                </div>
                                <div class="contact-item email">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6ZM20 6L12 11L4 6H20ZM20 18H4V8L12 13L20 8V18Z" fill="currentColor"/></svg>
                                    <span>smcorporation.official@gmail.com</span>
                                </div>
                                <div class="contact-item address">
                                    <span>Salam Mansion, Mitford Road, Mitford, Dhaka-1100</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="chalan-badge">Chalan</div>
                </div>

                <div class="chalan-info-row">
                    <div class="chalan-info-cell" style="flex: 1;">
                        <label>Chalan No</label>
                        <span>${escapeHtml(data.chalanNo)}</span>
                    </div>
                    <div class="chalan-info-cell" style="flex: 1;">
                        <label>Date</label>
                        <span>${formattedDate}</span>
                    </div>
                    <div class="chalan-info-cell" style="flex: 1;">
                        <label>P/O</label>
                        <span>${escapeHtml(data.poNo)}</span>
                    </div>
                </div>

                <div class="chalan-info-row">
                    <div class="chalan-info-cell" style="flex: 2;">
                        <label>Name</label>
                        <span>${escapeHtml(data.customerName)}</span>
                    </div>
                    <div class="chalan-info-cell" style="flex: 1;">
                        <label>Phone</label>
                        <span>${escapeHtml(data.customerPhone)}</span>
                    </div>
                </div>

                <div class="chalan-info-row" style="margin-bottom: 15px;">
                    <div class="chalan-info-cell" style="flex: 1;">
                        <label>Address</label>
                        <span>${escapeHtml(data.customerAddress)}</span>
                    </div>
                </div>

                <div class="items-table-wrapper">
                    <img src="logo.png" alt="Watermark" class="table-watermark">
                    <table class="chalan-items-table">
                        <thead>
                            <tr>
                                ${tableHeaders}
                            </tr>
                        </thead>
                        <tbody>
                            ${itemRowsHtml}
                            ${isLastPage ? totalRowHtml : ''}
                        </tbody>
                    </table>
                </div>

                ${footerHtml}
                ${pageNoHtml}
            </div>
            </div>
        `;
    }).join('');

    chalanPreview.classList.add('multi-page-preview');
    chalanPreview.innerHTML = pagesHtml;
}

function renderPaginatedBillPreview(data, formattedDate) {
    // --- Measured page capacities (in item rows) ---------------------------
    // These are derived from the actual template layout (see the bilboarding
    // measurements): an A4 sheet is 210x297mm; the header + table header use
    // ~398px of the ~962px usable inner height and each item row is ~44px.
    // A normal (non-final) page has no totals/footer, so it can hold more rows
    // than the final page, which must also fit Subtotal/Labor/Transport/
    // AIT/VAT/Total + Taka-in-word + Authorized Signatory.
    const NORMAL_PAGE_CAPACITY = 12;
    const FINAL_PAGE_CAPACITY_NO_AIT = 5;
    const FINAL_PAGE_CAPACITY_WITH_AIT = 4;

    const quantityUnit = data.quantityUnit || 'kg';
    const items = data.items || [];

    let totalAmount = 0;
    items.forEach((item) => {
        totalAmount += (parseFloat(item.amount) || 0);
    });

    const laborBillAmount = normalizeMoney(data.laborBill);
    const transportBillAmount = normalizeMoney(data.transportBill);
    const vatAmount = data.billVatMode === 'include' ? normalizeMoney(data.billVatAmount) : 0;
    const aitIncluded = data.billAitMode === 'include';
    const aitAmount = aitIncluded ? normalizeMoney(data.billAitAmount) : 0;
    const grandTotalAmount = totalAmount + laborBillAmount + transportBillAmount + aitAmount + vatAmount;

    const finalCapacity = aitIncluded ? FINAL_PAGE_CAPACITY_WITH_AIT : FINAL_PAGE_CAPACITY_NO_AIT;

    // Build the pagination: fill normal pages from the front as full as
    // reasonably possible (each <= NORMAL_PAGE_CAPACITY), leaving a remainder
    // (>= 1, <= finalCapacity) that, together with the totals/footer, fits on
    // the final page. NEVER force a tiny first page just so the last page fits.
    const chunks = paginateItems(items, NORMAL_PAGE_CAPACITY, finalCapacity);

    const tableHeaders = `
        <th class="col-sl">Sl No</th>
        <th class="col-desc">Description</th>
        <th class="col-quantity">Quantity</th>
        <th class="col-rate">Rate/Kg</th>
        <th class="col-amount">Amount</th>
    `;

    const aitRowHtml = aitIncluded ? `
        <tr class="chalan-total-row">
            <td colspan="4" style="text-align: right; padding-right: 20px;">AIT</td>
            <td class="col-amount"><span class="money-value">${Math.round(aitAmount)} /=</span></td>
        </tr>
    ` : '';

    const totalRowsHtml = `
        <tr class="chalan-total-row">
            <td colspan="4" style="text-align: right; padding-right: 20px;">Item Subtotal</td>
            <td class="col-amount"><span class="money-value">${Math.round(totalAmount)} /=</span></td>
        </tr>
        <tr class="chalan-total-row">
            <td colspan="4" style="text-align: right; padding-right: 20px;">Labor Bill</td>
            <td class="col-amount"><span class="money-value">${laborBillAmount ? Math.round(laborBillAmount) + ' /=' : '0 /='}</span></td>
        </tr>
        <tr class="chalan-total-row">
            <td colspan="4" style="text-align: right; padding-right: 20px;">Transport Bill</td>
            <td class="col-amount"><span class="money-value">${transportBillAmount ? Math.round(transportBillAmount) + ' /=' : '0 /='}</span></td>
        </tr>
        ${aitRowHtml}
        <tr class="chalan-total-row">
            <td colspan="4" style="text-align: right; padding-right: 20px;">VAT</td>
            <td class="col-amount"><span class="money-value">${vatAmount ? Math.round(vatAmount) + ' /=' : '0 /='}</span></td>
        </tr>
        <tr class="chalan-total-row">
            <td colspan="4" style="text-align: right; padding-right: 20px;">Total</td>
            <td class="col-amount"><span class="money-value">${Math.round(grandTotalAmount)} /=</span></td>
        </tr>
    `;

    const takaValue = grandTotalAmount ? numberToWords(Math.floor(grandTotalAmount)) + ' Taka Only' : '';

    const pagesHtml = chunks.map((page, pageIndex) => {
        const pageItems = page.items;
        const isLastPage = !!page.isLastPage;

        let itemRowsHtml = pageItems.map((item) => `
            <tr>
                <td class="col-sl">${item.sl}</td>
                <td class="col-desc">${escapeHtml(item.description)}</td>
                <td class="col-quantity">${escapeHtml(item.quantity)} ${quantityUnit}</td>
                <td class="col-rate">${escapeHtml(item.rate)}</td>
                <td class="col-amount"><span class="money-value">${Math.round(parseFloat(item.amount) || 0)} /=</span></td>
            </tr>
        `).join('');

        // Fill each page's item grid to its fixed capacity with presentation
        // only blank rows. Normal pages fill to NORMAL_PAGE_CAPACITY; the final
        // page fills to finalCapacity and then carries the totals/footer. This
        // keeps every sheet a visually consistent full-height A4 form. Blanks
        // carry no data, so totals/Taka-in-word/saved items are unaffected and
        // no extra pages are produced. The logical distribution produced by
        // paginateItems() is left untouched.
        const pageCapacity = isLastPage ? finalCapacity : NORMAL_PAGE_CAPACITY;
        itemRowsHtml += renderBlankItemRows(Math.max(0, pageCapacity - pageItems.length), true);

        const footerHtml = isLastPage ? `
            <div class="chalan-footer">
                <div class="chalan-taka-row">
                    <label>Taka(In Word)</label>
                    <span>${takaValue}</span>
                </div>

                <div class="chalan-signatory">
                    Authorized Signatory
                </div>
            </div>
        ` : '';

        const pageNoHtml = chunks.length > 1
            ? `<span class="bill-page-no">Page ${pageIndex + 1} of ${chunks.length}</span>`
            : '';

        const sheetClass = isLastPage ? 'bill-sheet' : 'bill-sheet bill-sheet-break';

        return `
            <div class="${sheetClass}">
            <div class="chalan-content bill-page">
                <div class="chalan-header">
                    <div class="chalan-logo-section">
                        <img src="logo.png" alt="SM Corporation" class="chalan-logo">
                        <div class="chalan-company-info">
                            <h1>SM CORPORATION</h1>
                            <div class="chalan-contact">
                                <div class="contact-item phone">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                    <span>01713675689</span>
                                </div>
                                <div class="contact-item facebook">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                                    <span>smcorporation.official.page</span>
                                </div>
                                <div class="contact-item email">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6ZM20 6L12 11L4 6H20ZM20 18H4V8L12 13L20 8V18Z" fill="currentColor"/></svg>
                                    <span>smcorporation.official@gmail.com</span>
                                </div>
                                <div class="contact-item address">
                                    <span>Salam Mansion, Mitford Road, Mitford, Dhaka-1100</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="chalan-badge">Bill</div>
                </div>

                <div class="chalan-info-row">
                    <div class="chalan-info-cell" style="flex: 1;">
                        <label>Bill No</label>
                        <span>${escapeHtml(data.chalanNo)}</span>
                    </div>
                    <div class="chalan-info-cell" style="flex: 1;">
                        <label>Date</label>
                        <span>${formattedDate}</span>
                    </div>
                    <div class="chalan-info-cell" style="flex: 1;">
                        <label>P/O</label>
                        <span>${escapeHtml(data.poNo)}</span>
                    </div>
                </div>

                <div class="chalan-info-row">
                    <div class="chalan-info-cell" style="flex: 2;">
                        <label>Name</label>
                        <span>${escapeHtml(data.customerName)}</span>
                    </div>
                    <div class="chalan-info-cell" style="flex: 1;">
                        <label>Phone</label>
                        <span>${escapeHtml(data.customerPhone)}</span>
                    </div>
                </div>

                <div class="chalan-info-row" style="margin-bottom: 15px;">
                    <div class="chalan-info-cell" style="flex: 1;">
                        <label>Address</label>
                        <span>${escapeHtml(data.customerAddress)}</span>
                    </div>
                </div>

                <div class="items-table-wrapper">
                    <img src="logo.png" alt="Watermark" class="table-watermark">
                    <table class="chalan-items-table bill-items-table">
                        <thead>
                            <tr>
                                ${tableHeaders}
                            </tr>
                        </thead>
                        <tbody>
                            ${itemRowsHtml}
                            ${isLastPage ? totalRowsHtml : ''}
                        </tbody>
                    </table>
                </div>

                ${footerHtml}
                ${pageNoHtml}
            </div>
            </div>
        `;
    }).join('');

    chalanPreview.classList.add('multi-page-preview');
    chalanPreview.innerHTML = pagesHtml;
}

function renderQuotationPreview(data) {
    chalanPreview.classList.remove('multi-page-preview');
    const formattedDate = formatDate(data.date);
    const subject = 'Quotation Letter';

    const attentionParts = [];
    if (data.quoteAttentionName) {
        attentionParts.push(data.quoteAttentionName);
    }
    if (data.quoteAttentionDesignation) {
        attentionParts.push(`(${data.quoteAttentionDesignation})`);
    }
    const attentionLine = attentionParts.join(' ');

    const termsLines = data.quoteTerms
        ? data.quoteTerms.split('\n').map(line => line.trim()).filter(Boolean)
        : [];
    const validTill = data.quoteValidTill ? formatDate(data.quoteValidTill) : '';
    const vatLine = data.quoteIncludeVat === 'exclude' ? 'Excluding VAT' : 'Including VAT';
    const deliveryLine = data.quoteIncludeDelivery === 'exclude'
        ? 'Excluding Delivery Charge'
        : 'Including Delivery Charge';
    const aitLine = data.quoteIncludeAit === 'exclude' ? 'Excluding AIT' : 'Including AIT';
    const autoTerms = [
        validTill ? `The quotation will be valid till ${validTill}` : 'The quotation will be valid till ____',
        vatLine,
        deliveryLine,
        aitLine
    ];
    const finalTerms = termsLines.slice();
    const normalized = new Set(finalTerms.map(term => term.toLowerCase()));
    autoTerms.forEach((term) => {
        const key = term.toLowerCase();
        if (!normalized.has(key)) {
            normalized.add(key);
            finalTerms.push(term);
        }
    });

    const itemRowsHtml = data.items.map((item) => `
        <tr>
            <td>${item.sl}</td>
            <td>${escapeHtml(item.productName)}</td>
            <td>${escapeHtml(item.packing)}</td>
            <td>${escapeHtml(item.origin)}</td>
            <td>${escapeHtml(item.price)}</td>
        </tr>
    `).join('');

    const termsHtml = finalTerms.map((term) => `<li>${escapeHtml(term)}</li>`).join('');

    const quotationHtml = `
        <div class="quotation-content">
            <div class="quotation-header">
                <div class="quotation-logo">
                    <img src="logo.png" alt="SM Corporation" class="chalan-logo">
                </div>
                <div class="quotation-company">
                    <div class="chalan-company-info">
                        <h1>SM CORPORATION</h1>
                        <div class="chalan-contact">
                            <div class="contact-item phone">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                <span>01713675689</span>
                            </div>
                            <div class="contact-item facebook">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                                <span>smcorporation.official.page</span>
                            </div>
                            <div class="contact-item email">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6ZM20 6L12 11L4 6H20ZM20 18H4V8L12 13L20 8V18Z" fill="currentColor"/></svg>
                                <span>smcorporation.official@gmail.com</span>
                            </div>
                            <div class="contact-item address">
                                <span>Salam Mansion, Mitford Road, Mitford, Dhaka-1100</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="quotation-header-spacer" aria-hidden="true"></div>
            </div>

            <img src="logo.png" alt="Watermark" class="quotation-watermark">

            <div class="quotation-body-area">
                <div class="quotation-meta">
                    <div>Date: ${formattedDate}</div>
                    <div>To: ${escapeHtml(data.quoteTo)}</div>
                    ${attentionLine ? `<div>Kind Attention: ${escapeHtml(attentionLine)}</div>` : ''}
                </div>

                <div class="quotation-subject">Subject: ${escapeHtml(subject)}</div>

                <div class="quotation-body">
                    <div>Dear Sir,</div>
                    <div>We are pleased to submit you the below mentioned quotation letter as per your request.</div>
                </div>

                <div class="quotation-table-wrapper">
                    <table class="quotation-table">
                        <thead>
                            <tr>
                                <th>Sl. No</th>
                                <th>Product Name</th>
                                <th>Packing</th>
                                <th>Country Of Origin</th>
                                <th>Price Per Kg</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemRowsHtml}
                        </tbody>
                    </table>
                </div>

                <div class="quotation-terms">
                    <div><strong>Terms &amp; Condition:</strong></div>
                    <ol>
                        ${termsHtml}
                    </ol>
                </div>

                <div class="quotation-footer">
                    <div>Would you please inform if you need further assistance of the above quotation.</div>
                    <div>Thanking you with your kind anticipation</div>
                    <div>Sincerely Yours,</div>
                    <div>Waiting for your feedback</div>
                    <div class="quotation-signature">MD Asaduzzaman<br>CEO &amp; Proprietor</div>
                </div>
            </div>
        </div>
    `;

    chalanPreview.innerHTML = quotationHtml;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function addDays(date, days) {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + days);
    return newDate;
}

// ============================================
// Number to Words Conversion (Bangla/English)
// ============================================

function numberToWords(num) {
    if (num === 0) return 'Zero';

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
        'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function convertLessThanThousand(n) {
        if (n === 0) return '';

        if (n < 20) return ones[n];

        if (n < 100) {
            return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
        }

        return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThanThousand(n % 100) : '');
    }

    function convert(n) {
        if (n === 0) return 'Zero';

        let result = '';

        // Handle crore (10 million)
        if (n >= 10000000) {
            result += convertLessThanThousand(Math.floor(n / 10000000)) + ' Crore ';
            n %= 10000000;
        }

        // Handle lakh (100 thousand)
        if (n >= 100000) {
            result += convertLessThanThousand(Math.floor(n / 100000)) + ' Lakh ';
            n %= 100000;
        }

        // Handle thousand
        if (n >= 1000) {
            result += convertLessThanThousand(Math.floor(n / 1000)) + ' Thousand ';
            n %= 1000;
        }

        // Handle hundreds and below
        if (n > 0) {
            result += convertLessThanThousand(n);
        }

        return result.trim();
    }

    // Handle decimal part
    const numStr = String(num);
    const parts = numStr.split('.');
    let result = convert(parseInt(parts[0]));

    if (parts.length > 1 && parseInt(parts[1]) > 0) {
        result += ' Point';
        for (let digit of parts[1]) {
            result += ' ' + ones[parseInt(digit)];
        }
    }

    return result;
}

// ============================================
// Section Navigation
// ============================================

function showInputForm() {
    inputSection.classList.remove('hidden');
    savedSection.classList.add('hidden');
    previewSection.classList.add('hidden');
    requestAnimationFrame(updatePreviewScale);
}

function showPreviewSection() {
    inputSection.classList.add('hidden');
    savedSection.classList.add('hidden');
    previewSection.classList.remove('hidden');
    requestAnimationFrame(updatePreviewScale);
}

// ============================================
// Responsive preview scaling
// ============================================

// The A4 document (#chalan-preview) is ALWAYS a fixed 210mm sheet with real
// A4 geometry - its width must never depend on the viewport or pagination
// capacities / PDF page count / centering would break. On narrow screens we
// only *visually* scale it down via a transform on the wrapper
// (.preview-scale); the wrapper reserves the scaled height so pages never
// overlap and the browser never gains a horizontal scrollbar.
//
// The transform lives on the wrapper, never on the document itself, so:
//   - .pdf-export (html2pdf clones #chalan-preview) is unaffected
//   - @media print resets the wrapper back to natural size
//   - a PDF from a 375px phone is geometrically identical to one from a
//     1440px desktop.
let previewScale = 1;

function updatePreviewScale() {
    const viewport = document.querySelector('.preview-viewport');
    const wrapper = document.querySelector('.preview-scale');
    if (!viewport || !wrapper || !chalanPreview) return;
    if (!chalanPreview.innerHTML.trim()) return;

    const naturalWidth = parseFloat(getComputedStyle(chalanPreview).width);
    if (!naturalWidth || !isFinite(naturalWidth)) return;

    const availableWidth = viewport.clientWidth;
    if (!availableWidth) return;

    // Natural (untransformed) layout height: the whole stacked document.
    const naturalHeight = chalanPreview.getBoundingClientRect().height / previewScale;

    const scale = Math.min(1, availableWidth / naturalWidth);
    previewScale = scale;

    if (scale >= 1) {
        wrapper.style.transform = '';
        wrapper.style.width = '';
        wrapper.style.height = '';
        return;
    }

    wrapper.style.transformOrigin = 'top left';
    wrapper.style.transform = `scale(${scale})`;
    wrapper.style.width = `${(naturalWidth * scale).toFixed(3)}px`;
    wrapper.style.height = `${(naturalHeight * scale).toFixed(3)}px`;
}

function setupPreviewScaling() {
    const viewport = document.querySelector('.preview-viewport');
    if (!viewport || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => updatePreviewScale());
    observer.observe(viewport);
    observer.observe(chalanPreview);
    window.addEventListener('resize', updatePreviewScale);
    updatePreviewScale();
}

function showSavedChalans() {
    inputSection.classList.add('hidden');
    previewSection.classList.add('hidden');
    savedSection.classList.remove('hidden');
    renderSavedChalans();
}

// ============================================
// Chalan Storage
// ============================================

function getSavedChalans() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveChalansToStorage(chalans) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chalans));
}

function downloadPdf() {
    if (!currentChalanData) {
        alert('No data to download');
        return;
    }

    const docType = currentChalanData.mode === 'bill'
        ? 'Bill'
        : currentChalanData.mode === 'quotation'
            ? 'Quotation'
            : 'Chalan';
    const chalanPreview = document.getElementById('chalan-preview');
    if (!chalanPreview) {
        alert('Preview not ready. Please generate the document first.');
        return;
    }

    const fileSafeNumber = (currentChalanData.chalanNo || docType)
        .toString()
        .replace(/[^a-z0-9_-]+/gi, '-')
        .replace(/^-+|-+$/g, '');
    const fileName = `${docType}-${fileSafeNumber || 'document'}.pdf`;

    if (typeof html2pdf === 'undefined') {
        alert('PDF generator not loaded. Please refresh the page.');
        return;
    }

    const options = {
        margin: 0,
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 3,
            useCORS: true,
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: 0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
    };

    // Robust multi-step PDF export.
    // Root cause of "PDF download failed. Please try again.":
    //  (a) html2canvas re-fetches <img src="logo.png"> as a cross-origin
    //      (file://) resource. Drawing that taints the canvas, so the later
    //      toDataURL() throws a SecurityError that a generic catch swallows.
    //      Inlining a data:URI for the logo avoids the cross-origin fetch.
    //  (b) html2pdf's bundled FileSaver triggers the download via a detached
    //      anchor clicked on a setTimeout(0) after revoking the blob URL. That
    //      is fragile across browsers/headless and can be dropped silently.
    //      Instead we produce the PDF Blob with the worker's outputPdf() and
    //      drive the actual file download ourselves with a DOM-attached anchor,
    //      which browsers treat as a normal, allowed user-initiated download.
    document.body.classList.add('pdf-export');

    const swappedImages = [];
    if (typeof LOGO_DATA_URI === 'string') {
        chalanPreview.querySelectorAll('img').forEach((img) => {
            const src = img.getAttribute('src') || '';
            if (src.includes('logo.png')) {
                swappedImages.push({ img, src });
                img.setAttribute('src', LOGO_DATA_URI);
            }
        });
    }

    html2pdf().set(options).from(chalanPreview).outputPdf('blob').then((blob) => {
        // Counter/serial advances only after the PDF bytes are successfully
        // produced, matching the previous save()-based behaviour.
        setTimeout(() => {
            if (currentChalanData.mode === 'bill') {
                const newCounter = incrementBillNumber();
                updateAutoNumberForMode('bill', formatChalanNumber(newCounter));
            } else if (currentChalanData.mode === 'quotation') {
                const newCounter = incrementQuotationNumber();
                updateAutoNumberForMode('quotation', formatChalanNumber(newCounter));
            } else {
                const newCounter = incrementChalanNumber();
                updateAutoNumberForMode('chalan', formatChalanNumber(newCounter));
            }
        }, 1000);

        triggerPdfDownload(blob, fileName);
    }).catch((error) => {
        // Keep a real diagnostic in the console so future failures are not
        // hidden behind the generic alert.
        console.error('PDF generation failed:', error);
        alert('PDF download failed. Please try again.');
    }).finally(() => {
        swappedImages.forEach(({ img, src }) => img.setAttribute('src', src));
        document.body.classList.remove('pdf-export');
    });
}

// Depend on an anchor that is actually part of the document so the "download"
// attribute applies a normal, allowed download. The blob URL is revoked well
// after the click (matching FileSaver's own deferred cleanup).
function triggerPdfDownload(blob, filename) {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 40000);
}



function renderSavedChalans() {
    const chalans = getSavedChalans();

    if (chalans.length === 0) {
        savedChalansList.innerHTML = `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <p>No saved documents yet</p>
                <p>Generate and save your first document!</p>
            </div>
        `;
        return;
    }

    // Sort by date (newest first)
    chalans.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    savedChalansList.innerHTML = chalans.map(chalan => {
        const docType = chalan.mode === 'bill'
            ? 'Bill'
            : chalan.mode === 'quotation'
                ? 'Quotation'
                : 'Chalan';
        const docLabel = docType;
        
        return `
            <div class="saved-item">
                <div class="saved-item-info">
                    <h4>${docLabel} #${escapeHtml(chalan.chalanNo)}</h4>
                    <p>${escapeHtml(chalan.customerName)} • ${formatDate(chalan.date)}</p>
                </div>
                <div class="saved-item-actions">
                    <button class="btn-view" onclick="viewSavedChalan('${chalan.chalanNo}')">View</button>
                    <button class="btn-delete" onclick="deleteSavedChalan('${chalan.chalanNo}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function viewSavedChalan(chalanNo) {
    const chalans = getSavedChalans();
    const chalan = chalans.find(c => c.chalanNo === chalanNo);

    if (chalan) {
        currentChalanData = chalan;
        renderChalanPreview(chalan);
        showPreviewSection();
    }
}

function deleteSavedChalan(chalanNo) {
    if (!confirm('Are you sure you want to delete this document?')) {
        return;
    }

    let chalans = getSavedChalans();
    chalans = chalans.filter(c => c.chalanNo !== chalanNo);
    saveChalansToStorage(chalans);
    renderSavedChalans();
}

// ============================================
// Print & New Chalan
// ============================================

function printChalan() {
    window.print();
}

function startNewChalan() {
    // Reset form
    document.getElementById('customerName').value = '';
    document.getElementById('customerPhone').value = '';
    document.getElementById('customerAddress').value = '';
    document.getElementById('poNo').value = '';
    const laborBill = document.getElementById('laborBill');
    const transportBill = document.getElementById('transportBill');
    const billVatMode = document.getElementById('billVatMode');
    const billVatAmount = document.getElementById('billVatAmount');
    const billVatAmountGroup = document.getElementById('billVatAmountGroup');
    const billAitMode = document.getElementById('billAitMode');
    const billAitAmount = document.getElementById('billAitAmount');
    const billAitAmountGroup = document.getElementById('billAitAmountGroup');
    if (laborBill) laborBill.value = '';
    if (transportBill) transportBill.value = '';
    if (billVatMode) billVatMode.value = 'exclude';
    if (billVatAmount) billVatAmount.value = '';
    if (billVatAmountGroup) billVatAmountGroup.style.display = 'none';
    if (billAitMode) billAitMode.value = 'exclude';
    if (billAitAmount) billAitAmount.value = '';
    if (billAitAmountGroup) billAitAmountGroup.style.display = 'none';

    const quoteTo = document.getElementById('quoteTo');
    const quoteAttentionName = document.getElementById('quoteAttentionName');
    const quoteAttentionDesignation = document.getElementById('quoteAttentionDesignation');
    const quoteTerms = document.getElementById('quoteTerms');
    const quoteValidTill = document.getElementById('quoteValidTill');
    const quoteIncludeVat = document.getElementById('quoteIncludeVat');
    const quoteIncludeDelivery = document.getElementById('quoteIncludeDelivery');
    const quoteIncludeAit = document.getElementById('quoteIncludeAit');

    if (quoteTo) quoteTo.value = '';
    if (quoteAttentionName) quoteAttentionName.value = '';
    if (quoteAttentionDesignation) quoteAttentionDesignation.value = '';
    if (quoteTerms) quoteTerms.value = '';
    if (quoteValidTill) quoteValidTill.value = '';
    if (quoteIncludeVat) quoteIncludeVat.value = 'include';
    if (quoteIncludeDelivery) quoteIncludeDelivery.value = 'include';
    if (quoteIncludeAit) quoteIncludeAit.value = 'include';

    // Reset items table
    itemsTableBody.innerHTML = '';
    addItemRow();

    // Update document number and date
    applyDocumentNumberForMode(currentMode);
    setTodayDate();

    currentChalanData = null;
    chalanPreview.classList.remove('multi-page-preview');
    chalanPreview.innerHTML = '';
    showInputForm();
}


// Make functions available globally for inline onclick handlers
window.removeItem = removeItem;
window.viewSavedChalan = viewSavedChalan;
window.deleteSavedChalan = deleteSavedChalan;
