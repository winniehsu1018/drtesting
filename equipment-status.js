function showEquipmentTab(query) {
    document.getElementById('reportTabPanel').hidden = query;
    document.getElementById('equipmentQueryPanel').hidden = !query;
    document.getElementById('reportTab').setAttribute('aria-selected', String(!query));
    document.getElementById('equipmentTab').setAttribute('aria-selected', String(query));
    document.getElementById('reportTab').tabIndex = query ? -1 : 0;
    document.getElementById('equipmentTab').tabIndex = query ? 0 : -1;
    document.querySelector('.container').classList.toggle('equipment-query-open', query);
    if (query && !document.getElementById('equipmentDate').value) {
        document.getElementById('equipmentDate').value = document.getElementById('date').value;
        document.getElementById('equipmentShift').value = document.getElementById('shift').value || '白班';
        document.getElementById('equipmentHours').value = document.getElementById('workingHours').value === '630' ? '630' : '510';
        updateEquipmentShift();
    }
    if (query) {
        const list = document.getElementById('equipmentMachines');
        list.replaceChildren();
        allMachines.forEach(machine => {
            const option = document.createElement('option'); option.value = machine; list.appendChild(option);
        });
    }
}

function updateEquipmentShift() {
    document.getElementById('equipmentHoursLabel').hidden = document.getElementById('equipmentShift').value !== '中班';
}

async function loadEquipmentStatus(event) {
    event.preventDefault();
    const output = document.getElementById('equipmentStatusResult');
    const button = document.getElementById('equipmentQueryButton');
    button.disabled = true;
    output.textContent = '讀取中…';
    try {
        const shift = document.getElementById('equipmentShift').value;
        const params = new URLSearchParams({action:'getEquipmentWorktimeStatus', loginToken:lightLoginToken,
            date:document.getElementById('equipmentDate').value.trim(), shift,
            workingHours:shift === '白班' ? '540' : document.getElementById('equipmentHours').value,
            machine:document.getElementById('equipmentMachine').value.trim()});
        const result = await (await fetch(GAS_WEB_APP_URL + '?' + params)).json();
        if (!result.success) throw new Error(result.needLogin ? '登入已失效，請重新登入。' : result.error || result.message || '無法取得狀態。');
        output.replaceChildren();
        const table = document.createElement('table');
        table.className = 'equipment-status-table';
        const columns = document.createElement('colgroup');
        [11,6,15,6,6,10,10,8,9,19].forEach(width => {
            const col = document.createElement('col'); col.style.width = width + '%'; columns.appendChild(col);
        });
        table.appendChild(columns);
        const header = table.createTHead().insertRow();
        ['日期','班別','機台','應有','涵蓋','加工區間內','加工區間外','已交代','尚待交代','狀態'].forEach(text => {
            const th = document.createElement('th'); th.textContent = text; th.scope = 'col'; header.appendChild(th);
        });
        const body = table.createTBody();
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
    finally { button.disabled = false; }
}

document.getElementById('reportTab').addEventListener('click', () => showEquipmentTab(false));
document.getElementById('equipmentTab').addEventListener('click', () => showEquipmentTab(true));
document.getElementById('equipmentShift').addEventListener('change', updateEquipmentShift);
document.getElementById('equipmentQueryForm').addEventListener('submit', loadEquipmentStatus);
document.querySelector('[role="tablist"]').addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const query = event.target.id !== 'equipmentTab';
    showEquipmentTab(query);
    document.getElementById(query ? 'equipmentTab' : 'reportTab').focus();
});
