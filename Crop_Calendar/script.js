const STAGE_COLORS = {
    "p": { class: "planting", label: "Planting (Early/Late)" },
    "pp": { class: "prime-planting", label: "Prime Planting" },
    "v": { class: "growing", label: "Growing (Vegetative)" },
    "r": { class: "reproduction", label: "Reproduction (Critical)" },
    "ph": { class: "prime-harvesting", label: "Prime Harvesting" },
    "h": { class: "harvesting", label: "Harvesting (Early/Late)" }
};

const cropData = [
    // Soybeans
    { region: "USA", commodity: "Soybeans", subtitle: "Main", estSize: "113 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["",""], Apr: ["", "p"], May: ["p", "pp"], Jun: ["pp", "v"], Jul: ["v", "r"], Aug: ["r", "r"], Sep: ["r", "h"], Oct: ["ph", "ph"], Nov: ["h", ""], Dec: ["",""] } },
    { region: "Brazil", commodity: "Soybeans", subtitle: "Center-West", estSize: "78 MMT", stages: { Jan: ["ph","ph"], Feb: ["ph","h"], Mar: ["h",""], Apr: ["",""], May: ["",""], Jun: ["",""], Jul: ["",""], Aug: ["",""], Sep: ["","p"], Oct: ["pp","pp"], Nov: ["v","v"], Dec: ["r","r"] } },
    { region: "Brazil", commodity: "Soybeans", subtitle: "South (PR)", estSize: "25 MMT", stages: { Jan: ["r","ph"], Feb: ["ph","h"], Mar: ["h",""], Apr: ["",""], May: ["",""], Jun: ["",""], Jul: ["",""], Aug: ["",""], Sep: ["","p"], Oct: ["pp","pp"], Nov: ["v","v"], Dec: ["v","r"] } },
    { region: "Brazil", commodity: "Soybeans", subtitle: "Far South (RS)", estSize: "22 MMT", stages: { Jan: ["v","r"], Feb: ["r","r"], Mar: ["r","ph"], Apr: ["ph","ph"], May: ["h","h"], Jun: ["",""], Jul: ["",""], Aug: ["",""], Sep: ["",""], Oct: ["","p"], Nov: ["pp","pp"], Dec: ["v","v"] } },
    { region: "Brazil", commodity: "Soybeans", subtitle: "MATOPIBA", estSize: "20 MMT", stages: { Jan: ["v","r"], Feb: ["r","ph"], Mar: ["ph","h"], Apr: ["h",""], May: ["",""], Jun: ["",""], Jul: ["",""], Aug: ["",""], Sep: ["",""], Oct: ["","p"], Nov: ["pp","pp"], Dec: ["v","v"] } },
    { region: "Argentina", commodity: "Soybeans", subtitle: "1st Crop", estSize: "34 MMT", stages: { Jan: ["v","r"], Feb: ["r","r"], Mar: ["r","ph"], Apr: ["ph","ph"], May: ["h","h"], Jun: ["",""], Jul: ["",""], Aug: ["",""], Sep: ["",""], Oct: ["","p"], Nov: ["pp","pp"], Dec: ["v","v"] } },
    { region: "Argentina", commodity: "Soybeans", subtitle: "2nd Crop", estSize: "16 MMT", stages: { Jan: ["pp","v"], Feb: ["v","r"], Mar: ["r","r"], Apr: ["r","h"], May: ["ph","ph"], Jun: ["h",""], Jul: ["",""], Aug: ["",""], Sep: ["",""], Oct: ["",""], Nov: ["","p"], Dec: ["p","pp"] } },
    { region: "Paraguay", commodity: "Soybeans", subtitle: "Main", estSize: "10 MMT", stages: { Jan: ["r","ph"], Feb: ["ph","ph"], Mar: ["h",""], Apr: ["",""], May: ["",""], Jun: ["",""], Jul: ["",""], Aug: ["",""], Sep: ["p","pp"], Oct: ["pp","v"], Nov: ["v","r"], Dec: ["r","r"] } },
    { region: "Uruguay", commodity: "Soybeans", subtitle: "Main", estSize: "3 MMT", stages: { Jan: ["v","r"], Feb: ["r","r"], Mar: ["r","h"], Apr: ["ph","ph"], May: ["ph","h"], Jun: ["",""], Jul: ["",""], Aug: ["",""], Sep: ["",""], Oct: ["","p"], Nov: ["pp","pp"], Dec: ["v","v"] } },
    { region: "China", commodity: "Soybeans", subtitle: "Main", estSize: "20 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["",""], Apr: ["","p"], May: ["pp","pp"], Jun: ["v","v"], Jul: ["r","r"], Aug: ["r","h"], Sep: ["ph","ph"], Oct: ["h",""], Nov: ["",""], Dec: ["",""] } },
    { region: "India", commodity: "Soybeans", subtitle: "Kharif", estSize: "12 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["",""], Apr: ["",""], May: ["",""], Jun: ["","p"], Jul: ["pp","pp"], Aug: ["v","v"], Sep: ["r","r"], Oct: ["ph","ph"], Nov: ["h",""], Dec: ["",""] } },

    // Corn
    { region: "USA", commodity: "Corn", subtitle: "Main", estSize: "389 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["","p"], Apr: ["p","pp"], May: ["pp","v"], Jun: ["v","r"], Jul: ["r","r"], Aug: ["r","h"], Sep: ["h","ph"], Oct: ["ph","h"], Nov: ["h",""], Dec: ["",""] } },
    { region: "China", commodity: "Corn", subtitle: "Main", estSize: "288 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["","p"], Apr: ["pp","pp"], May: ["v","v"], Jun: ["r","r"], Jul: ["r","h"], Aug: ["ph","ph"], Sep: ["h",""], Oct: ["",""], Nov: ["",""], Dec: ["",""] } },
    { region: "Brazil", commodity: "Corn", subtitle: "Safrinha", estSize: "95 MMT", stages: { Jan: ["p","pp"], Feb: ["pp","pp"], Mar: ["v","v"], Apr: ["r","r"], May: ["r","h"], Jun: ["ph","ph"], Jul: ["ph","ph"], Aug: ["h","h"], Sep: ["",""], Oct: ["",""], Nov: ["",""], Dec: ["",""] } },
    { region: "Brazil", commodity: "Corn", subtitle: "Summer", estSize: "30 MMT", stages: { Jan: ["h","ph"], Feb: ["ph","h"], Mar: ["h",""], Apr: ["",""], May: ["",""], Jun: ["",""], Jul: ["",""], Aug: ["",""], Sep: ["p","pp"], Oct: ["pp","v"], Nov: ["v","r"], Dec: ["r","r"] } },
    { region: "Argentina", commodity: "Corn", subtitle: "Temprano", estSize: "25 MMT", stages: { Jan: ["r","r"], Feb: ["h","ph"], Mar: ["ph","h"], Apr: ["h",""], May: ["",""], Jun: ["",""], Jul: ["",""], Aug: ["",""], Sep: ["p","pp"], Oct: ["pp","v"], Nov: ["v","v"], Dec: ["v","r"] } },
    { region: "Argentina", commodity: "Corn", subtitle: "Tardío", estSize: "30 MMT", stages: { Jan: ["pp","v"], Feb: ["v","r"], Mar: ["r","r"], Apr: ["r","h"], May: ["h","ph"], Jun: ["ph","ph"], Jul: ["ph","h"], Aug: ["h",""], Sep: ["",""], Oct: ["",""], Nov: ["","p"], Dec: ["p","pp"] } },
    { region: "Ukraine", commodity: "Corn", subtitle: "Main", estSize: "27 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["",""], Apr: ["p","pp"], May: ["pp","v"], Jun: ["v","r"], Jul: ["r","r"], Aug: ["r","h"], Sep: ["ph","ph"], Oct: ["h","h"], Nov: ["h",""], Dec: ["",""] } },
    { region: "EU", commodity: "Corn", subtitle: "France", estSize: "13 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["","p"], Apr: ["pp","pp"], May: ["v","v"], Jun: ["r","r"], Jul: ["r","h"], Aug: ["ph","ph"], Sep: ["h",""], Oct: ["",""], Nov: ["",""], Dec: ["",""] } },
    { region: "EU", commodity: "Corn", subtitle: "Romania", estSize: "11 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["","p"], Apr: ["pp","pp"], May: ["v","v"], Jun: ["r","r"], Jul: ["r","h"], Aug: ["ph","ph"], Sep: ["h",""], Oct: ["",""], Nov: ["",""], Dec: ["",""] } },
    { region: "EU", commodity: "Corn", subtitle: "Poland", estSize: "7 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["",""], Apr: ["","p"], May: ["pp","pp"], Jun: ["v","v"], Jul: ["r","r"], Aug: ["r","h"], Sep: ["h","ph"], Oct: ["ph","h"], Nov: ["",""], Dec: ["",""] } },
    { region: "EU", commodity: "Corn", subtitle: "Hungary", estSize: "6 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["","p"], Apr: ["pp","pp"], May: ["v","v"], Jun: ["r","r"], Jul: ["r","h"], Aug: ["ph","ph"], Sep: ["h",""], Oct: ["",""], Nov: ["",""], Dec: ["",""] } },
    { region: "EU", commodity: "Corn", subtitle: "Other (Total: 60M)", estSize: "23 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["","p"], Apr: ["pp","pp"], May: ["v","v"], Jun: ["r","r"], Jul: ["r","h"], Aug: ["ph","ph"], Sep: ["h",""], Oct: ["",""], Nov: ["",""], Dec: ["",""] } },

    // Wheat
    { region: "EU", commodity: "Wheat", subtitle: "France", estSize: "35 MMT", stages: { Jan: ["v","v"], Feb: ["v","v"], Mar: ["v","v"], Apr: ["v","r"], May: ["r","r"], Jun: ["r","h"], Jul: ["ph","ph"], Aug: ["h",""], Sep: ["","p"], Oct: ["pp","pp"], Nov: ["p","v"], Dec: ["v","v"] } },
    { region: "EU", commodity: "Wheat", subtitle: "Germany", estSize: "22 MMT", stages: { Jan: ["v","v"], Feb: ["v","v"], Mar: ["v","v"], Apr: ["v","v"], May: ["v","r"], Jun: ["r","r"], Jul: ["h","ph"], Aug: ["ph","h"], Sep: ["","p"], Oct: ["pp","pp"], Nov: ["p","v"], Dec: ["v","v"] } },
    { region: "EU", commodity: "Wheat", subtitle: "Poland", estSize: "13 MMT", stages: { Jan: ["v","v"], Feb: ["v","v"], Mar: ["v","v"], Apr: ["v","v"], May: ["v","r"], Jun: ["r","r"], Jul: ["h","ph"], Aug: ["ph","h"], Sep: ["","p"], Oct: ["pp","pp"], Nov: ["p","v"], Dec: ["v","v"] } },
    { region: "EU", commodity: "Wheat", subtitle: "Romania", estSize: "10 MMT", stages: { Jan: ["v","v"], Feb: ["v","v"], Mar: ["v","v"], Apr: ["v","r"], May: ["r","r"], Jun: ["r","ph"], Jul: ["ph","h"], Aug: ["",""], Sep: ["","p"], Oct: ["pp","pp"], Nov: ["p","v"], Dec: ["v","v"] } },
    { region: "EU", commodity: "Wheat", subtitle: "Other (Total: 134M)", estSize: "54 MMT", stages: { Jan: ["v","v"], Feb: ["v","v"], Mar: ["v","v"], Apr: ["v","r"], May: ["r","r"], Jun: ["r","h"], Jul: ["ph","ph"], Aug: ["h","h"], Sep: ["","p"], Oct: ["pp","pp"], Nov: ["p","v"], Dec: ["v","v"] } },
    { region: "China", commodity: "Wheat", subtitle: "Winter", estSize: "136 MMT", stages: { Jan: ["v","v"], Feb: ["v","v"], Mar: ["v","r"], Apr: ["r","r"], May: ["h","ph"], Jun: ["ph","h"], Jul: ["",""], Aug: ["",""], Sep: ["","p"], Oct: ["pp","pp"], Nov: ["v","v"], Dec: ["v","v"] } },
    { region: "India", commodity: "Wheat", subtitle: "Rabi", estSize: "110 MMT", stages: { Jan: ["v","r"], Feb: ["r","r"], Mar: ["r","h"], Apr: ["ph","ph"], May: ["h",""], Jun: ["",""], Jul: ["",""], Aug: ["",""], Sep: ["",""], Oct: ["","p"], Nov: ["pp","pp"], Dec: ["v","v"] } },
    { region: "Russia", commodity: "Wheat", subtitle: "Winter", estSize: "67 MMT", stages: { Jan: ["v","v"], Feb: ["v","v"], Mar: ["v","v"], Apr: ["v","v"], May: ["v","r"], Jun: ["r","r"], Jul: ["h","ph"], Aug: ["ph","h"], Sep: ["pp","pp"], Oct: ["p","v"], Nov: ["v","v"], Dec: ["v","v"] } },
    { region: "Russia", commodity: "Wheat", subtitle: "Spring", estSize: "23 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["",""], Apr: ["",""], May: ["p","pp"], Jun: ["pp","v"], Jul: ["v","r"], Aug: ["r","h"], Sep: ["ph","ph"], Oct: ["h",""], Nov: ["",""], Dec: ["",""] } },
    { region: "USA", commodity: "Wheat", subtitle: "Winter", estSize: "35 MMT", stages: { Jan: ["v","v"], Feb: ["v","v"], Mar: ["v","v"], Apr: ["r","r"], May: ["r","h"], Jun: ["ph","ph"], Jul: ["ph","h"], Aug: ["h",""], Sep: ["p","pp"], Oct: ["pp","v"], Nov: ["v","v"], Dec: ["v","v"] } },
    { region: "USA", commodity: "Wheat", subtitle: "Spring", estSize: "14 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["",""], Apr: ["","p"], May: ["pp","pp"], Jun: ["v","v"], Jul: ["r","r"], Aug: ["r","h"], Sep: ["ph","h"], Oct: ["",""], Nov: ["",""], Dec: ["",""] } },
    { region: "Australia", commodity: "Wheat", subtitle: "Main", estSize: "26 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["",""], Apr: ["","p"], May: ["pp","pp"], Jun: ["v","v"], Jul: ["v","v"], Aug: ["v","r"], Sep: ["r","r"], Oct: ["h","ph"], Nov: ["ph","ph"], Dec: ["h",""] } },
    { region: "Canada", commodity: "Wheat", subtitle: "Spring", estSize: "32 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["",""], Apr: ["","p"], May: ["pp","pp"], Jun: ["v","v"], Jul: ["r","r"], Aug: ["r","h"], Sep: ["ph","ph"], Oct: ["h",""], Nov: ["",""], Dec: ["",""] } },
    { region: "Ukraine", commodity: "Wheat", subtitle: "Winter", estSize: "22 MMT", stages: { Jan: ["v","v"], Feb: ["v","v"], Mar: ["v","v"], Apr: ["v","v"], May: ["r","r"], Jun: ["r","h"], Jul: ["ph","ph"], Aug: ["h","h"], Sep: ["p","pp"], Oct: ["pp","v"], Nov: ["v","v"], Dec: ["v","v"] } },
    { region: "Argentina", commodity: "Wheat", subtitle: "Main", estSize: "15 MMT", stages: { Jan: ["h",""], Feb: ["",""], Mar: ["",""], Apr: ["",""], May: ["","p"], Jun: ["pp","pp"], Jul: ["p","v"], Aug: ["v","v"], Sep: ["v","r"], Oct: ["r","r"], Nov: ["h","ph"], Dec: ["ph","h"] } },
    
    // Rapeseed (Canola)
    { region: "Canada", commodity: "Rapeseed", subtitle: "Spring Canola", estSize: "18 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["",""], Apr: ["","p"], May: ["pp","pp"], Jun: ["v","r"], Jul: ["r","r"], Aug: ["r","h"], Sep: ["ph","ph"], Oct: ["h",""], Nov: ["",""], Dec: ["",""] } },
    { region: "EU", commodity: "Rapeseed", subtitle: "France", estSize: "4.5 MMT", stages: { Jan: ["v","v"], Feb: ["v","v"], Mar: ["v","v"], Apr: ["r","r"], May: ["r","h"], Jun: ["ph","ph"], Jul: ["h",""], Aug: ["","p"], Sep: ["pp","pp"], Oct: ["v","v"], Nov: ["v","v"], Dec: ["v","v"] } },
    { region: "EU", commodity: "Rapeseed", subtitle: "Germany", estSize: "4.2 MMT", stages: { Jan: ["v","v"], Feb: ["v","v"], Mar: ["v","v"], Apr: ["v","r"], May: ["r","r"], Jun: ["h","ph"], Jul: ["ph","h"], Aug: ["p","pp"], Sep: ["pp","v"], Oct: ["v","v"], Nov: ["v","v"], Dec: ["v","v"] } },
    { region: "EU", commodity: "Rapeseed", subtitle: "Poland", estSize: "3.7 MMT", stages: { Jan: ["v","v"], Feb: ["v","v"], Mar: ["v","v"], Apr: ["v","r"], May: ["r","r"], Jun: ["h","ph"], Jul: ["ph","h"], Aug: ["p","pp"], Sep: ["pp","v"], Oct: ["v","v"], Nov: ["v","v"], Dec: ["v","v"] } },
    { region: "EU", commodity: "Rapeseed", subtitle: "Other (Total: 20M)", estSize: "7.6 MMT", stages: { Jan: ["v","v"], Feb: ["v","v"], Mar: ["v","v"], Apr: ["r","r"], May: ["r","h"], Jun: ["ph","ph"], Jul: ["h","h"], Aug: ["p","pp"], Sep: ["pp","v"], Oct: ["v","v"], Nov: ["v","v"], Dec: ["v","v"] } },
    { region: "China", commodity: "Rapeseed", subtitle: "Winter", estSize: "15 MMT", stages: { Jan: ["v","v"], Feb: ["v","r"], Mar: ["r","r"], Apr: ["r","h"], May: ["ph","ph"], Jun: ["h",""], Jul: ["",""], Aug: ["",""], Sep: ["","p"], Oct: ["pp","pp"], Nov: ["v","v"], Dec: ["v","v"] } },
    { region: "India", commodity: "Rapeseed", subtitle: "Rabi", estSize: "12 MMT", stages: { Jan: ["r","r"], Feb: ["r","h"], Mar: ["ph","ph"], Apr: ["h",""], May: ["",""], Jun: ["",""], Jul: ["",""], Aug: ["",""], Sep: ["","p"], Oct: ["pp","pp"], Nov: ["v","v"], Dec: ["v","r"] } },
    { region: "Australia", commodity: "Rapeseed", subtitle: "Canola", estSize: "5 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["",""], Apr: ["p","pp"], May: ["pp","v"], Jun: ["v","v"], Jul: ["r","r"], Aug: ["r","r"], Sep: ["r","h"], Oct: ["ph","ph"], Nov: ["h","h"], Dec: ["",""] } },
    { region: "Ukraine", commodity: "Rapeseed", subtitle: "Winter", estSize: "4 MMT", stages: { Jan: ["v","v"], Feb: ["v","v"], Mar: ["v","v"], Apr: ["v","r"], May: ["r","r"], Jun: ["r","h"], Jul: ["ph","ph"], Aug: ["p","pp"], Sep: ["pp","v"], Oct: ["v","v"], Nov: ["v","v"], Dec: ["v","v"] } },

    // Sunflower
    { region: "Russia", commodity: "Sunflower", subtitle: "Main", estSize: "17 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["",""], Apr: ["","p"], May: ["pp","pp"], Jun: ["v","v"], Jul: ["r","r"], Aug: ["r","h"], Sep: ["ph","ph"], Oct: ["h",""], Nov: ["",""], Dec: ["",""] } },
    { region: "Ukraine", commodity: "Sunflower", subtitle: "Main", estSize: "14 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["",""], Apr: ["p","pp"], May: ["pp","v"], Jun: ["v","v"], Jul: ["r","r"], Aug: ["r","h"], Sep: ["ph","ph"], Oct: ["h",""], Nov: ["",""], Dec: ["",""] } },
    { region: "EU", commodity: "Sunflower", subtitle: "Romania", estSize: "3.0 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["",""], Apr: ["p","pp"], May: ["pp","v"], Jun: ["v","v"], Jul: ["r","r"], Aug: ["r","h"], Sep: ["ph","ph"], Oct: ["h",""], Nov: ["",""], Dec: ["",""] } },
    { region: "EU", commodity: "Sunflower", subtitle: "Bulgaria", estSize: "2.0 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["",""], Apr: ["p","pp"], May: ["pp","v"], Jun: ["v","v"], Jul: ["r","r"], Aug: ["r","h"], Sep: ["ph","ph"], Oct: ["h",""], Nov: ["",""], Dec: ["",""] } },
    { region: "EU", commodity: "Sunflower", subtitle: "France", estSize: "1.8 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["",""], Apr: ["","p"], May: ["pp","pp"], Jun: ["v","v"], Jul: ["r","r"], Aug: ["r","h"], Sep: ["ph","ph"], Oct: ["h",""], Nov: ["",""], Dec: ["",""] } },
    { region: "EU", commodity: "Sunflower", subtitle: "Hungary", estSize: "1.7 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["",""], Apr: ["p","pp"], May: ["pp","v"], Jun: ["v","v"], Jul: ["r","r"], Aug: ["r","h"], Sep: ["ph","ph"], Oct: ["h",""], Nov: ["",""], Dec: ["",""] } },
    { region: "EU", commodity: "Sunflower", subtitle: "Other (Total: 10M)", estSize: "1.5 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["",""], Apr: ["p","pp"], May: ["pp","v"], Jun: ["v","v"], Jul: ["r","r"], Aug: ["r","h"], Sep: ["ph","ph"], Oct: ["h",""], Nov: ["",""], Dec: ["",""] } },
    { region: "Argentina", commodity: "Sunflower", subtitle: "Main", estSize: "4 MMT", stages: { Jan: ["r","r"], Feb: ["r","h"], Mar: ["ph","ph"], Apr: ["h",""], May: ["",""], Jun: ["",""], Jul: ["",""], Aug: ["",""], Sep: ["",""], Oct: ["p","pp"], Nov: ["pp","v"], Dec: ["v","r"] } },
    { region: "China", commodity: "Sunflower", subtitle: "Main", estSize: "2 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["",""], Apr: ["","p"], May: ["pp","pp"], Jun: ["v","v"], Jul: ["r","r"], Aug: ["r","h"], Sep: ["ph","ph"], Oct: ["h",""], Nov: ["",""], Dec: ["",""] } },
    
    // Groundnut
    { region: "China", commodity: "Groundnut", subtitle: "Main", estSize: "18 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["",""], Apr: ["p","pp"], May: ["pp","v"], Jun: ["v","v"], Jul: ["r","r"], Aug: ["r","h"], Sep: ["ph","ph"], Oct: ["h",""], Nov: ["",""], Dec: ["",""] } },
    { region: "India", commodity: "Groundnut", subtitle: "Kharif", estSize: "6.5 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["",""], Apr: ["",""], May: ["",""], Jun: ["p","pp"], Jul: ["pp","v"], Aug: ["v","r"], Sep: ["r","r"], Oct: ["ph","ph"], Nov: ["h",""], Dec: ["",""] } },
    { region: "USA", commodity: "Groundnut", subtitle: "Main", estSize: "3.2 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["",""], Apr: ["","p"], May: ["pp","pp"], Jun: ["v","v"], Jul: ["r","r"], Aug: ["r","h"], Sep: ["ph","ph"], Oct: ["h",""], Nov: ["",""], Dec: ["",""] } },
    { region: "Argentina", commodity: "Groundnut", subtitle: "Main", estSize: "1.3 MMT", stages: { Jan: ["v","r"], Feb: ["r","r"], Mar: ["r","h"], Apr: ["ph","ph"], May: ["h",""], Jun: ["",""], Jul: ["",""], Aug: ["",""], Sep: ["",""], Oct: ["",""], Nov: ["p","pp"], Dec: ["pp","v"] } },

    // Cottonseed
    { region: "China", commodity: "Cottonseed", subtitle: "Main", estSize: "10 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["",""], Apr: ["p","pp"], May: ["pp","v"], Jun: ["v","v"], Jul: ["r","r"], Aug: ["r","r"], Sep: ["h","ph"], Oct: ["ph","h"], Nov: ["h",""], Dec: ["",""] } },
    { region: "India", commodity: "Cottonseed", subtitle: "Kharif", estSize: "11 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["",""], Apr: ["",""], May: ["","p"], Jun: ["pp","pp"], Jul: ["v","v"], Aug: ["v","r"], Sep: ["r","r"], Oct: ["h","ph"], Nov: ["ph","h"], Dec: ["h",""] } },
    { region: "USA", commodity: "Cottonseed", subtitle: "Main", estSize: "4 MMT", stages: { Jan: ["",""], Feb: ["",""], Mar: ["",""], Apr: ["p","pp"], May: ["pp","v"], Jun: ["v","v"], Jul: ["r","r"], Aug: ["r","r"], Sep: ["h","ph"], Oct: ["ph","ph"], Nov: ["h","h"], Dec: ["h",""] } },
    { region: "Brazil", commodity: "Cottonseed", subtitle: "Safrinha", estSize: "5 MMT", stages: { Jan: ["p","pp"], Feb: ["pp","pp"], Mar: ["v","v"], Apr: ["v","r"], May: ["r","r"], Jun: ["h","ph"], Jul: ["ph","ph"], Aug: ["h","h"], Sep: ["",""], Oct: ["",""], Nov: ["",""], Dec: ["",""] } }
];

const allMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function renderCalendar() {
    const selectedCommodities = Array.from(document.querySelectorAll('.filter-commodity'))
        .filter(cb => cb.checked).map(cb => cb.value);
        
    const selectedRegions = Array.from(document.querySelectorAll('.filter-region'))
        .filter(cb => cb.checked).map(cb => cb.value);

    const selectedMonths = Array.from(document.querySelectorAll('.filter-month'))
        .filter(cb => cb.checked).map(cb => cb.value);

    const thead = document.getElementById("calendar-head");
    const tbody = document.getElementById("calendar-body");
    
    // Rebuild thead based on selected months
    let headHtml = `
        <tr>
            <th rowspan="2" class="fixed-col" style="width: 90px;">Region</th>
            <th rowspan="2" class="fixed-col" style="width: 140px; left: 90px;">Commodity</th>
            <th rowspan="2" class="fixed-col" style="width: 80px; left: 230px;">Size</th>
    `;
    selectedMonths.forEach(m => {
        headHtml += `<th colspan="2">${m}</th>`;
    });
    headHtml += `</tr><tr class="sub-header">`;
    selectedMonths.forEach(m => {
        headHtml += `<th>1H</th><th>2H</th>`;
    });
    headHtml += `</tr>`;
    thead.innerHTML = headHtml;

    tbody.innerHTML = "";

    const filteredData = cropData.filter(d => 
        selectedCommodities.includes(d.commodity) && 
        selectedRegions.includes(d.region)
    );

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${3 + selectedMonths.length * 2}" style="text-align:center; padding: 20px;">No data matches your selection.</td></tr>`;
        return;
    }

    filteredData.forEach(row => {
        const tr = document.createElement("tr");
        
        const regionTd = document.createElement("td");
        regionTd.classList.add("fixed-col");
        regionTd.innerHTML = `<strong>${row.region}</strong>`;
        tr.appendChild(regionTd);
        
        const commodityTd = document.createElement("td");
        commodityTd.classList.add("fixed-col");
        commodityTd.style.left = "90px";
        commodityTd.innerHTML = `${row.commodity} ${row.subtitle ? `<br><small style="color:#888">${row.subtitle}</small>` : ''}`;
        tr.appendChild(commodityTd);
        
        const sizeTd = document.createElement("td");
        sizeTd.classList.add("fixed-col");
        sizeTd.style.left = "230px";
        sizeTd.innerHTML = `<span style="color:#10b981; font-weight:600;">${row.estSize || '-'}</span>`;
        tr.appendChild(sizeTd);

        selectedMonths.forEach(month => {
            const h1 = row.stages[month][0];
            const h2 = row.stages[month][1];

            // Render H1
            const td1 = document.createElement("td");
            td1.classList.add("month-cell");
            if (h1 && STAGE_COLORS[h1]) {
                td1.classList.add(STAGE_COLORS[h1].class);
                td1.title = `${month} 1st Half - ${STAGE_COLORS[h1].label}`;
            } else {
                td1.classList.add("empty");
            }
            tr.appendChild(td1);

            // Render H2
            const td2 = document.createElement("td");
            td2.classList.add("month-cell");
            if (h2 && STAGE_COLORS[h2]) {
                td2.classList.add(STAGE_COLORS[h2].class);
                td2.title = `${month} 2nd Half - ${STAGE_COLORS[h2].label}`;
            } else {
                td2.classList.add("empty");
            }
            tr.appendChild(td2);
        });

        tbody.appendChild(tr);
    });
}

const selectAllCommodity = document.getElementById('selectAllCommodity');
const selectAllRegion = document.getElementById('selectAllRegion');
const selectAllMonths = document.getElementById('selectAllMonths');
const commodityCheckboxes = document.querySelectorAll('.filter-commodity');
const regionCheckboxes = document.querySelectorAll('.filter-region');
const monthCheckboxes = document.querySelectorAll('.filter-month');

function updateSelectAll(groupCheckboxes, selectAllBox) {
    const allChecked = Array.from(groupCheckboxes).every(cb => cb.checked);
    const someChecked = Array.from(groupCheckboxes).some(cb => cb.checked);
    selectAllBox.checked = allChecked;
    selectAllBox.indeterminate = someChecked && !allChecked;
}

selectAllCommodity.addEventListener('change', function() {
    commodityCheckboxes.forEach(cb => cb.checked = this.checked);
    renderCalendar();
});

selectAllRegion.addEventListener('change', function() {
    regionCheckboxes.forEach(cb => cb.checked = this.checked);
    renderCalendar();
});

selectAllMonths.addEventListener('change', function() {
    monthCheckboxes.forEach(cb => cb.checked = this.checked);
    renderCalendar();
});

document.querySelectorAll('.filter-commodity, .filter-region, .filter-month').forEach(cb => {
    cb.addEventListener('click', function(e) {
        const isCommodity = this.classList.contains('filter-commodity');
        const isRegion = this.classList.contains('filter-region');
        
        let groupSelector, selectAllBox;
        if (isCommodity) {
            groupSelector = '.filter-commodity';
            selectAllBox = selectAllCommodity;
        } else if (isRegion) {
            groupSelector = '.filter-region';
            selectAllBox = selectAllRegion;
        } else {
            groupSelector = '.filter-month';
            selectAllBox = selectAllMonths;
        }
        
        const groupCheckboxes = document.querySelectorAll(groupSelector);
        
        // If user is NOT holding Ctrl (Windows) or Cmd (Mac), exclusively select this one
        if (!e.ctrlKey && !e.metaKey) {
            groupCheckboxes.forEach(box => {
                if (box !== this) {
                    box.checked = false;
                }
            });
            this.checked = true; // Ensure clicked item remains/becomes checked
        }
        
        updateSelectAll(groupCheckboxes, selectAllBox);
        renderCalendar();
    });
});

// Initial render
updateSelectAll(commodityCheckboxes, selectAllCommodity);
updateSelectAll(regionCheckboxes, selectAllRegion);
renderCalendar();
