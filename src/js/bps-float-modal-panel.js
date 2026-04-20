/**
 * 첨부 목록·이미지 미리보기 오버레이의 패널을 헤더 드래그로 이동·가장자리·모서리에서 크기 조절.
 * shell.remove() 시 document 리스너 정리.
 *
 * @param {HTMLElement} shell - .file-list-modal 또는 .image-modal
 * @param {HTMLElement} panel - .file-list-modal-content 또는 .image-modal-content
 * @param {{ minWidth?: number, minHeight?: number, useExplicitHeight?: boolean }} [opts]
 */
export function initBpsFloatModalPanel(shell, panel, opts) {
    if (!shell || !panel) return;
    opts = opts || {};
    var minW = opts.minWidth != null ? opts.minWidth : 300;
    var minH = opts.minHeight != null ? opts.minHeight : 160;
    var useExplicitHeight = opts.useExplicitHeight === true;

    if (typeof shell._bpsFloatCleanup === 'function') {
        try {
            shell._bpsFloatCleanup();
        } catch (_e) {
            /* ignore */
        }
    }

    var oldFrame = panel.querySelector('.bps-resize-frame');
    if (oldFrame) oldFrame.remove();

    panel.classList.add('bps-float-modal-panel');

    var frame = document.createElement('div');
    frame.className = 'bps-resize-frame';
    frame.setAttribute('aria-hidden', 'true');
    var dirs = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    for (var di = 0; di < dirs.length; di++) {
        var h = document.createElement('div');
        h.className = 'bps-resize-handle bps-resize--' + dirs[di];
        h.setAttribute('data-bps-dir', dirs[di]);
        h.title = '크기 조절';
        frame.appendChild(h);
    }
    panel.appendChild(frame);

    var dragHandle =
        panel.querySelector('.file-list-modal-header') || panel.querySelector('.image-modal-header');
    if (!dragHandle) return;

    var dragging = false;
    var dragStartX = 0;
    var dragStartY = 0;
    var dragStartLeft = 0;
    var dragStartTop = 0;
    var resizing = false;
    var resizeMode = '';
    var resizeStartX = 0;
    var resizeStartY = 0;
    var rsLeft = 0;
    var rsTop = 0;
    var rsW = 0;
    var rsH = 0;

    function snapPanelFromCenteredFlex() {
        var r = panel.getBoundingClientRect();
        panel.style.position = 'fixed';
        panel.style.margin = '0';
        panel.style.left = r.left + 'px';
        panel.style.top = r.top + 'px';
        panel.style.transform = 'none';
        panel.style.boxSizing = 'border-box';
        var w = Math.max(minW, Math.min(r.width, window.innerWidth - 8));
        panel.style.width = w + 'px';
        if (useExplicitHeight) {
            var h = Math.max(minH, Math.min(r.height, window.innerHeight - 8));
            panel.style.height = h + 'px';
            panel.style.maxHeight = '';
        } else {
            var mh = Math.max(minH, Math.min(r.height, window.innerHeight * 0.92));
            panel.style.maxHeight = mh + 'px';
            panel.style.height = '';
        }
    }

    requestAnimationFrame(function () {
        requestAnimationFrame(snapPanelFromCenteredFlex);
    });

    function applyPanelBox(l, t, w, h) {
        panel.style.left = l + 'px';
        panel.style.top = t + 'px';
        panel.style.width = w + 'px';
        if (useExplicitHeight) {
            panel.style.height = h + 'px';
        } else {
            panel.style.maxHeight = h + 'px';
            panel.style.height = h + 'px';
        }
    }

    function applyResizeDelta(dx, dy) {
        var l = rsLeft;
        var t = rsTop;
        var w = rsW;
        var h = rsH;
        var m = resizeMode;
        if (/e/.test(m)) w = rsW + dx;
        if (/w/.test(m)) {
            w = rsW - dx;
            l = rsLeft + dx;
        }
        if (/s/.test(m)) h = rsH + dy;
        if (/n/.test(m)) {
            h = rsH - dy;
            t = rsTop + dy;
        }
        w = Math.max(minW, w);
        h = Math.max(minH, h);
        if (/w/.test(m)) l = rsLeft + rsW - w;
        if (/n/.test(m)) t = rsTop + rsH - h;
        l = Math.max(0, l);
        t = Math.max(0, t);
        w = Math.min(w, window.innerWidth - l);
        h = Math.min(h, window.innerHeight - t);
        if (w < minW) {
            w = minW;
            if (/w/.test(m)) l = rsLeft + rsW - minW;
            l = Math.max(0, l);
        }
        if (h < minH) {
            h = minH;
            if (/n/.test(m)) t = rsTop + rsH - minH;
            t = Math.max(0, t);
        }
        applyPanelBox(l, t, w, h);
    }

    function cleanup() {
        if (typeof shell._bpsFloatCleanup !== 'function') return;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onUp);
        shell._bpsFloatCleanup = null;
    }

    function onMouseMove(e) {
        if (!shell.parentNode) {
            cleanup();
            return;
        }
        if (dragging) {
            var r = panel.getBoundingClientRect();
            var nl = dragStartLeft + (e.clientX - dragStartX);
            var nt = dragStartTop + (e.clientY - dragStartY);
            nl = Math.max(0, Math.min(nl, window.innerWidth - r.width));
            nt = Math.max(0, Math.min(nt, window.innerHeight - r.height));
            panel.style.left = nl + 'px';
            panel.style.top = nt + 'px';
        } else if (resizing) {
            applyResizeDelta(e.clientX - resizeStartX, e.clientY - resizeStartY);
        }
    }

    function onUp() {
        dragging = false;
        resizing = false;
        resizeMode = '';
    }

    shell._bpsFloatCleanup = cleanup;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onUp);

    dragHandle.addEventListener('mousedown', function (e) {
        if (e.target.closest('button')) return;
        if (e.target.closest('.bps-resize-frame')) return;
        dragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        var r = panel.getBoundingClientRect();
        dragStartLeft = r.left;
        dragStartTop = r.top;
        e.preventDefault();
    });

    frame.addEventListener('mousedown', function (e) {
        var t = e.target;
        var dir = t && t.getAttribute && t.getAttribute('data-bps-dir');
        if (!dir) return;
        resizing = true;
        resizeMode = dir;
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;
        var r = panel.getBoundingClientRect();
        rsLeft = r.left;
        rsTop = r.top;
        rsW = r.width;
        rsH = r.height;
        e.preventDefault();
        e.stopPropagation();
    });

    var origRemove = shell.remove.bind(shell);
    shell.remove = function () {
        cleanup();
        origRemove();
    };
}
