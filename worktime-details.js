function configureWorktimeInputs() {
    document.querySelectorAll('.invalid-box').forEach(box => {
        const select = box.querySelector('.invalidType');
        const total = box.querySelector('.invalidMin');
        const split = ['調機', '待料', '其他'].includes(select.value);
        let panel = box.querySelector('.lossSplit');
        if (!panel) {
            panel = document.createElement('div');
            panel.className = 'lossSplit';
            panel.innerHTML = '<label>歸屬 <select class="lossPlacement"><option value="">請選擇加工區間內／加工區間外</option><option value="inside">加工區間內</option><option value="outside">加工區間外</option><option value="both">兩者都有（分別填寫）</option></select></label><label class="lossInside">加工區間內分鐘 <input class="invalidInside" type="number" min="0" step="1" placeholder="0"></label><label class="lossOutside">加工區間外分鐘 <input class="invalidOutside" type="number" min="0" step="1" placeholder="0"></label>';
            total.parentElement.appendChild(panel);
        }
        if (box.dataset.lossType !== select.value) {
            panel.querySelectorAll('input').forEach(input => input.value = '');
            panel.querySelector('.lossPlacement').value = '';
            box.dataset.lossType = select.value;
            if (split) total.value = '';
        }
        panel.hidden = !split;
        total.style.display = split ? 'none' : '';
        const placement = panel.querySelector('.lossPlacement').value;
        const showInside = placement === 'inside' || placement === 'both';
        const showOutside = placement === 'outside' || placement === 'both';
        panel.querySelector('.lossInside').hidden = !showInside;
        panel.querySelector('.lossOutside').hidden = !showOutside;
        if (panel.dataset.placement !== placement) {
            if (!showInside) panel.querySelector('.invalidInside').value = '';
            if (!showOutside) panel.querySelector('.invalidOutside').value = '';
            panel.dataset.placement = placement;
        }
        panel.querySelectorAll('input, select').forEach(input => input.disabled = select.disabled);
        if (split) total.value = (showInside ? Number(panel.querySelector('.invalidInside').value || 0) : 0) +
            (showOutside ? Number(panel.querySelector('.invalidOutside').value || 0) : 0);
    });
}

function worktimeSplitForBox(box) {
    const type = box.querySelector('.invalidType').value;
    const min = Number(box.querySelector('.invalidMin').value || 0);
    const split = ['調機', '待料', '其他'].includes(type);
    const placement = split ? box.querySelector('.lossPlacement').value : '';
    if (split && min > 0 && !['inside', 'outside', 'both'].includes(placement)) throw new Error('請選擇工時歸屬。');
    let inside = type === '架機' ? 0 : min;
    let outside = type === '架機' ? min : 0;
    if (split) {
        inside = ['inside', 'both'].includes(placement) ? Number(box.querySelector('.invalidInside').value || 0) : 0;
        outside = ['outside', 'both'].includes(placement) ? Number(box.querySelector('.invalidOutside').value || 0) : 0;
    }
    if (![inside, outside].every(value => Number.isSafeInteger(value) && value >= 0)) {
        throw new Error('分鐘數必須為非負整數。');
    }
    return { type, min, inside, outside };
}

function insideWorktimeMinutes(item) {
    if (['調機', '待料', '其他'].includes(item.type)) return Number(item.inside || 0);
    return item.type === '架機' ? 0 : Number(item.min || 0);
}

async function loadEquipmentStatus() {
    const output = document.getElementById('equipmentStatusResult');
    output.textContent = '讀取中…';
    try {
        const params = new URLSearchParams({
            action: 'getEquipmentWorktimeStatus', loginToken: lightLoginToken,
            date: document.getElementById('date').value, shift: document.getElementById('shift').value,
            workingHours: document.getElementById('workingHours').value
        });
        const result = await (await fetch(GAS_WEB_APP_URL + '?' + params)).json();
        if (!result.success) throw new Error(result.needLogin ? '請先登入。' : result.error || '無法取得狀態。');
        output.replaceChildren();
        const table = document.createElement('table');
        table.className = 'equipment-status-table';
        const columns = document.createElement('colgroup');
        [11,6,15,6,6,10,10,8,9,19].forEach(width => {
            const col = document.createElement('col'); col.style.width = width + '%'; columns.appendChild(col);
        });
        table.appendChild(columns);
        const head = table.createTHead();
        const body = table.createTBody();
        const header = head.insertRow();
        ['日期','班別','機台','應有','涵蓋','加工區間內','加工區間外','已交代','尚待交代','狀態'].forEach(text => {
            const th = document.createElement('th'); th.textContent = text; th.scope = 'col'; header.appendChild(th);
        });
        result.machines.forEach(machine => {
            const row = body.insertRow();
            row.style.background = {green:'#e4f4e5',yellow:'#fff3cd',red:'#f9d6d5',gray:'#eceff1'}[machine.color];
            [machine.date,machine.shift,machine.machine,machine.hours,machine.covered,machine.inside,
                machine.outside,machine.accounted,machine.remaining,machine.status].forEach(value => {
                const cell = row.insertCell(); cell.textContent = value === null ? '待確認' : value;
            });

        });
        output.appendChild(table);
    } catch (error) { output.textContent = error.message; }
}

window.addEventListener('DOMContentLoaded', () => {
    const section = document.createElement('section');
    section.style.cssText = 'margin:16px auto;max-width:1100px;padding:12px';
    section.innerHTML = '<h2>機台工時回報狀態</h2><p>使用上方工作日期與班別查詢。加工區間外只有分鐘而沒有實際時段時，已交代數僅供核對，仍標示待確認。</p><button type="button" id="equipmentStatusButton">查詢機台工時回報狀態</button><div id="equipmentStatusResult" style="overflow-x:auto" aria-live="polite"></div>';
    document.body.appendChild(section);
    document.getElementById('equipmentStatusButton').addEventListener('click', loadEquipmentStatus);
    configureWorktimeInputs();
});
