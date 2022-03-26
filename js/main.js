// Filters
let countries = new Set();
let countriesSelected = [];
let export_import = 'export';
let selectedTimeRange = [1995, 2000];
let mode = 'overview'; // overview/ exploration;

// Figures
let overview, treemap, stackedLineChart, geomap, scatterplot, uiweights;
//Data
let data, timeFilteredData;

// Dispatcher
const dispatcher = d3.dispatch('updateDisplayedCountries', 'updateSelectedCountries', 'updateTime', 'time');

// Read data
Promise.all([
    d3.json('data/rollup_force_data.json'),
    d3.json('data/world.json'),
    d3.csv('data/clean_country_partner_hsproductsection_year.csv'),
    d3.csv('data/merge.csv'),
]).then(_data => {
    data = {
        'rollupForceData': _data[0],
        'world': _data[1],
        'rawData': _data[2],
        'mergedRawData': _data[3],
    }
    timeFilteredData = filterDataByTimeRange(selectedTimeRange);

    console.log(timeFilteredData);

    data['mergedRawData'].forEach(d => {
        d.import_value = +d.import_value;
        d.export_value = +d.export_value;
        d.year = +d.year;
        d.country = d.location_name_short_en;
        d.product = d.hs_product_name_short_en;
    });

    initViews();
})

function initViews() {
    // Country Checkboxes
    dispatcher.call('updateDisplayedCountries');

    // Timeline 
    uiweights = new UIWidgets({
        parentElement: '#timeline', // Add other three filters here later
        containerWidth: 1000
    }, dispatcher);

    // Relation graph
    overview = new OverviewGraph({
        parentElement: '#overview',
    }, timeFilteredData);

    // Geomap
    // TODO: change merged raw data into rollup force data 
    geomap = new ChoroplethMap({
        parentElement: '#geomap',
        containerWidth: 1000
    }, data["world"], data["rawData"], timeFilteredData, export_import);

    // need to concate location, product, clean_country_partner
    scatterplot = new Scatterplot({
        parentElement: '#scatter',
        containerWidth: 1000
    }, data["mergedRawData"]);
}


document.addEventListener("change", e => {
    if (document.getElementById("btnradio1").checked) {
        export_import = "export";
    } else {
        export_import = "import";
    }
    console.log(export_import);
})

dispatcher.on('updateDisplayedCountries', () => {
    // Update HTML rendering, then update event listener 
    updateCountryCheckbox().then(
        function (value) {
            const inputs = document.getElementsByClassName("form-check-input");
            //console.log(inputs);
            for (const input of inputs) {
                input.addEventListener('click', (event) => {
                    const elem = event.currentTarget;
                    const label = elem.parentNode.outerText;
                    if (elem.checked) {
                        countriesSelected.push(label);
                    } else {
                        countriesSelected = countriesSelected.filter(d => d != label);
                    }
                    console.log(label);
                    console.log(countriesSelected);
                    // console.log(elem.parentNode);
                });
            }
        }
    )
});


dispatcher.on('updateTime', s => {
    selectedTimeRange = s;
    dispatcher.call('updateDisplayedCountries');
    timeFilteredData = filterDataByTimeRange(s);
    console.log(timeFilteredData);

    geomap.value_data2 = timeFilteredData;
    geomap.updateVis();

    overview.data = timeFilteredData;
    overview.updateVis();

    updateScatterplot();
})

dispatcher.on('updateSelectedCountries', allSelected => {
    if (allSelected) {
        countriesSelected = Array.from(countries).sort();
    } else {
        countriesSelected = [];
    }
    console.log(countriesSelected);
    updateScatterplot();
})

function filterDataByTimeRange(s) {
    const tempTimeFilteredData = d3.filter(Object.entries(data["rollupForceData"]), d => (parseInt(d[0]) >= selectedTimeRange[0]) && (parseInt(d[0]) <= selectedTimeRange[1]));
    const tempTimeFilteredData2 = data['rawData'].filter(d => ((selectedTimeRange[0] <= parseInt(d.year)) && (parseInt(d.year) <= selectedTimeRange[1])));
    return {
        "node": d3.rollups(tempTimeFilteredData.map(d => d[1]["node"]).flat(), 
                    v => { return {
                          "id": v[0].id, 
                          "partner_num": d3.sum(v, e => e.partner_num)}
                    }, d => d.id)
                  .map(d => d[1]),
        "link": d3.groups(tempTimeFilteredData.map(d => d[1]["link"]).flat(), d => d.target, d => d.source)
                  .map(d => d[1]).flat()
                  .map(d => { return {
                        "target": d[1][0].target,
                        "source": d[1][0].source,
                        "export_value": d3.sum(d[1], e => e.export_value),}
                  }),
        "export": d3.rollup(tempTimeFilteredData2, v => d3.sum(v, d => d.export_value), d => d.location_code),
        "import": d3.rollup(tempTimeFilteredData2, v => d3.sum(v, d => d.import_value), d => d.location_code),
    }
}

function updateScatterplot() {
    if (countriesSelected.length == 0) {
        scatterplot.data = [];
    } else {
        scatterplot.data = scatterplot.fullData.filter(d => countriesSelected.includes(d.location_code));
        scatterplot.data = scatterplot.data.filter(d => d.year >= selectedTimeRange[0] && d.year <= selectedTimeRange[1]);
    }
    scatterplot.updateVis();
}

async function updateCountryCheckbox() {
    countries.clear();
    console.log(timeFilteredData["node"]);
    timeFilteredData["node"].forEach(item => countries.add(item.id));

    console.log(countries);
    const myPromise = new Promise((resolve, reject) => {
        var countryHTML = "";
        Array.from(countries).sort().forEach(val => {
            countryHTML += `
        <div class="form-check">
            <input class="form-check-input" type="checkbox" value="" id="flexCheckDefault">
            <label class="form-check-label" for="flexCheckDefault">` + val + ` </label>
        </div>
    `
        });
        // console.log(countryHTML);
        resolve(countryHTML);
    })
    myPromise.then(v => {
        document.getElementById("country-filter").innerHTML = v;
    })
    //.then(() => console.log(document.getElementById("country-filter").innerHTML));
    //console.log(document.getElementById("country-filter").innerHTML);
}

// TODO: Check at most 5 countries 
function checkAll() {
    d3.selectAll('.form-check-input').property('checked', true);
    dispatcher.call('updateSelectedCountries', {}, true);
}

function uncheckAll() {
    d3.selectAll('.form-check-input').property('checked', false);
    dispatcher.call('updateSelectedCountries', {}, false);
}