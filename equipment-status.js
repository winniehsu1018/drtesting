function showEquipmentTab(query) {
    document.getElementById('reportTabPanel').hidden = query;
    document.getElementById('equipmentQueryPanel').hidden = !query;
    document.getElementById('reportTab').setAttribute('aria-selected', String(!query));
    document.getElementById('equipmentTab').setAttribute('aria-selected', String(query));
    document.getElementById('reportTab').tabIndex = query ? -1 : 0;
    document.getElementById('equipmentTab').tabIndex = query ? 0 : -1;
    document.querySelector('.container').classList.toggle('equipment-query-open', query);
    if (query && !document.getElementById('equipmentDate').value) {
        document.getElementById('equipmentShift').value = document.getElementById('shift').value || '白班';
        document.getElementById('equipmentHours').value = document.getElementById('workingHours').value === '630' ? '630' : '510';
        updateEquipmentShift();
    }
    if (query) {
        updateEquipmentMonth();
        const list = document.getElementById('equipmentMachines');
        list.replaceChildren();
        allMachines.forEach(machine => {
            const option = document.createElement('option'); option.value = machine; list.appendChild(option);
        });
    }
}

function updateEquipmentMonth() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'})
        .formatToParts(new Date()).map(part => [part.type,part.value]));
    const month = parts.year + '-' + parts.month;
    const today = month + '-' + parts.day;
    const input = document.getElementById('equipmentDate');
    input.min = month + '-01';
    input.max = new Date(Date.UTC(Number(parts.year),Number(parts.month),0)).toISOString().slice(0,10);
    if (!input.value || input.value.slice(0,7) !== month) input.value = today;
    input.disabled = document.querySelector('#equipmentRange input:checked').value === 'month';
    document.getElementById('equipmentDateLabel').hidden = input.disabled;
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
        updateEquipmentMonth();
        const shift = document.getElementById('equipmentShift').value;
        const range = document.querySelector('#equipmentRange input:checked').value;
        const params = new URLSearchParams({action:'getEquipmentWorktimeStatus', loginToken:lightLoginToken,
            range, date:range === 'month' ? '' : document.getElementById('equipmentDate').value, shift,
            workingHours:shift === '白班' ? '540' : document.getElementById('equipmentHours').value,
            machine:document.getElementById('equipmentMachine').value.trim()});
        const result = await (await fetch(GAS_WEB_APP_URL + '?' + params)).json();
        if (!result.success) throw new Error(result.needLogin ? '登入已失效，請重新登入。' : result.error || result.message || '無法取得狀態。');
        output.replaceChildren();
        const table = document.createElement('table');
        table.className = 'equipment-status-table';
        const columns = document.createElement('colgroup');
        [7,4,9,6,7,7,4,4,4,4,4,4,4,4,10,18].forEach(width => {
            const col = document.createElement('col'); col.style.width = width + '%'; columns.appendChild(col);
        });
        table.appendChild(columns);
        const header = table.createTHead().insertRow();
        ['日期','班別','機台','應有工時','已回報工時','未回報工時','架機','調機','換刀','待料','換批','其他','清潔','點檢','狀態','備註'].forEach(text => {
            const th = document.createElement('th'); th.textContent = text; th.scope = 'col'; header.appendChild(th);
        });
        const body = table.createTBody();
        result.machines.forEach(machine => {
            const row = body.insertRow();
            row.style.background = {green:'#e4f4e5',yellow:'#fff3cd',red:'#f9d6d5',gray:'#eceff1'}[machine.color];
            [machine.date,machine.shift,machine.machine,machine.hours,machine.reported,machine.unreported,
                ...['架機','調機','換刀','待料','換批','其他','清潔','點檢'].map(type => machine.losses[type]),machine.status].forEach(value => {
                const cell = row.insertCell(); cell.textContent = value === null ? '待確認' : value;
            });
            const notes = row.insertCell();
            machine.notes.forEach((note,index) => {
                const line = document.createElement('p');
                line.textContent = (index + 1) + '. ' + (note.start ? note.start + '～' + note.end + ' ' : '') + (note.text || '（無備註）');
                notes.appendChild(line);
            });
        });
        output.appendChild(table);
        if (!result.machines.length) output.textContent = '當月所選條件尚無回報紀錄。';
    } catch (error) { output.textContent = error.message; }
    finally { button.disabled = false; }
}

document.getElementById('reportTab').addEventListener('click', () => showEquipmentTab(false));
document.getElementById('equipmentTab').addEventListener('click', () => showEquipmentTab(true));
document.getElementById('equipmentShift').addEventListener('change', updateEquipmentShift);
document.getElementById('equipmentRange').addEventListener('change', updateEquipmentMonth);
document.getElementById('equipmentQueryForm').addEventListener('submit', loadEquipmentStatus);
document.querySelector('[role="tablist"]').addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const query = event.target.id !== 'equipmentTab';
    showEquipmentTab(query);
    document.getElementById(query ? 'equipmentTab' : 'reportTab').focus();
});
