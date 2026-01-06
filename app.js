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

// Current chalan data
let currentChalanData = null;

// Current mode (chalan or bill)
let currentMode = 'chalan';

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeChalanNumber();
    setTodayDate();
    attachEventListeners();
    setupModeToggle();
    attachItemCalculation();
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
    
    document.getElementById('chalanNo').value = formatChalanNumber(counter);
}

function formatChalanNumber(num) {
    return String(num).padStart(4, '0');
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
    currentMode = mode;
    
    // Update form title
    const formTitle = document.getElementById('form-title');
    const docNoLabel = document.getElementById('docNoLabel');
    const generateBtnText = document.getElementById('generateBtnText');
    const printBtnText = document.getElementById('printBtnText');
    const newDocBtnText = document.getElementById('newDocBtnText');
    const savedSectionTitle = document.getElementById('savedSectionTitle');
    
    if (mode === 'bill') {
        formTitle.textContent = 'Bill Generator';
        docNoLabel.textContent = 'Bill No';
        generateBtnText.textContent = 'Generate Bill';
        printBtnText.textContent = 'Print Bill';
        newDocBtnText.textContent = 'New Bill';
        savedSectionTitle.textContent = 'Saved Bills';
        
        // Update document number
        const billCounter = localStorage.getItem(BILL_COUNTER_KEY) || '1';
        document.getElementById('chalanNo').value = formatChalanNumber(billCounter);
        
        // Show bill columns, hide chalan columns
        document.querySelectorAll('.chalan-only').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.bill-only').forEach(el => el.style.display = '');
    } else {
        formTitle.textContent = 'Chalan Generator';
        docNoLabel.textContent = 'Chalan No';
        generateBtnText.textContent = 'Generate Chalan';
        printBtnText.textContent = 'Print Chalan';
        newDocBtnText.textContent = 'New Chalan';
        savedSectionTitle.textContent = 'Saved Chalans';
        
        // Update document number
        const chalanCounter = localStorage.getItem(CHALAN_COUNTER_KEY) || '1';
        document.getElementById('chalanNo').value = formatChalanNumber(chalanCounter);
        
        // Show chalan columns, hide bill columns
        document.querySelectorAll('.chalan-only').forEach(el => el.style.display = '');
        document.querySelectorAll('.bill-only').forEach(el => el.style.display = 'none');
    }
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
    
    if (currentMode === 'bill') {
        newRow.innerHTML = `
            <td class="sl-no">${rowCount}</td>
            <td><input type="text" class="item-desc" placeholder="Item description"></td>
            <td><input type="text" class="item-quantity" placeholder="Qty"></td>
            <td class="bill-only"><input type="number" class="item-rate" placeholder="Rate" step="0.01"></td>
            <td class="bill-only"><input type="number" class="item-amount" placeholder="Amount" step="0.01" readonly></td>
            <td><button type="button" class="btn-remove" onclick="removeItem(this)">×</button></td>
        `;
    } else {
        newRow.innerHTML = `
            <td class="sl-no">${rowCount}</td>
            <td><input type="text" class="item-desc" placeholder="Item description"></td>
            <td class="chalan-only"><input type="text" class="item-origin" placeholder="Origin"></td>
            <td class="chalan-only"><input type="text" class="item-packaging" placeholder="Packaging"></td>
            <td><input type="text" class="item-quantity" placeholder="Qty"></td>
            <td><button type="button" class="btn-remove" onclick="removeItem(this)">×</button></td>
        `;
    }
    
    itemsTableBody.appendChild(newRow);
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
        const desc = row.querySelector('.item-desc').value.trim();
        const quantity = row.querySelector('.item-quantity').value.trim();

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
        items: items,
        createdAt: new Date().toISOString()
    };
}

function validateFormData(data) {
    if (!data.customerName) {
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
    const isBillMode = data.mode === 'bill';
    const formattedDate = formatDate(data.date);
    
    // Calculate totals
    let totalQuantity = 0;
    let totalAmount = 0;
    
    data.items.forEach(item => {
        const qty = parseFloat(item.quantity) || 0;
        totalQuantity += qty;
        
        if (isBillMode) {
            const amt = parseFloat(item.amount) || 0;
            totalAmount += amt;
        }
    });

    // Generate item rows (minimum 13 rows to fill A4 page)
    let itemRowsHtml = '';
    const minRows = 13;
    const totalRows = Math.max(data.items.length, minRows);

    for (let i = 0; i < totalRows; i++) {
        if (i < data.items.length) {
            const item = data.items[i];
            
            if (isBillMode) {
                itemRowsHtml += `
                    <tr>
                        <td class="col-sl">${item.sl}</td>
                        <td class="col-desc">${escapeHtml(item.description)}</td>
                        <td class="col-quantity">${escapeHtml(item.quantity)} ${data.quantityUnit || 'kg'}</td>
                        <td class="col-rate">${escapeHtml(item.rate)}</td>
                        <td class="col-amount">${Math.round(parseFloat(item.amount) || 0)} /=</td>
                    </tr>
                `;
            } else {
                itemRowsHtml += `
                    <tr>
                        <td class="col-sl">${item.sl}</td>
                        <td class="col-desc">${escapeHtml(item.description)}</td>
                        <td class="col-origin">${escapeHtml(item.origin)}</td>
                        <td class="col-packaging">${escapeHtml(item.packaging)}</td>
                        <td class="col-quantity">${escapeHtml(item.quantity)} ${data.quantityUnit || 'kg'}</td>
                    </tr>
                `;
            }
        } else {
            if (isBillMode) {
                itemRowsHtml += `
                    <tr>
                        <td class="col-sl"></td>
                        <td class="col-desc"></td>
                        <td class="col-quantity"></td>
                        <td class="col-rate"></td>
                        <td class="col-amount"></td>
                    </tr>
                `;
            } else {
                itemRowsHtml += `
                    <tr>
                        <td class="col-sl"></td>
                        <td class="col-desc"></td>
                        <td class="col-origin"></td>
                        <td class="col-packaging"></td>
                        <td class="col-quantity"></td>
                    </tr>
                `;
            }
        }
    }

    // Table headers based on mode
    const tableHeaders = isBillMode ? `
        <th class="col-sl">Sl No</th>
        <th class="col-desc">Description</th>
        <th class="col-quantity">Quantity</th>
        <th class="col-rate">Rate/Kg</th>
        <th class="col-amount">Amount</th>
    ` : `
        <th class="col-sl">Sl. No</th>
        <th class="col-desc">Description</th>
        <th class="col-origin">Origin</th>
        <th class="col-packaging">Packaging</th>
        <th class="col-quantity">Quantity</th>
    `;

    // Total row based on mode
    const totalRow = isBillMode ? `
        <tr class="chalan-total-row">
            <td colspan="4" style="text-align: right; padding-right: 20px;">Total</td>
            <td class="col-amount">${totalAmount ? Math.round(totalAmount) + ' /=' : ''}</td>
        </tr>
    ` : `
        <tr class="chalan-total-row">
            <td colspan="4" style="text-align: right; padding-right: 20px;">Total</td>
            <td class="col-quantity">${totalQuantity ? totalQuantity + ' ' + (data.quantityUnit || 'kg') : ''}</td>
        </tr>
    `;

    // Badge and label text
    const badgeText = isBillMode ? 'Bill' : 'Chalan';
    const docNoLabel = isBillMode ? 'Bill No' : 'Chalan No';
    
    // Taka in words label
    const takaLabel = isBillMode ? 'Taka(In Word)' : 'Quantity(In Word)';
    const takaValue = isBillMode ? 
        (totalAmount ? numberToWords(Math.floor(totalAmount)) + ' Taka Only' : '') :
        (totalQuantity ? numberToWords(totalQuantity) + ' ' + (data.quantityUnit || 'kg') : '');

    const chalanHtml = `
        <div class="chalan-content">
            <!-- Header -->
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
                                <span>House: 29, Road: 06, Block: G, Aftabnagar, Dhaka-1212</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="chalan-badge">${badgeText}</div>
            </div>

            <!-- Info Row 1 -->
            <div class="chalan-info-row">
                <div class="chalan-info-cell" style="flex: 1;">
                    <label>${docNoLabel}</label>
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

            <!-- Info Row 2 -->
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

            <!-- Info Row 3 -->
            <div class="chalan-info-row" style="margin-bottom: 15px;">
                <div class="chalan-info-cell" style="flex: 1;">
                    <label>Address</label>
                    <span>${escapeHtml(data.customerAddress)}</span>
                </div>
            </div>

            <!-- Items Table -->
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
                        ${totalRow}
                    </tbody>
                </table>
            </div>

            <!-- Footer -->
            <div class="chalan-footer">
                <div class="chalan-taka-row">
                    <label>${takaLabel}</label>
                    <span>${takaValue}</span>
                </div>
                
                <div class="chalan-signatory">
                    Authorized Signatory
                </div>
            </div>
        </div>
    `;

    chalanPreview.innerHTML = chalanHtml;
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
}

function showPreviewSection() {
    inputSection.classList.add('hidden');
    savedSection.classList.add('hidden');
    previewSection.classList.remove('hidden');
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

    const docType = currentChalanData.mode === 'bill' ? 'Bill' : 'Chalan';

    // Use browser's print dialog which allows saving as PDF
    // This avoids CORS issues with local files
    alert(`Print Dialog Instructions:\\n\\n1. Select "Save as PDF" or "Microsoft Print to PDF"\\n2. Set Margins to "None" for full page\\n3. Uncheck "Headers and footers"\\n4. Click Save/Print`);

    window.print();

    // Increment number for next document after printing
    setTimeout(() => {
        if (currentChalanData.mode === 'bill') {
            const newCounter = incrementBillNumber();
            document.getElementById('chalanNo').value = formatChalanNumber(newCounter);
        } else {
            const newCounter = incrementChalanNumber();
            document.getElementById('chalanNo').value = formatChalanNumber(newCounter);
        }
    }, 1000);
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
        const docType = chalan.mode === 'bill' ? 'Bill' : 'Chalan';
        const docLabel = chalan.mode === 'bill' ? 'Bill' : 'Chalan';
        
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
    if (!confirm('Are you sure you want to delete this chalan?')) {
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

    // Reset items table
    itemsTableBody.innerHTML = `
        <tr>
            <td class="sl-no">1</td>
            <td><input type="text" class="item-desc" placeholder="Item description"></td>
            <td><input type="text" class="item-origin" placeholder="Origin"></td>
            <td><input type="text" class="item-packaging" placeholder="Packaging"></td>
            <td><input type="text" class="item-quantity" placeholder="Qty"></td>
            <td><button type="button" class="btn-remove" onclick="removeItem(this)">×</button></td>
        </tr>
    `;

    // Update chalan number and date
    const currentCounter = localStorage.getItem(CHALAN_COUNTER_KEY) || '1';
    document.getElementById('chalanNo').value = formatChalanNumber(currentCounter);
    setTodayDate();

    currentChalanData = null;
    showInputForm();
}

// Make functions available globally for inline onclick handlers
window.removeItem = removeItem;
window.viewSavedChalan = viewSavedChalan;
window.deleteSavedChalan = deleteSavedChalan;
