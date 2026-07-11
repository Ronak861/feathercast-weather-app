/**
 * Minimal Weather App Logic
 */

// DOM Elements
const elements = {
    // Search & History
    cityInput: document.getElementById('city-input'),
    searchBtn: document.getElementById('search-btn'),
    recentSearchesContainer: document.getElementById('recent-searches'),
    
    // Status & Feedback
    messageContainer: document.getElementById('message-container'),
    loadingIndicator: document.getElementById('loading-indicator'),
    
    // Weather Data Display
    currentWeatherSection: document.getElementById('current-weather'),
    forecastSection: document.getElementById('forecast-section'),
    forecastContainer: document.getElementById('forecast-container'),
    
    // Current Weather Elements
    cityName: document.getElementById('city-name'),
    weatherDesc: document.getElementById('weather-description'),
    weatherIcon: document.getElementById('weather-icon'),
    temperature: document.getElementById('temperature'),
    feelsLike: document.getElementById('feels-like'),
    humidity: document.getElementById('humidity'),
    windSpeed: document.getElementById('wind-speed'),
};

// State
const state = {
    apiKey: '1dbaae8b9292926eb2db59e668f8bdd4',
    recentSearches: JSON.parse(localStorage.getItem('recent_searches')) || [],
    defaultCity: 'Gurgaon, India'
};

// API Base URLs
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

/**
 * Initialization
 */
function init() {
    setupEventListeners();
    renderRecentSearches();
    requestGeolocation();
}

/**
 * Event Listeners Setup
 */
function setupEventListeners() {
    // Search
    elements.searchBtn.addEventListener('click', handleSearch);
    elements.cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
}



/**
 * Geolocation
 */
function requestGeolocation() {
    if (navigator.geolocation) {
        showLoading(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                fetchWeatherDataByCoords(latitude, longitude);
            },
            (error) => {
                console.warn('Geolocation denied or failed:', error.message);
                fetchWeatherDataByCity(state.defaultCity);
            },
            { timeout: 5000 }
        );
    } else {
        fetchWeatherDataByCity(state.defaultCity);
    }
}

/**
 * Search Logic
 */
function handleSearch() {
    const city = elements.cityInput.value.trim();
    if (city) {
        fetchWeatherDataByCity(city);
        elements.cityInput.value = '';
    }
}

function addToRecentSearches(city) {
    // Remove if already exists to move to top
    state.recentSearches = state.recentSearches.filter(c => c.toLowerCase() !== city.toLowerCase());
    
    // Add to beginning
    state.recentSearches.unshift(city);
    
    // Keep only last 5
    if (state.recentSearches.length > 5) {
        state.recentSearches.pop();
    }
    
    localStorage.setItem('recent_searches', JSON.stringify(state.recentSearches));
    renderRecentSearches();
}

function renderRecentSearches() {
    elements.recentSearchesContainer.innerHTML = '';
    state.recentSearches.forEach(city => {
        const chip = document.createElement('button');
        chip.className = 'search-chip';
        chip.textContent = city;
        chip.addEventListener('click', () => {
            fetchWeatherDataByCity(city);
        });
        elements.recentSearchesContainer.appendChild(chip);
    });
}

/**
 * Data Fetching
 */
async function fetchWeatherDataByCity(city) {
    showLoading(true);
    hideMessage();
    hideWeather();

    try {
        const [currentRes, forecastRes] = await Promise.all([
            fetch(`${BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${state.apiKey}&units=metric`),
            fetch(`${BASE_URL}/forecast?q=${encodeURIComponent(city)}&appid=${state.apiKey}&units=metric`)
        ]);

        await handleApiResponse(currentRes, forecastRes, city);
    } catch (error) {
        handleApiError(error);
    }
}

async function fetchWeatherDataByCoords(lat, lon) {
    showLoading(true);
    hideMessage();
    hideWeather();

    try {
        const [currentRes, forecastRes] = await Promise.all([
            fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${state.apiKey}&units=metric`),
            fetch(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${state.apiKey}&units=metric`)
        ]);

        await handleApiResponse(currentRes, forecastRes, null);
    } catch (error) {
        handleApiError(error);
    }
}

async function handleApiResponse(currentRes, forecastRes, searchCity) {
    if (!currentRes.ok || !forecastRes.ok) {
        const errorData = await currentRes.json().catch(() => ({}));
        throw new Error(errorData.message || 'City not found or API error.');
    }

    const currentData = await currentRes.json();
    const forecastData = await forecastRes.json();

    displayCurrentWeather(currentData);
    displayForecast(forecastData);
    
    if (searchCity || currentData.name) {
        addToRecentSearches(searchCity || currentData.name);
    }

    showWeather();
    showLoading(false);
}

function handleApiError(error) {
    showLoading(false);
    hideWeather();
    
    if (!navigator.onLine) {
        showMessage('Network failure. Please check your internet connection.', 'error');
    } else {
        showMessage(`Error: ${error.message}`, 'error');
    }
}

/**
 * UI Rendering
 */
function displayCurrentWeather(data) {
    elements.cityName.textContent = `${data.name}, ${data.sys.country}`;
    elements.weatherDesc.textContent = data.weather[0].description;
    elements.temperature.textContent = `${Math.round(data.main.temp)}°C`;
    elements.feelsLike.textContent = `${Math.round(data.main.feels_like)}°C`;
    elements.humidity.textContent = `${data.main.humidity}%`;
    elements.windSpeed.textContent = `${data.wind.speed} m/s`;
    
    const iconCode = data.weather[0].icon;
    elements.weatherIcon.src = `https://openweathermap.org/img/wn/${iconCode}@4x.png`;
    elements.weatherIcon.alt = data.weather[0].main;
}

function displayForecast(data) {
    elements.forecastContainer.innerHTML = '';
    
    // Filter forecast to get one reading per day (closest to noon)
    const dailyForecasts = {};
    
    data.list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const day = date.toISOString().split('T')[0];
        const hour = date.getHours();
        
        // Prefer times closest to 12:00 PM (noon)
        if (!dailyForecasts[day] || Math.abs(hour - 12) < Math.abs(new Date(dailyForecasts[day].dt * 1000).getHours() - 12)) {
            dailyForecasts[day] = item;
        }
    });

    // Get the first 5 days (excluding today if we already have 6 items, but usually it limits naturally)
    const sortedDays = Object.keys(dailyForecasts).sort();
    const nextFiveDays = sortedDays.slice(0, 5);

    nextFiveDays.forEach(day => {
        const item = dailyForecasts[day];
        const dateObj = new Date(item.dt * 1000);
        
        // Format: "Mon, 12 Oct"
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        const dateNum = dateObj.getDate();
        
        const card = document.createElement('div');
        card.className = 'forecast-card';
        
        const iconCode = item.weather[0].icon;
        
        card.innerHTML = `
            <span class="forecast-date">${dayName}, ${dateNum}</span>
            <img src="https://openweathermap.org/img/wn/${iconCode}@2x.png" alt="${item.weather[0].main}" class="forecast-icon">
            <span class="forecast-temp">${Math.round(item.main.temp)}°C</span>
            <span class="forecast-desc">${item.weather[0].main}</span>
        `;
        
        elements.forecastContainer.appendChild(card);
    });
}

/**
 * UI State Helpers
 */
function showLoading(show) {
    if (show) {
        elements.loadingIndicator.classList.remove('hidden');
    } else {
        elements.loadingIndicator.classList.add('hidden');
    }
}

function showWeather() {
    elements.currentWeatherSection.classList.remove('hidden');
    elements.forecastSection.classList.remove('hidden');
}

function hideWeather() {
    elements.currentWeatherSection.classList.add('hidden');
    elements.forecastSection.classList.add('hidden');
}

function showMessage(msg, type = 'error') {
    elements.messageContainer.textContent = msg;
    elements.messageContainer.className = `message-container ${type}`;
    elements.messageContainer.classList.remove('hidden');
}

function hideMessage() {
    elements.messageContainer.classList.add('hidden');
    elements.messageContainer.className = 'message-container';
}

// Start app
document.addEventListener('DOMContentLoaded', init);