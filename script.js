document.addEventListener('DOMContentLoaded', () => {
    const apiKey = 'cceaa9d140a017df3e762840ac4c3a51'; // Your OpenWeatherMap API key

    // --- STATE MANAGEMENT ---
    let currentUnit = 'metric';
    let currentWeatherData = null;
    let currentLocation = null; // { type: 'city' or 'coords', value: ... }
    let localTimeInterval = null;

    // --- DOM ELEMENTS ---
    const locationInput = document.getElementById('locationInput');
    const searchBtn = document.getElementById('searchBtn');
    const locationBtn = document.getElementById('locationBtn');
    
    const loading = document.getElementById('loading');
    const errorContainer = document.getElementById('error');
    const errorMessage = document.getElementById('errorMessage');
    
    const unitToggle = document.getElementById('unitToggle');
    const weatherCard = document.getElementById('weatherCard');
    const forecastCard = document.getElementById('forecastCard');
    const hourlyCard = document.getElementById('hourlyCard');
    const airQualityCard = document.getElementById('airQualityCard');
    const alertsCard = document.getElementById('alertsCard');
    const astronomyCard = document.getElementById('astronomyCard');
    
    const refreshBtn = document.getElementById('refreshBtn');
    const favoriteBtn = document.getElementById('favoriteBtn');
    const shareBtn = document.getElementById('shareBtn');
    const themeToggle = document.getElementById('themeToggle');

    // --- UI HELPER FUNCTIONS ---
    const showLoading = () => {
        weatherCard.classList.add('hidden');
        forecastCard.classList.add('hidden');
        hourlyCard.classList.add('hidden');
        unitToggle.classList.add('hidden');
        errorContainer.classList.add('hidden');
        loading.classList.remove('hidden');
    };

    const showError = (message) => {
        errorMessage.textContent = message;
        loading.classList.add('hidden');
        errorContainer.classList.remove('hidden');
    };

    const showAllCards = () => {
        loading.classList.add('hidden');
        errorContainer.classList.add('hidden');
        weatherCard.classList.remove('hidden');
        forecastCard.classList.remove('hidden');
        hourlyCard.classList.remove('hidden');
        airQualityCard.classList.remove('hidden');
        alertsCard.classList.remove('hidden');
        astronomyCard.classList.remove('hidden');
        unitToggle.classList.remove('hidden');
    };

    // --- UI UPDATE FUNCTIONS ---
    const updateUI = async (data, cityName) => {
        currentWeatherData = data;
        updateCurrentWeatherUI(data.current, data.timezone_offset, cityName);
        updateHourlyUI(data.forecast.list, data.timezone_offset);
        updateForecastUI(data.forecast.list, data.timezone_offset);
        
        // Fetch and update pro features
        const lat = data.current.coord.lat;
        const lon = data.current.coord.lon;
        await updateAirQualityUI(lat, lon);
        updateAlertsUI([]); // OpenWeatherMap free API doesn't include alerts
        updateAstronomyUI(data.current);
        
        showAllCards();
    };

    const updateCurrentWeatherUI = (current, offset, name) => {
        const tempUnit = currentUnit === 'metric' ? 'C' : 'F';
        const windUnit = currentUnit === 'metric' ? 'km/h' : 'mph';
        
        document.getElementById('cityName').textContent = name;
        document.getElementById('country').textContent = current.sys.country;
        document.getElementById('weatherIcon').src = `https://openweathermap.org/img/wn/${current.weather[0].icon}@4x.png`;
        document.getElementById('temperature').textContent = Math.round(current.main.temp);
        document.querySelector('.temperature .unit').textContent = `°${tempUnit}`;
        document.getElementById('weatherDescription').textContent = current.weather[0].description;
        document.getElementById('feelsLike').textContent = `Feels like ${Math.round(current.main.feels_like)}°${tempUnit}`;
        
        document.getElementById('visibility').textContent = `${(current.visibility / 1000).toFixed(1)} km`;
        document.getElementById('humidity').textContent = `${current.main.humidity}%`;
        const windSpeed = currentUnit === 'metric' ? (current.wind.speed * 3.6).toFixed(1) : current.wind.speed.toFixed(1);
        document.getElementById('windSpeed').textContent = `${windSpeed} ${windUnit}`;
        document.getElementById('pressure').textContent = `${current.main.pressure} hPa`;
        // UV Index is not available in the free forecast API, so we hide it
        document.getElementById('uvIndex').parentElement.style.display = 'none';
        document.getElementById('cloudiness').textContent = `${current.clouds.all}%`;
        
        updateLocalTime(offset);
    };

    const updateLocalTime = (offset) => {
        if (localTimeInterval) clearInterval(localTimeInterval);
        
        const localTimeEl = document.getElementById('localTime');
        
        localTimeInterval = setInterval(() => {
            const now = new Date();
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const local = new Date(utc + (offset * 1000));
            localTimeEl.textContent = `Local Time: ${local.toLocaleTimeString()}`;
        }, 1000);
        
        document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString();
    };
    
    const updateHourlyUI = (forecastList, offset) => {
        const hourlyScroll = document.getElementById('hourlyScroll');
        hourlyScroll.innerHTML = '';
        const tempUnit = currentUnit === 'metric' ? 'C' : 'F';

        // Take first 8 items (24 hours worth of 3-hour intervals)
        forecastList.slice(0, 8).forEach(item => {
            const date = new Date(item.dt * 1000);
            const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

            const hourlyItem = `
                <div class="hourly-item">
                    <div class="hourly-time">${time}</div>
                    <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}.png" alt="${item.weather[0].description}" class="hourly-icon">
                    <div class="hourly-temp">${Math.round(item.main.temp)}°${tempUnit}</div>
                </div>
            `;
            hourlyScroll.innerHTML += hourlyItem;
        });
    };

    const updateAstronomyUI = (current) => {
        const { sunrise, sunset } = current.sys;
        const sunriseTime = new Date(sunrise * 1000);
        const sunsetTime = new Date(sunset * 1000);
        const now = new Date();

        document.getElementById('sunriseTime').textContent = sunriseTime.toLocaleTimeString('en-US', { hour: '2-digit', minute:'2-digit' });
        document.getElementById('sunsetTime').textContent = sunsetTime.toLocaleTimeString('en-US', { hour: '2-digit', minute:'2-digit' });

        // Update sun progress bar
        const totalDaylight = (sunset - sunrise) / 60; // in minutes
        const minutesSinceSunrise = (now - sunriseTime) / (1000 * 60);
        const progress = Math.max(0, Math.min(100, (minutesSinceSunrise / totalDaylight) * 100));
        document.getElementById('sunIndicator').style.width = `${progress}%`;
    };
    
    const updateAirQualityUI = async (lat, lon) => {
        const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Could not fetch Air Quality Index');
            const data = await response.json();
            const aqi = data.list[0].main.aqi;

            const aqiValueEl = document.getElementById('aqiValue');
            aqiValueEl.textContent = aqi;

            const [category, description, color] = getAqiCategory(aqi);
            document.getElementById('aqiCategory').textContent = category;
            document.getElementById('aqiDescription').textContent = description;
            aqiValueEl.style.color = color;
            aqiValueEl.style.background = `${color}20`; // 20% opacity
            
            const componentsEl = document.getElementById('aqiComponents');
            componentsEl.innerHTML = '';
            for (const [key, value] of Object.entries(data.list[0].components)) {
                componentsEl.innerHTML += `<div class="aqi-component"><span class="aqi-name">${key.toUpperCase()}:</span> <span class="aqi-comp-value">${value.toFixed(2)} μg/m³</span></div>`;
            }
        } catch (error) {
            console.error("AQI Error:", error);
            airQualityCard.classList.add('hidden');
        }
    };
    
    const getAqiCategory = (aqi) => {
        if (aqi === 1) return ['Good', 'Air quality is excellent', '#27ae60'];
        if (aqi === 2) return ['Fair', 'Air quality is acceptable', '#f1c40f'];
        if (aqi === 3) return ['Moderate', 'Some may experience irritation', '#e67e22'];
        if (aqi === 4) return ['Poor', 'Health effects can be felt', '#c0392b'];
        if (aqi === 5) return ['Very Poor', 'Health alert: serious effects', '#8e44ad'];
        return ['Unknown', '', '#7f8c8d'];
    };
    
    const updateAlertsUI = (alerts) => {
        const alertsContent = document.getElementById('alertsContent');
        if (alerts.length === 0) {
            alertsCard.classList.add('hidden');
            return;
        }
        alertsCard.classList.remove('hidden');
        alertsContent.innerHTML = '';
        alerts.forEach(alert => {
            alertsContent.innerHTML += `
                <div class="alert-item">
                    <h4 class="alert-title">${alert.event}</h4>
                    <p class="alert-source">Source: ${alert.sender_name}</p>
                    <p class="alert-description">${alert.description}</p>
                </div>
            `;
        });
    };
    
    const updateForecastUI = (forecastList) => {
        const forecastGrid = document.getElementById('forecastGrid');
        forecastGrid.innerHTML = '';
        const tempUnit = currentUnit === 'metric' ? 'C' : 'F';

        // Group forecast by day and get daily min/max temps
        const dailyForecasts = {};
        
        forecastList.forEach(item => {
            const date = new Date(item.dt * 1000);
            const dayKey = date.toDateString();
            
            if (!dailyForecasts[dayKey]) {
                dailyForecasts[dayKey] = {
                    date: date,
                    temps: [],
                    weather: item.weather[0],
                    icon: item.weather[0].icon
                };
            }
            dailyForecasts[dayKey].temps.push(item.main.temp);
        });

        // Convert to array and take first 5 days
        const dailyArray = Object.values(dailyForecasts).slice(0, 5);
        
        dailyArray.forEach(day => {
            const dayName = day.date.toLocaleDateString('en-US', { weekday: 'short' });
            const maxTemp = Math.max(...day.temps);
            const minTemp = Math.min(...day.temps);
            
            const forecastItem = `
                <div class="forecast-item">
                    <div class="forecast-day">${dayName}</div>
                    <img src="https://openweathermap.org/img/wn/${day.icon}@2x.png" alt="${day.weather.description}" class="forecast-icon">
                    <div class="forecast-temps">
                        <span class="forecast-high">${Math.round(maxTemp)}°${tempUnit}</span>
                        <span class="forecast-low">${Math.round(minTemp)}°${tempUnit}</span>
                    </div>
                </div>
            `;
            forecastGrid.innerHTML += forecastItem;
        });
    };

    // --- API FETCH FUNCTIONS ---
    const fetchAllWeatherData = async (lat, lon, name) => {
        showLoading();
        currentLocation = { type: 'coords', value: { lat, lon, name } };
        
        try {
            // Fetch current weather (free API)
            const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${currentUnit}`;
            const currentResponse = await fetch(currentUrl);
            if (!currentResponse.ok) {
                const errorData = await currentResponse.json();
                throw new Error(errorData.message || 'Could not fetch current weather.');
            }
            const currentData = await currentResponse.json();
            
            // Fetch 5-day forecast (free API)
            const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${currentUnit}`;
            const forecastResponse = await fetch(forecastUrl);
            if (!forecastResponse.ok) {
                const errorData = await forecastResponse.json();
                throw new Error(errorData.message || 'Could not fetch forecast.');
            }
            const forecastData = await forecastResponse.json();
            
            // Combine data and update UI
            const combinedData = {
                current: currentData,
                forecast: forecastData,
                timezone_offset: currentData.timezone
            };
            
            updateUI(combinedData, name);
        } catch (error) {
            showError(error.message);
            console.error("Fetch Weather Error: ", error);
        }
    };
    
    const getCoordsForCity = async (city) => {
        showLoading();
        currentLocation = { type: 'city', value: city };

        const url = `https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${apiKey}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('City geocoding failed.');
            const data = await response.json();
            if (data.length === 0) throw new Error(`Could not find city: ${city}`);
            
            const { lat, lon, name } = data[0];
            fetchAllWeatherData(lat, lon, name);
        } catch (error) {
            showError(error.message);
            console.error("Geocoding Error: ", error);
        }
    };

    // --- EVENT LISTENERS ---
    searchBtn.addEventListener('click', () => {
        const city = locationInput.value.trim();
        if (city) {
            getCoordsForCity(city);
        }
    });

    locationInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchBtn.click();
    });

    locationBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
            showError('Geolocation is not supported by your browser.');
            return;
        }
        
        showLoading();
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                
                try {
                    // Use reverse geocoding to get city name
                    const reverseGeoUrl = `https://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=1&appid=${apiKey}`;
                    const geoResponse = await fetch(reverseGeoUrl);
                    
                    let cityName = "Current Location";
                    if (geoResponse.ok) {
                        const geoData = await geoResponse.json();
                        if (geoData.length > 0) {
                            cityName = geoData[0].name;
                            // Add state/country if available for better context
                            if (geoData[0].state) {
                                cityName += `, ${geoData[0].state}`;
                            } else if (geoData[0].country) {
                                cityName += `, ${geoData[0].country}`;
                            }
                        }
                    }
                    
                    fetchAllWeatherData(latitude, longitude, cityName);
                } catch (error) {
                    // If reverse geocoding fails, still show weather with generic name
                    fetchAllWeatherData(latitude, longitude, "Current Location");
                }
            },
            (error) => showError(`Unable to retrieve location: ${error.message}`)
        );
    });

    unitToggle.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const selectedUnit = e.target.dataset.unit;
            if (selectedUnit !== currentUnit) {
                currentUnit = selectedUnit;
                document.querySelectorAll('.unit-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                
                // Re-fetch data with the new unit
                if (currentLocation.type === 'city') {
                    getCoordsForCity(currentLocation.value);
                } else if (currentLocation.type === 'coords') {
                    const { lat, lon, name } = currentLocation.value;
                    fetchAllWeatherData(lat, lon, name);
                }
            }
        }
    });
    
    refreshBtn.addEventListener('click', () => {
        if (!currentLocation) return;
        if (currentLocation.type === 'city') {
            getCoordsForCity(currentLocation.value);
        } else {
            const { lat, lon, name } = currentLocation.value;
            fetchAllWeatherData(lat, lon, name);
        }
    });
    
    favoriteBtn.addEventListener('click', (e) => {
        const icon = e.currentTarget.querySelector('i');
        icon.classList.toggle('far'); // Toggle empty heart
        icon.classList.toggle('fas'); // Toggle solid heart
        
        if (icon.classList.contains('fas')) {
            icon.style.color = '#e74c3c';
            // Note: Add logic here to save to localStorage
        } else {
            icon.style.color = 'inherit';
            // Note: Add logic here to remove from localStorage
        }
    });
    
    shareBtn.addEventListener('click', () => {
        if (currentWeatherData) {
            const tempUnit = currentUnit === 'metric' ? 'C' : 'F';
            const shareData = {
                title: 'MyWeather Pro',
                text: `Current weather in ${document.getElementById('cityName').textContent}: ${Math.round(currentWeatherData.current.main.temp)}°${tempUnit}, ${currentWeatherData.current.weather[0].description}.`,
                url: window.location.href
            };
            
            if (navigator.share) {
                navigator.share(shareData).catch(err => console.error('Share failed:', err));
            } else {
                // Fallback for browsers that don't support Web Share API
                navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`).then(() => {
                    alert('Weather info copied to clipboard!');
                }).catch(err => {
                    alert('Could not copy to clipboard.');
                });
            }
        }
    });

    // --- DARK MODE TOGGLE ---
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.body.classList.contains('dark-theme');
        
        if (currentTheme) {
            // Switch to light theme
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
            localStorage.setItem('theme', 'light');
        } else {
            // Switch to dark theme with animation
            // Create overlay element
            const overlay = document.createElement('div');
            overlay.className = 'dark-overlay';
            document.body.appendChild(overlay);
            
            // Position overlay at button location
            const rect = themeToggle.getBoundingClientRect();
            overlay.style.transformOrigin = `${rect.left + rect.width/2}px ${rect.top + rect.height/2}px`;
            
            // Trigger animation
            setTimeout(() => {
                overlay.classList.add('active');
            }, 10);
            
            // Apply dark theme after animation starts
            setTimeout(() => {
                document.body.classList.add('dark-theme');
                document.body.classList.remove('light-theme');
                localStorage.setItem('theme', 'dark');
                
                // Remove overlay after animation completes
                setTimeout(() => {
                    document.body.removeChild(overlay);
                }, 300);
            }, 400);
        }
    });

    // --- INITIALIZE THEME FROM LOCALSTORAGE ---
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
    } else {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
    }
});

