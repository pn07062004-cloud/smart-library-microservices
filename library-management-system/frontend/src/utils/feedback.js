const TOAST_ROOT_ID = 'library-toast-root';
const CONFIRM_ROOT_ID = 'library-confirm-root';

function ensureToastRoot() {
    let root = document.getElementById(TOAST_ROOT_ID);
    if (!root) {
        root = document.createElement('div');
        root.id = TOAST_ROOT_ID;
        root.className = 'toast-root';
        document.body.appendChild(root);
    }
    return root;
}

export function showToast(message, type = 'error') {
    const root = ensureToastRoot();
    const toast = document.createElement('div');
    toast.className = `app-toast ${type}`;
    toast.textContent = message || 'Đã xảy ra lỗi. Vui lòng thử lại.';
    root.appendChild(toast);

    window.setTimeout(() => {
        toast.classList.add('leaving');
        window.setTimeout(() => toast.remove(), 220);
    }, 3200);
}

export function showSuccess(message) {
    showToast(message, 'success');
}

export function showError(message) {
    showToast(message, 'error');
}

export function confirmAction(message, options = {}) {
    return new Promise(resolve => {
        let root = document.getElementById(CONFIRM_ROOT_ID);
        if (!root) {
            root = document.createElement('div');
            root.id = CONFIRM_ROOT_ID;
            document.body.appendChild(root);
        }

        root.innerHTML = '';
        root.className = 'confirm-root active';

        const dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';
        dialog.innerHTML = `
            <h3>${options.title || 'Xác nhận thao tác'}</h3>
            <p></p>
            <div class="confirm-actions">
                <button type="button" class="btn btn-ghost" data-confirm="cancel">${options.cancelText || 'Hủy'}</button>
                <button type="button" class="btn btn-primary" data-confirm="ok">${options.confirmText || 'Đồng ý'}</button>
            </div>
        `;
        dialog.querySelector('p').textContent = message;

        function close(value) {
            root.classList.remove('active');
            root.innerHTML = '';
            resolve(value);
        }

        dialog.querySelector('[data-confirm="cancel"]').addEventListener('click', () => close(false));
        dialog.querySelector('[data-confirm="ok"]').addEventListener('click', () => close(true));
        root.addEventListener('click', event => {
            if (event.target === root) close(false);
        }, { once: true });

        root.appendChild(dialog);
    });
}
