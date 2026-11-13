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
        closeEquipmentMachines();
        alignEquipmentRows();
    }
}

function equipmentMachineKey(value) {
    return String(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function compareEquipmentMachines(a, b) {
    const bottom = ['ARC0501','PCLA20001','RT11','RT12','RT22','SL13YB25N'];
    const rank = value => {
        const key = equipmentMachineKey(value), index = bottom.indexOf(key);
        return index >= 0 ? 3 + index : key.startsWith('YCL32') ? 0 : key.startsWith('YCL20') ? 1 : 2;
    };
    return rank(a) - rank(b) || equipmentMachineKey(a).localeCompare(equipmentMachineKey(b), 'en', {numeric:true});
}

function closeEquipmentMachines() {
    document.getElementById('equipmentMachineOptions').hidden = true;
    const input = document.getElementById('equipmentMachine');
    input.setAttribute('aria-expanded','false');
    input.removeAttribute('aria-activedescendant');
}

function chooseEquipmentMachine(machine) {
    document.getElementById('equipmentMachine').value = machine;
    closeEquipmentMachines();
}

let equipmentMachineOptionIndex = -1;
function renderEquipmentMachines() {
    const input = document.getElementById('equipmentMachine');
    const list = document.getElementById('equipmentMachineOptions');
    const query = equipmentMachineKey(input.value.trim());
    const machines = [...allMachines].sort(compareEquipmentMachines).filter(machine => equipmentMachineKey(machine).includes(query));
    list.replaceChildren();
    equipmentMachineOptionIndex = -1;
    ['', ...machines].forEach((machine,index) => {
        const option = document.createElement('button');
        option.type = 'button'; option.className = 'equipment-machine-option';
        option.id = 'equipmentMachineOption-' + index;
        option.setAttribute('role','option'); option.setAttribute('aria-selected','false'); option.tabIndex = -1;
        option.textContent = machine || '全部機台';
        option.addEventListener('click', () => chooseEquipmentMachine(machine));
        list.appendChild(option);
    });
    if (!machines.length) {
        const message = document.createElement('p'); message.textContent = '沒有符合的機台'; list.appendChild(message);
    }
    list.hidden = false;
    input.setAttribute('aria-expanded','true'); input.removeAttribute('aria-activedescendant');
}

function equipmentMachineFilter() {
    const value = document.getElementById('equipmentMachine').value.trim();
    if (!value) return '';
    const machine = allMachines.find(machine => equipmentMachineKey(machine) === equipmentMachineKey(value));
    if (machine) return machine;
    renderEquipmentMachines();
    throw new Error('請從搜尋結果選擇機台，或選擇全部機台。');
}

function alignEquipmentRows() {
    const rows = [...document.querySelectorAll('#equipmentStatusResult tbody tr')];
    rows.forEach(row => row.style.height = '');
    const height = Math.ceil(Math.max(52, ...rows.map(row => row.getBoundingClientRect().height)));
    rows.forEach(row => row.style.height = height + 'px');
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
            machine:equipmentMachineFilter()});
        const result = await (await fetch(GAS_WEB_APP_URL + '?' + params)).json();
        if (!result.success) throw new Error(result.needLogin ? '登入已失效，請重新登入。' : result.error || result.message || '無法取得狀態。');
        output.replaceChildren();
        const table = document.createElement('table');
        table.className = 'equipment-status-table';
        const columns = document.createElement('colgroup');
        [105,60,115,165,160,105,105,95,105,105,65,65,65,65,65,65,180].forEach(width => {
            const col = document.createElement('col'); col.style.width = width + 'px'; columns.appendChild(col);
        });
        table.appendChild(columns);
        const header = table.createTHead().insertRow();
        ['日期','班別','機台','產品料號','生產批次號','完成數量（pcs）','單件工時（秒／件）','應有工時（分鐘）','已回報工時（分鐘）','未回報工時（分鐘）','架機','調機','換刀','待料','換批','其他','備註'].forEach(text => {
            const th = document.createElement('th'); th.textContent = text; th.scope = 'col'; header.appendChild(th);
        });
        const body = table.createTBody();
        [...result.machines].sort((a,b) => a.date.localeCompare(b.date) ||
            (['白班','中班'].indexOf(a.shift) - ['白班','中班'].indexOf(b.shift)) ||
            compareEquipmentMachines(a.machine,b.machine)).forEach(machine => {
            (machine.records.length ? machine.records : [null]).forEach(record => {
                const row = body.insertRow();
                [machine.date,machine.shift,machine.machine,record?.part || '—',record?.batchNo || '—',
                    record ? record.quantity : 0,record ? record.unitSeconds : 0,record ? machine.hours : 0,
                    record ? record.reported : 0,record ? machine.unreported : 0,
                    ...['架機','調機','換刀','待料','換批','其他'].map(type => record ? record.losses[type] : 0),record?.remark || '—'].forEach((value,index) => {
                    const cell = row.insertCell(); cell.textContent = value === null || value === undefined || value === '' ? '—' : value;
                    if (index === 9 && record && machine.hasValidReport && machine.unreported > 0) cell.classList.add('equipment-unreported-gap');
                });
            });
        });
        output.appendChild(table);
        alignEquipmentRows();
        if (!result.machines.length) output.textContent = '當月所選條件尚無回報紀錄。';
    } catch (error) { output.textContent = error.message; }
    finally { button.disabled = false; }
}

document.getElementById('reportTab').addEventListener('click', () => showEquipmentTab(false));
document.getElementById('equipmentTab').addEventListener('click', () => showEquipmentTab(true));
document.getElementById('equipmentShift').addEventListener('change', updateEquipmentShift);
document.getElementById('equipmentRange').addEventListener('change', updateEquipmentMonth);
document.getElementById('equipmentQueryForm').addEventListener('submit', loadEquipmentStatus);
document.getElementById('equipmentMachine').addEventListener('focus', renderEquipmentMachines);
document.getElementById('equipmentMachine').addEventListener('click', renderEquipmentMachines);
document.getElementById('equipmentMachine').addEventListener('input', renderEquipmentMachines);
document.getElementById('equipmentMachineClear').addEventListener('click', () => {
    document.getElementById('equipmentMachine').value = '';
    document.getElementById('equipmentMachine').focus();
    renderEquipmentMachines();
});
document.addEventListener('pointerdown', event => {
    if (!document.getElementById('equipmentMachinePicker').contains(event.target)) closeEquipmentMachines();
});
document.getElementById('equipmentMachine').addEventListener('keydown', event => {
    const list = document.getElementById('equipmentMachineOptions');
    if (event.key === 'Escape') { event.preventDefault(); closeEquipmentMachines(); return; }
    if (['ArrowDown','ArrowUp'].includes(event.key)) {
        event.preventDefault();
        if (list.hidden) renderEquipmentMachines();
        const options = [...list.querySelectorAll('button')];
        equipmentMachineOptionIndex = (equipmentMachineOptionIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        options.forEach((option,index) => option.setAttribute('aria-selected',String(index === equipmentMachineOptionIndex)));
        const option = options[equipmentMachineOptionIndex];
        event.target.setAttribute('aria-activedescendant',option.id); option.scrollIntoView({block:'nearest'});
    } else if (event.key === 'Enter' && !list.hidden) {
        event.preventDefault();
        const option = list.querySelectorAll('button')[equipmentMachineOptionIndex];
        if (option) option.click();
    }
});
document.querySelector('[role="tablist"]').addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const query = event.target.id !== 'equipmentTab';
    showEquipmentTab(query);
    document.getElementById(query ? 'equipmentTab' : 'reportTab').focus();
});
