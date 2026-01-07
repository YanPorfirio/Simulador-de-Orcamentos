// ProSimulador - script principal
// Responsabilidades:
// - Capturar submit do formulário
// - Calcular subtotais e totais
// - Renderizar tabela de itens
// - Persistir em localStorage
// - Suportar remoção/novo orçamento/salvar

class Budget {
    constructor() {
        this.items = [];
        this.editingId = null;
        this.formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
        this.loadFromStorage();
        this.bindElements();
        this.attachListeners();
        this.updateBudgetInfo();
        this.renderItems();
        this.updateTotals();
    }

    bindElements() {
        this.form = document.getElementById('budget-form');
        this.desc = document.getElementById('desc');
        this.qty = document.getElementById('qty');
        this.price = document.getElementById('price');
        this.discount = document.getElementById('discount');
        this.itemSubtotal = document.getElementById('item-subtotal');
        this.itemTotal = document.getElementById('item-total');
        this.message = document.getElementById('form-message');
        this.tbody = document.getElementById('budget-items');
        this.subtotalAmount = document.getElementById('subtotal-amount');
        this.discountTotal = document.getElementById('discount-total');
        this.totalAmount = document.getElementById('total-amount');
        this.toggleBtn = document.getElementById('toggle-form');
        this.saveBtn = document.getElementById('save-budget');
        this.exportBtn = document.getElementById('export-pdf');
        this.newBtn = document.getElementById('new-budget');
        this.calcBtn = document.getElementById('calculate-total');
        this.budgetNumber = document.getElementById('budget-number');
        this.budgetDate = document.getElementById('budget-date');
        this.viewHistoryBtn = document.getElementById('view-history');
        this.historyPanel = document.getElementById('history-panel');
        this.historyList = document.getElementById('history-list');
        this.closeHistoryBtn = document.getElementById('close-history');
        this.clearHistoryBtn = document.getElementById('clear-history');
    }

    attachListeners() {
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
            this.form.addEventListener('reset', () => this.resetPreview());
        }

        [this.qty, this.price, this.discount].forEach(el => {
            if (el) el.addEventListener('input', () => this.updatePreview());
        });

        if (this.toggleBtn) this.toggleBtn.addEventListener('click', () => this.toggleForm());
        if (this.saveBtn) this.saveBtn.addEventListener('click', () => this.saveBudget());
        if (this.exportBtn) this.exportBtn.addEventListener('click', () => this.exportToPDF());
        if (this.newBtn) this.newBtn.addEventListener('click', () => this.createNewBudget());
        if (this.calcBtn) this.calcBtn.addEventListener('click', () => this.updateTotals());
    if (this.viewHistoryBtn) this.viewHistoryBtn.addEventListener('click', () => this.showHistory());
    if (this.closeHistoryBtn) this.closeHistoryBtn.addEventListener('click', () => this.closeHistory());
    if (this.clearHistoryBtn) this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());

        // Keyboard shortcuts (Ctrl+S, Ctrl+P, Ctrl+N)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key.toLowerCase() === 's') { e.preventDefault(); this.saveBudget(); }
                if (e.key.toLowerCase() === 'p') { e.preventDefault(); this.exportToPDF(); }
                if (e.key.toLowerCase() === 'n') { e.preventDefault(); this.createNewBudget(); }
            }
        });
    }

    // ---------- Form handlers ----------
    handleSubmit(e) {
        e.preventDefault();
        // basic validation
        if (!this.form.checkValidity()) {
            this.showMessage('Por favor, verifique os campos do formulário.', 'error');
            return;
        }

        const payload = {
            description: this.desc.value.trim(),
            quantity: Number(this.qty.value) || 0,
            unitPrice: Number(this.price.value) || 0,
            discount: Number(this.discount.value) || 0
        };

        if (this.editingId) {
            // atualizar item existente
            const idx = this.items.findIndex(i => i.id === this.editingId);
            if (idx !== -1) {
                this.items[idx] = Object.assign({}, this.items[idx], payload);
                this.items[idx].subtotal = this.calculateSubtotal(this.items[idx]);
                this.showMessage('Item atualizado com sucesso!', 'success');
            }
            this.editingId = null;
        } else {
            const item = Object.assign({ id: Date.now() }, payload);
            item.subtotal = this.calculateSubtotal(item);
            this.items.push(item);
            this.showMessage('Item adicionado com sucesso!', 'success');
        }
        this.saveToStorage();
        this.renderItems();
        this.updateTotals();
        this.form.reset();
        this.resetPreview();
    }

    calculateSubtotal(item) {
        const subtotal = item.quantity * item.unitPrice;
        return subtotal * (1 - Math.min(Math.max(item.discount, 0), 100) / 100);
    }

    // Update preview (per item) while typing
    updatePreview() {
        const qty = Number(this.qty.value) || 0;
        const price = Number(this.price.value) || 0;
        const discount = Number(this.discount.value) || 0;
        const subtotal = qty * price;
        const total = subtotal * (1 - Math.min(Math.max(discount, 0), 100) / 100);
        this.itemSubtotal.textContent = this.formatCurrency(subtotal);
        this.itemTotal.textContent = this.formatCurrency(total);
    }

    resetPreview() {
        this.itemSubtotal.textContent = this.formatCurrency(0);
        this.itemTotal.textContent = this.formatCurrency(0);
    }

    // ---------- Render / UI ----------
    renderItems() {
        if (!this.tbody) return;
        this.tbody.innerHTML = this.items.map(item => `
            <tr data-id="${item.id}">
                <td>${this.escapeHtml(item.description)}</td>
                <td class="text-center">${item.quantity}</td>
                <td class="text-right">${this.formatCurrency(item.unitPrice)}</td>
                <td class="text-center">${item.discount}%</td>
                <td class="text-right">${this.formatCurrency(item.subtotal)}</td>
                <td class="text-center">
                    <button class="edit-btn" data-id="${item.id}" title="Editar item">Editar</button>
                    <button class="delete-btn" data-id="${item.id}" title="Remover item">Remover</button>
                </td>
            </tr>
        `).join('');

        // Attach delete listeners (delegation alternative)
        this.tbody.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = Number(e.currentTarget.getAttribute('data-id'));
                this.removeItem(id);
            });
        });

        // Attach edit listeners
        this.tbody.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = Number(e.currentTarget.getAttribute('data-id'));
                this.startEdit(id);
            });
        });
    }

    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>"]+/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
    }

    // ---------- Totals / persistence ----------
    updateTotals() {
        const subtotal = this.items.reduce((s, it) => s + (it.quantity * it.unitPrice), 0);
        const discountTotal = this.items.reduce((s, it) => s + ((it.quantity * it.unitPrice) * (it.discount/100)), 0);
        const total = subtotal - discountTotal;

        if (this.subtotalAmount) this.subtotalAmount.textContent = this.formatCurrency(subtotal);
        if (this.discountTotal) this.discountTotal.textContent = this.formatCurrency(discountTotal);
        if (this.totalAmount) {
            this.totalAmount.textContent = this.formatCurrency(total);
            this.totalAmount.classList.add('highlight');
            setTimeout(() => this.totalAmount.classList.remove('highlight'), 900);
        }
    }

    saveToStorage() {
        try { localStorage.setItem('budgetItems', JSON.stringify(this.items)); }
        catch (e) { console.warn('Erro salvando localStorage', e); }
    }

    loadFromStorage() {
        try {
            const stored = localStorage.getItem('budgetItems');
            if (stored) this.items = JSON.parse(stored);
        } catch (e) { console.warn('Erro lendo localStorage', e); }
    }

    // ---------- Actions ----------
    removeItem(id) {
        const idx = this.items.findIndex(i => i.id === id);
        if (idx === -1) return;
        if (!confirm('Tem certeza que deseja remover este item?')) return;
        this.items.splice(idx, 1);
        this.saveToStorage();
        this.renderItems();
        this.updateTotals();
        this.showMessage('Item removido', 'success');
    }

    createNewBudget() {
        if (this.items.length === 0) { this.showMessage('Nenhum item para limpar.', 'info'); return; }
        if (!confirm('Criar novo orçamento? Isso limpará os itens atuais.')) return;
        this.items = [];
        this.saveToStorage();
        this.renderItems();
        this.updateTotals();
        this.showMessage('Novo orçamento iniciado.', 'success');
    }

    saveBudget() {
        if (this.items.length === 0) { this.showMessage('Adicione itens antes de salvar.', 'error'); return; }
        const history = JSON.parse(localStorage.getItem('budgetHistory') || '[]');
        const snapshot = {
            id: Date.now(),
            date: new Date().toISOString(),
            items: this.items.slice()
        };
        history.push(snapshot);
        localStorage.setItem('budgetHistory', JSON.stringify(history));
        this.showMessage('Orçamento salvo no histórico.', 'success');
        // atualizar painel de histórico se aberto
        if (this.historyPanel && this.historyPanel.classList.contains('visible')) this.renderHistory();
    }

    exportToPDF() {
        const el = document.querySelector('.container-list');
        if (!el) { this.showMessage('Área para exportar não encontrada.', 'error'); return; }
        // filename com data
        const filename = `orcamento_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.pdf`;
        try {
            if (window.html2pdf) {
                const opt = {
                    margin:       0.5,
                    filename:     filename,
                    image:        { type: 'jpeg', quality: 0.98 },
                    html2canvas:  { scale: 2 },
                    jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
                };
                this.showMessage('Gerando PDF…', 'info');
                html2pdf().set(opt).from(el).save().then(() => this.showMessage('PDF gerado com sucesso.', 'success'));
            } else {
                this.showMessage('Biblioteca html2pdf não disponível; tente salvar manualmente.', 'error');
            }
        } catch (err) {
            console.error(err);
            this.showMessage('Erro ao gerar PDF.', 'error');
        }
    }

    // ---------- History panel ----------
    showHistory() {
        if (!this.historyPanel) return;
        this.historyPanel.classList.add('visible');
        this.historyPanel.setAttribute('aria-hidden','false');
        this.renderHistory();
    }

    closeHistory() {
        if (!this.historyPanel) return;
        this.historyPanel.classList.remove('visible');
        this.historyPanel.setAttribute('aria-hidden','true');
    }

    renderHistory() {
        if (!this.historyList) return;
        const history = JSON.parse(localStorage.getItem('budgetHistory') || '[]');
        if (history.length === 0) {
            this.historyList.innerHTML = '<p>Nenhum orçamento salvo.</p>';
            return;
        }
        this.historyList.innerHTML = history.map(h => `
            <div class="history-item" data-id="${h.id}">
                <div>
                    <div><strong>Orçamento</strong> — ${new Date(h.date).toLocaleString()}</div>
                    <div class="meta">${h.items.length} itens</div>
                </div>
                <div class="actions">
                    <button class="action-btn" data-id="${h.id}" data-action="restore">Restaurar</button>
                    <button class="action-btn" data-id="${h.id}" data-action="delete">Excluir</button>
                </div>
            </div>
        `).join('');

        // listeners
        this.historyList.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = Number(e.currentTarget.getAttribute('data-id'));
                const action = e.currentTarget.getAttribute('data-action');
                if (action === 'restore') this.restoreHistory(id);
                if (action === 'delete') this.deleteHistory(id);
            });
        });
    }

    restoreHistory(id) {
        const history = JSON.parse(localStorage.getItem('budgetHistory') || '[]');
        const snap = history.find(h => h.id === id);
        if (!snap) { this.showMessage('Histórico não encontrado.', 'error'); return; }
        if (!confirm('Restaurar este orçamento? Isso substituirá os itens atuais.')) return;
        this.items = snap.items.map(it => ({ ...it }));
        this.saveToStorage();
        this.renderItems();
        this.updateTotals();
        this.showMessage('Orçamento restaurado.', 'success');
        this.closeHistory();
    }

    deleteHistory(id) {
        let history = JSON.parse(localStorage.getItem('budgetHistory') || '[]');
        history = history.filter(h => h.id !== id);
        localStorage.setItem('budgetHistory', JSON.stringify(history));
        this.renderHistory();
        this.showMessage('Entrada do histórico removida.', 'success');
    }

    clearHistory() {
        if (!confirm('Limpar todo o histórico?')) return;
        localStorage.removeItem('budgetHistory');
        this.renderHistory();
        this.showMessage('Histórico limpo.', 'success');
    }

    // ---------- Edit flow ----------
    startEdit(id) {
        const item = this.items.find(i => i.id === id);
        if (!item) return;
        this.editingId = id;
        // preencher formulário
        this.desc.value = item.description;
        this.qty.value = item.quantity;
        this.price.value = item.unitPrice;
        this.discount.value = item.discount;
        this.updatePreview();
        // focar descrição
        this.desc.focus();
    }

    toggleForm() {
        const form = document.querySelector('.professional-form');
        if (!form) return;
        form.classList.toggle('collapsed');
        const icon = this.toggleBtn.querySelector('i');
        if (form.classList.contains('collapsed')) {
            icon.classList.remove('fa-chevron-up'); icon.classList.add('fa-chevron-down');
        } else {
            icon.classList.remove('fa-chevron-down'); icon.classList.add('fa-chevron-up');
        }
    }

    updateBudgetInfo() {
        const dateEl = this.budgetDate;
        if (dateEl) dateEl.textContent = new Date().toLocaleDateString('pt-BR');
    }

    formatCurrency(value) { return this.formatter.format(Number(value || 0)); }

    showMessage(text, type='info') {
        if (!this.message) return;
        this.message.textContent = text;
        this.message.className = `message ${type}`;
        setTimeout(() => { this.message.textContent=''; this.message.className='message'; }, 3000);
    }
}

// Inicializa quando DOM pronto
document.addEventListener('DOMContentLoaded', () => {
    window.budget = new Budget();
});
