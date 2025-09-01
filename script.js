// --- Map Integration ---
let mapInstance = null;
let mapMarker = null;
function showMap(lat, lon, city = '') {
    const mapDiv = document.getElementById('map');
    if (!lat || !lon) {
        mapDiv.style.display = 'none';
        return;
    }
    mapDiv.style.display = 'block';
    if (!mapInstance) {
        mapInstance = L.map('map').setView([lat, lon], 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(mapInstance);
    } else {
        mapInstance.setView([lat, lon], 10);
        if (mapMarker) mapInstance.removeLayer(mapMarker);
    }
    mapMarker = L.marker([lat, lon]).addTo(mapInstance);
    mapMarker.bindPopup(city ? `<b>${city}</b>` : 'Current Location').openPopup();
}


// --- Weather App Upgrade ---
const weatherApi = {
    key: '4eb3703790b356562054106543b748b2',
    baseUrl: 'https://api.openweathermap.org/data/2.5/weather',
    forecastUrl: 'https://api.openweathermap.org/data/2.5/forecast'
};

let currentUnit = localStorage.getItem('weather_unit') || 'metric';
let isDark = localStorage.getItem('weather_theme') === 'dark';

const searchInputBox = document.getElementById('input-box');
const spinner = document.getElementById('spinner');
const weatherBody = document.getElementById('weather-body');
const forecastDiv = document.getElementById('forecast');

const geoBtn = document.getElementById('geo-btn');
const refreshBtn = document.getElementById('refresh-btn');
const unitToggle = document.getElementById('unit-toggle');
const themeToggle = document.getElementById('theme-toggle');
const alertsDiv = document.getElementById('weather-alerts');

// --- Event Listeners ---
searchInputBox.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        getWeatherByCity(searchInputBox.value);
    }
});
geoBtn.addEventListener('click', getWeatherByGeo);
refreshBtn.addEventListener('click', () => {
    if (searchInputBox.value) getWeatherByCity(searchInputBox.value);
    else getWeatherByGeo();
});
unitToggle.addEventListener('change', (e) => {
    currentUnit = e.target.value;
    localStorage.setItem('weather_unit', currentUnit);
    if (searchInputBox.value) getWeatherByCity(searchInputBox.value);
    else getWeatherByGeo();
});
themeToggle.addEventListener('click', () => {
    isDark = !isDark;
    localStorage.setItem('weather_theme', isDark ? 'dark' : 'light');
    setTheme();
});

// --- Theme ---
function setTheme() {
    if (isDark) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}
setTheme();

// --- Spinner ---
function showSpinner(show) {
    spinner.style.display = show ? 'block' : 'none';
}

// --- Weather Fetchers ---
function getWeatherByCity(city) {
    if (!city) {
        swal("Empty Input", "Please enter a city name", "error");
        return;
    }
    showSpinner(true);
    fetch(`${weatherApi.baseUrl}?q=${encodeURIComponent(city)}&appid=${weatherApi.key}&units=${currentUnit}`)
        .then(res => res.json())
        .then(data => {
            showSpinner(false);
            if (data.cod === '404') {
                swal("Not Found", "City not found!", "warning");
                weatherBody.style.display = 'none';
                forecastDiv.innerHTML = '';
                alertsDiv.innerHTML = '';
                return;
            }
            showWeatherReport(data);
            getForecast(city);
            // Fetch alerts using One Call API
            if (data.coord) {
                getWeatherAlerts(data.coord.lat, data.coord.lon);
                showMap(data.coord.lat, data.coord.lon, data.name);
            } else {
                alertsDiv.innerHTML = '';
                showMap();
            }
        })
        .catch(() => {
            showSpinner(false);
            swal("Error", "Failed to fetch weather data.", "error");
            alertsDiv.innerHTML = '';
        });
}

function getWeatherByGeo() {
    if (!navigator.geolocation) {
        swal("Error", "Geolocation is not supported.", "error");
        return;
    }
    showSpinner(true);
    navigator.geolocation.getCurrentPosition(pos => {
        const { latitude, longitude } = pos.coords;
        fetch(`${weatherApi.baseUrl}?lat=${latitude}&lon=${longitude}&appid=${weatherApi.key}&units=${currentUnit}`)
            .then(res => res.json())
            .then(data => {
                showSpinner(false);
                if (data.cod === '404') {
                    swal("Not Found", "Location not found!", "warning");
                    weatherBody.style.display = 'none';
                    forecastDiv.innerHTML = '';
                    alertsDiv.innerHTML = '';
                    return;
                }
                showWeatherReport(data);
                getForecast(null, latitude, longitude);
                getWeatherAlerts(latitude, longitude);
                showMap(latitude, longitude, data.name);
            })
            .catch(() => {
                showSpinner(false);
                swal("Error", "Failed to fetch weather data.", "error");
                alertsDiv.innerHTML = '';
            });
    }, () => {
        showSpinner(false);
        swal("Error", "Unable to get your location.", "error");
        alertsDiv.innerHTML = '';
    });
}
// --- Weather Alerts ---
function getWeatherAlerts(lat, lon) {
    // OpenWeatherMap One Call API (alerts)
    const oneCallUrl = `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&appid=${weatherApi.key}&units=${currentUnit}`;
    fetch(oneCallUrl)
        .then(res => res.json())
        .then(data => {
            if (data.alerts && data.alerts.length > 0) {
                alertsDiv.innerHTML = data.alerts.map(alert => `
                    <div class="alert-box">
                        <strong>${alert.event}</strong><br>
                        <span>${alert.description}</span><br>
                        <em>From: ${new Date(alert.start * 1000).toLocaleString()}<br>To: ${new Date(alert.end * 1000).toLocaleString()}</em>
                    </div>
                `).join('');
            } else {
                alertsDiv.innerHTML = '';
            }
        })
        .catch(() => {
            alertsDiv.innerHTML = '';
        });
}

function getForecast(city, lat, lon) {
    let url = '';
    if (city) {
        url = `${weatherApi.forecastUrl}?q=${encodeURIComponent(city)}&appid=${weatherApi.key}&units=${currentUnit}`;
    } else if (lat && lon) {
        url = `${weatherApi.forecastUrl}?lat=${lat}&lon=${lon}&appid=${weatherApi.key}&units=${currentUnit}`;
    } else {
        forecastDiv.innerHTML = '';
        renderHourlyChart([]);
        return;
    }
    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.cod !== "200") {
                forecastDiv.innerHTML = '';
                renderHourlyChart([]);
                return;
            }
            showForecast(data);
            showHourlyForecast(data);
        })
        .catch(() => {
            forecastDiv.innerHTML = '';
            renderHourlyChart([]);
        });
}
// --- Hourly Forecast Chart ---
let hourlyChartInstance = null;
function showHourlyForecast(data) {
    // Get next 8 (3-hourly) points (24 hours)
    const points = data.list.slice(0, 8);
    const labels = points.map(item => {
        const d = new Date(item.dt * 1000);
        return `${addZero(d.getHours())}:00`;
    });
    const temps = points.map(item => item.main.temp);
    renderHourlyChart({ labels, temps });
}

function renderHourlyChart({ labels = [], temps = [] }) {
    const ctx = document.getElementById('hourlyChart').getContext('2d');
    if (hourlyChartInstance) {
        hourlyChartInstance.destroy();
    }
    if (!labels.length) {
        ctx.clearRect(0, 0, 400, 180);
        return;
    }
    hourlyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Temp',
                data: temps,
                borderColor: '#e4603a',
                backgroundColor: 'rgba(218,30,78,0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#da1e4e',
            }]
        },
        options: {
            responsive: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: true }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return value + (currentUnit === 'metric' ? '°C' : '°F');
                        }
                    }
                }
            }
        }
    });
}

// --- UI Upgrades ---
function showWeatherReport(weather) {
    weatherBody.style.display = 'block';
    let todayDate = new Date();
    let unitSymbol = currentUnit === 'metric' ? 'C' : 'F';
    let windUnit = currentUnit === 'metric' ? 'm/s' : 'mph';
    let sunrise = new Date(weather.sys.sunrise * 1000);
    let sunset = new Date(weather.sys.sunset * 1000);
    weatherBody.innerHTML = `
        <div class="location-deatils">
            <div class="city" id="city">${weather.name}, ${weather.sys.country}</div>
            <div class="date" id="date">${dateManage(todayDate)}</div>
        </div>
        <div class="weather-status">
            <div class="temp" id="temp">${Math.round(weather.main.temp)}&deg;${unitSymbol}</div>
            <div class="weather" id="weather">${weather.weather[0].main} <i class="${getWeatherIcon(weather.weather[0])}"></i></div>
            <div class="min-max" id="min-max">${Math.floor(weather.main.temp_min)}&deg;${unitSymbol} (min) / ${Math.ceil(weather.main.temp_max)}&deg;${unitSymbol} (max)</div>
            <div id="updated_on">Updated as of ${getTime(todayDate)}</div>
        </div>
        <hr>
        <div class="day-details">
            <div class="basic">
                Feels like ${weather.main.feels_like}&deg;${unitSymbol} | Humidity ${weather.main.humidity}%<br>
                Pressure ${weather.main.pressure} mb | Wind ${weather.wind.speed} ${windUnit} (${getWindDirection(weather.wind.deg)})<br>
                Visibility: ${weather.visibility / 1000} km<br>
                Sunrise: ${getTime(sunrise)} | Sunset: ${getTime(sunset)}
            </div>
        </div>
    `;
    changeBg(weather.weather[0].main);
}

function showForecast(data) {
    // Group by day, show next 5 days at noon
    let days = {};
    data.list.forEach(item => {
        let date = new Date(item.dt * 1000);
        let day = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        let hour = date.getHours();
        if (hour === 12) days[day] = item;
    });
    let html = '';
    Object.keys(days).slice(0, 5).forEach(day => {
        let item = days[day];
        let unitSymbol = currentUnit === 'metric' ? 'C' : 'F';
        html += `
            <div class="forecast-card">
                <div class="day">${day}</div>
                <i class="${getWeatherIcon(item.weather[0])}"></i>
                <div class="temp">${Math.round(item.main.temp)}&deg;${unitSymbol}</div>
                <div class="desc">${item.weather[0].main}</div>
            </div>
        `;
    });
    forecastDiv.innerHTML = html;
}

// --- Helpers ---
function getTime(date) {
    let hour = addZero(date.getHours());
    let minute = addZero(date.getMinutes());
    return `${hour}:${minute}`;
}
function dateManage(dateArg) {
    let days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    let year = dateArg.getFullYear();
    let month = months[dateArg.getMonth()];
    let date = dateArg.getDate();
    let day = days[dateArg.getDay()];
    return `${date} ${month} (${day}), ${year}`;
}
function addZero(i) {
    return i < 10 ? '0' + i : i;
}
function getWindDirection(deg) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(deg / 45) % 8];
}
// --- Animated Weather Effects & Enhanced Backgrounds ---
function changeBg(status) {
    // Remove previous effect
    removeWeatherEffect();
    let bg = 'img/bg.jpg';
    // Add more backgrounds if you add more images!
    switch (status) {
        case 'Clouds':
            bg = Math.random() > 0.5 ? 'img/clouds.jpg' : 'img/bg1.jpg';
            break;
        case 'Rain':
            bg = 'img/rainy.jpg';
            addRainEffect();
            break;
        case 'Clear':
            bg = Math.random() > 0.5 ? 'img/clear.jpg' : 'img/sunny.jpg';
            break;
        case 'Snow':
            bg = 'img/snow.jpg';
            addSnowEffect();
            break;
        case 'Sunny':
            bg = 'img/sunny.jpg';
            break;
        case 'Thunderstorm':
            bg = 'img/thunderstrom.jpg';
            addRainEffect(0.7);
            break;
        case 'Drizzle':
            bg = 'img/drizzle.jpg';
            addRainEffect(0.3);
            break;
        case 'Mist': case 'Haze': case 'Fog':
            bg = 'img/mist.jpg';
            break;
        default:
            // Randomly pick a background for unknown types
            const bgs = ['img/bg.jpg','img/bg1.jpg','img/clear.jpg','img/clouds.jpg','img/sunny.jpg'];
            bg = bgs[Math.floor(Math.random()*bgs.length)];
    }
    document.body.style.backgroundImage = `url(${bg})`;
}

function addRainEffect(intensity = 1) {
    removeWeatherEffect();
    const effect = document.createElement('div');
    effect.className = 'weather-effect';
    const drops = Math.floor(60 * intensity);
    for (let i = 0; i < drops; i++) {
        const drop = document.createElement('div');
        drop.className = 'raindrop';
        drop.style.left = Math.random() * 100 + 'vw';
        drop.style.top = (Math.random() * 100 - 10) + 'vh';
        drop.style.animationDuration = (0.7 + Math.random() * 0.5) + 's';
        effect.appendChild(drop);
    }
    document.body.appendChild(effect);
}

function addSnowEffect() {
    removeWeatherEffect();
    const effect = document.createElement('div');
    effect.className = 'weather-effect';
    const flakes = 40;
    for (let i = 0; i < flakes; i++) {
        const flake = document.createElement('div');
        flake.className = 'snowflake';
        flake.innerHTML = '❄';
        flake.style.left = Math.random() * 100 + 'vw';
        flake.style.top = (Math.random() * 100 - 10) + 'vh';
        flake.style.fontSize = (1 + Math.random() * 1.5) + 'em';
        flake.style.animationDuration = (2 + Math.random() * 2) + 's';
        effect.appendChild(flake);
    }
    document.body.appendChild(effect);
}

function removeWeatherEffect() {
    const prev = document.querySelector('.weather-effect');
    if (prev) prev.remove();
}
function getWeatherIcon(weather) {
    // Use weather-icons library for animated icons
    const map = {
        'Thunderstorm': 'wi wi-thunderstorm',
        'Drizzle': 'wi wi-sprinkle',
        'Rain': 'wi wi-rain',
        'Snow': 'wi wi-snow',
        'Clear': 'wi wi-day-sunny',
        'Clouds': 'wi wi-cloudy',
        'Mist': 'wi wi-fog',
        'Smoke': 'wi wi-smoke',
        'Haze': 'wi wi-day-haze',
        'Dust': 'wi wi-dust',
        'Fog': 'wi wi-fog',
        'Sand': 'wi wi-sandstorm',
        'Ash': 'wi wi-volcano',
        'Squall': 'wi wi-strong-wind',
        'Tornado': 'wi wi-tornado',
    };
    return map[weather.main] || 'wi wi-na';
}

// --- On Load: Try geolocation, fallback to default city ---
window.addEventListener('DOMContentLoaded', () => {
    if (isDark) setTheme();
    getWeatherByGeo();
});
