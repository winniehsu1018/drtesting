function configureWorktimeInputs() {
    document.querySelectorAll('.invalid-box').forEach(box => {
        const select = box.querySelector('.invalidType');
        const total = box.querySelector('.invalidMin');
        const split = ['調機', '待料', '其他'].includes(select.value);
        let panel = box.querySelector('.lossSplit');
        if (!panel) {
            panel = document.createElement('div');
            panel.className = 'lossSplit';
            panel.innerHTML = '<label>歸屬 <select class="lossPlacement"><option value="">請選擇製程中或非製程中</option><option value="inside">製程中</option><option value="outside">非製程中</option><option value="both">兩者都有（分別填寫）</option></select></label><label class="lossInside">製程中分鐘 <input class="invalidInside" type="number" min="0" step="1" placeholder="0"></label><label class="lossOutside">非製程中分鐘 <input class="invalidOutside" type="number" min="0" step="1" placeholder="0"></label>';
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

let supplementRequestId = null;
let supplementTarget = null;
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
        table.style.cssText = 'border-collapse:collapse;width:100%;font-size:13px';
        const header = table.insertRow();
        ['日期','班別','機台','應有','涵蓋','區間內','區間外','已交代','尚待交代','狀態','補登'].forEach(text => {
            const th = document.createElement('th'); th.textContent = text; header.appendChild(th);
        });
        result.machines.forEach(machine => {
            const row = table.insertRow();
            row.style.background = {green:'#e4f4e5',yellow:'#fff3cd',red:'#f9d6d5',gray:'#eceff1'}[machine.color];
            [machine.date,machine.shift,machine.machine,machine.hours,machine.covered,machine.inside,
                machine.outside,machine.accounted,machine.remaining,machine.status].forEach(value => {
                const cell = row.insertCell(); cell.textContent = value === null ? '待確認' : value;
            });
            const cell = row.insertCell();
            machine.reports.forEach(report => {
                const button = document.createElement('button');
                button.type = 'button'; button.textContent = report.start + '～' + report.end + ' 補登';
                button.addEventListener('click', () => {
                    supplementTarget = { ...report, date: machine.date, machine: machine.machine };
                    supplementRequestId = null;
                    document.getElementById('worktimeSupplement').reset();
                    document.getElementById('supplementTarget').textContent = machine.machine + ' ' + report.start + '～' + report.end;
                    document.getElementById('worktimeSupplement').hidden = false;
                });
                cell.appendChild(button);
            });
        });
        output.appendChild(table);
    } catch (error) { output.textContent = error.message; }
}

async function submitWorktimeSupplement(event) {
    event.preventDefault();
    const button = document.getElementById('sendSupplement');
    try {
        configureWorktimeInputs();
        if (!supplementTarget) throw new Error('請先從狀態表選擇新版日報。');
        const items = [...document.querySelectorAll('#supplementLosses .invalid-box')]
            .map(worktimeSplitForBox).filter(item => item.min > 0);
        if (!items.length) throw new Error('請填寫補登分鐘。');
        if (!supplementRequestId) supplementRequestId = generateRequestId();
        button.disabled = true;
        const result = await (await fetch(GAS_WEB_APP_URL, {
            method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
            body:JSON.stringify({action:'supplementWorktime',requestId:supplementRequestId,
                targetRequestId:supplementTarget.requestId,date:supplementTarget.date,
                loginToken:lightLoginToken,invalidItems:items,
                remark:document.getElementById('supplementRemark').value})
        })).json();
        if (!result.success) throw new Error(result.message || '補登失敗，請保留識別碼後重試。');
        alert(result.message);
        supplementRequestId = null;
        document.getElementById('worktimeSupplement').hidden = true;
        loadEquipmentStatus();
    } catch (error) { alert(error.message); }
    finally { button.disabled = false; }
}

window.addEventListener('DOMContentLoaded', () => {
    const section = document.createElement('section');
    section.style.cssText = 'margin:16px auto;max-width:1100px;padding:12px';
    section.innerHTML = '<h2>機台工時回報狀態</h2><p>使用上方工作日期與班別查詢。區間外只有分鐘而沒有實際時段時，已交代數僅供核對，仍標示待確認。</p><button type="button" id="equipmentStatusButton">查詢機台工時回報狀態</button><div id="equipmentStatusResult" style="overflow-x:auto" aria-live="polite"></div><form id="worktimeSupplement" hidden><h3>純無效工時補登</h3><p id="supplementTarget"></p><p>只新增無效工時明細，不增加完成數量、標準工時、清潔或點檢。</p><div id="supplementLosses"><div class="invalid-box"><select class="invalidType" aria-label="補登項目"><option value="">無</option><option value="其他">其他（請選製程中或非製程中）</option><option value="調機">調機（請選製程中或非製程中）</option><option value="待料">待料（請選製程中或非製程中）</option><option value="換刀">換刀（製程中）</option><option value="換批">換批（製程中）</option><option value="架機">架機（非製程中）</option></select><input class="invalidMin" type="number" min="0" step="1" placeholder="分鐘"></div></div><label>補登備註 <input id="supplementRemark" maxlength="500"></label><button type="submit" id="sendSupplement">新增補登</button></form>';
    document.body.appendChild(section);
    document.getElementById('equipmentStatusButton').addEventListener('click', loadEquipmentStatus);
    document.getElementById('worktimeSupplement').addEventListener('submit', submitWorktimeSupplement);
    document.getElementById('supplementLosses').addEventListener('change', configureWorktimeInputs);
    document.getElementById('supplementLosses').addEventListener('input', configureWorktimeInputs);
    configureWorktimeInputs();
});
