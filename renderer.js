const { ipcRenderer } = require('electron');

let tabs = [];
let currentTabId = 1;
let tabCounter = 1;
let history = [];
let bookmarks = [];
let downloads = [];

document.addEventListener('DOMContentLoaded', () => {
    try {
        loadBookmarks();
        setupEventListeners();
        const hiddenTab = document.getElementById('hidden-initial-tab');
        if (hiddenTab) {
            attachStartPageListeners(hiddenTab);
        }
    } catch (error) {
        console.error('Initialization error:', error);
    }
});

function setupEventListeners() {
    document.getElementById('minimize-btn').addEventListener('click', () => {
        ipcRenderer.invoke('window-minimize');
    });

    document.getElementById('maximize-btn').addEventListener('click', () => {
        ipcRenderer.invoke('window-maximize');
    });

    document.getElementById('close-btn').addEventListener('click', () => {
        ipcRenderer.invoke('window-close');
    });

    document.getElementById('back-btn').addEventListener('click', () => {
        const tab = getCurrentTab();
        if (tab && tab.webview) {
            try {
                if (tab.webview.canGoBack()) {
                    tab.webview.goBack();
                }
            } catch (error) {
                console.error('Error going back:', error);
            }
        }
    });

    document.getElementById('forward-btn').addEventListener('click', () => {
        const tab = getCurrentTab();
        if (tab && tab.webview) {
            try {
                if (tab.webview.canGoForward()) {
                    tab.webview.goForward();
                }
            } catch (error) {
                console.error('Error going forward:', error);
            }
        }
    });

    document.getElementById('refresh-btn').addEventListener('click', () => {
        const tab = getCurrentTab();
        if (tab && tab.webview) {
            try {
                tab.webview.reload();
            } catch (error) {
                console.error('Error reloading:', error);
            }
        } else if (tab && (tab.url === 'about:blank' || !tab.url)) {
            const container = document.querySelector(`.webview-container[data-tab-id="${tab.id}"]`);
            if (container) {
                container.innerHTML = getStartPageHTML();
                attachStartPageListeners(container);
                tab.url = 'about:blank';
                updateAddressBar('');
            }
        }
    });

    document.getElementById('home-btn').addEventListener('click', () => {
        createNewTab('about:blank');
    });

    const addressInput = document.getElementById('address-input');
    addressInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const url = addressInput.value.trim();
            navigateToUrl(url);
        }
    });

    document.getElementById('new-tab-btn').addEventListener('click', () => {
        createNewTab();
    });

    document.getElementById('bookmarks-btn').addEventListener('click', () => {
        showSidebar('Yer İşaretleri', renderBookmarks);
    });

    document.getElementById('history-btn').addEventListener('click', () => {
        showSidebar('Geçmiş', renderHistory);
    });

    document.getElementById('downloads-btn').addEventListener('click', () => {
        showSidebar('İndirilenler', renderDownloads);
    });

    document.getElementById('settings-btn').addEventListener('click', () => {
        showSidebar('Ayarlar', renderSettings);
    });

    document.getElementById('credits-btn').addEventListener('click', () => {
        navigateToUrl('credits.html');
    });

    document.getElementById('bookmark-btn').addEventListener('click', () => {
        addBookmark();
    });

    document.getElementById('import-accounts-btn').addEventListener('click', () => {
        showImportAccountsDialog();
    });

    const startSearchInput = document.getElementById('start-search-input');
    if (startSearchInput) {
        startSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                const query = startSearchInput.value.trim();
                if (query) {
                    if (tabs.length === 0) {
                        createNewTab();
                        setTimeout(() => {
                            navigateToUrl(query);
                        }, 100);
                    } else {
                        navigateToUrl(query);
                    }
                }
                return false;
            }
        });
    }
    
    const startSearchBtn = document.getElementById('start-search-btn');
    if (startSearchBtn) {
        startSearchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const input = document.getElementById('start-search-input');
            const query = input ? input.value.trim() : '';
            if (query) {
                if (tabs.length === 0) {
                    createNewTab();
                    setTimeout(() => {
                        navigateToUrl(query);
                    }, 100);
                } else {
                    navigateToUrl(query);
                }
            }
            return false;
        });
    }

    document.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const input = e.target;
            if (input && (input.id === 'start-search-input' || input.classList.contains('start-search-input'))) {
                e.preventDefault();
                e.stopPropagation();
                const query = input.value.trim();
                if (query) {
                    if (tabs.length === 0) {
                        createNewTab();
                        setTimeout(() => {
                            navigateToUrl(query);
                        }, 100);
                    } else {
                        navigateToUrl(query);
                    }
                }
                return false;
            }
        }
    });

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#start-search-btn, .start-search-btn, .search-btn');
        if (btn && (btn.id === 'start-search-btn' || btn.classList.contains('start-search-btn') || btn.classList.contains('search-btn'))) {
            e.preventDefault();
            e.stopPropagation();
            const container = btn.closest('.start-page-content, .start-page, .search-box-container');
            const input = container ? container.querySelector('#start-search-input, .start-search-input, input[type="text"]') : null;
            const query = input ? input.value.trim() : '';
            if (query) {
                if (tabs.length === 0) {
                    createNewTab();
                    setTimeout(() => {
                        navigateToUrl(query);
                    }, 100);
                } else {
                    navigateToUrl(query);
                }
            }
            return false;
        }
    });

    document.getElementById('sidebar-close').addEventListener('click', () => {
        hideSidebar();
    });

    document.getElementById('sidebar-overlay').addEventListener('click', () => {
        hideSidebar();
    });

    document.addEventListener('click', (e) => {
        const quickLink = e.target.closest('.quick-link');
        if (quickLink) {
            e.preventDefault();
            e.stopPropagation();
            const url = quickLink.getAttribute('data-url');
            if (url) {
                if (tabs.length === 0) {
                    createNewTab();
                    setTimeout(() => {
                        navigateToUrl(url);
                    }, 100);
                } else {
                    navigateToUrl(url);
                }
            }
            return false;
        }
    });
}

function createNewTab(url = 'about:blank') {
    tabCounter++;
    const tabId = tabCounter;
    
    if (tabs.length === 0) {
        const hiddenTab = document.getElementById('hidden-initial-tab');
        if (hiddenTab) {
            hiddenTab.classList.remove('active');
            hiddenTab.style.display = 'none';
        }
        currentTabId = tabId;
    }
    
    const tab = {
        id: tabId,
        url: url,
        realUrl: url,
        title: 'Yeni Sekme',
        webview: null
    };

    tabs.push(tab);

    const tabsList = document.getElementById('tabs-list');
    const tabElement = document.createElement('div');
    tabElement.className = 'tab';
    tabElement.setAttribute('data-tab-id', tabId);
    tabElement.innerHTML = `
        <div class="tab-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" stroke-width="2"/>
                <path d="M12 6v6l4 2" stroke-width="2" stroke-linecap="round"/>
            </svg>
        </div>
        <span class="tab-title">Yeni Sekme</span>
        <button class="tab-close" data-tab-id="${tabId}">×</button>
    `;

    tabsList.appendChild(tabElement);

    const contentArea = document.querySelector('.content-area');
    const webviewContainer = document.createElement('div');
    webviewContainer.className = 'webview-container';
    webviewContainer.setAttribute('data-tab-id', tabId);

    if (url === 'about:blank') {
        webviewContainer.innerHTML = getStartPageHTML();
        attachStartPageListeners(webviewContainer);
    } else {
        const webview = document.createElement('webview');
        webview.src = url;
        webview.setAttribute('allowpopups', 'true');
        webview.setAttribute('nodeintegration', 'false');
        webview.style.width = '100%';
        webview.style.height = '100%';
        webviewContainer.appendChild(webview);
        tab.webview = webview;

        setupWebviewListeners(webview, tab);
        setupLocationPrivacy(webview);
    }

    contentArea.appendChild(webviewContainer);

    switchTab(tabId);

    tabElement.addEventListener('click', (e) => {
        if (!e.target.classList.contains('tab-close')) {
            switchTab(tabId);
        }
    });

    tabElement.querySelector('.tab-close').addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(tabId);
    });

    if (url !== 'about:blank') {
        navigateToUrl(url);
    }
}


// Random location data for privacy protection
const fakeLocations = [
    // { lat: 60.1699, lng: 24.9384, country: 'Finland', city: 'Helsinki' }, // Finland
    // { lat: 59.9343, lng: 30.3351, country: 'Russia', city: 'Saint Petersburg' },
    // { lat: 59.3293, lng: 18.0686, country: 'Sweden', city: 'Stockholm' },
    // { lat: 55.6761, lng: 12.5683, country: 'Denmark', city: 'Copenhagen' },
    // { lat: 59.9139, lng: 10.7522, country: 'Norway', city: 'Oslo' },
    // { lat: 64.1466, lng: -21.9426, country: 'Iceland', city: 'Reykjavik' },
    // { lat: 52.5200, lng: 13.4050, country: 'Germany', city: 'Berlin' },
    { lat: 48.8566, lng: 2.3522, country: 'OBADİSTAN', city: 'POVNO' }
];

function getRandomLocation() {
    return fakeLocations[Math.floor(Math.random() * fakeLocations.length)];
}

function setupLocationPrivacy(webview) {
    // Check if tracking protection is enabled
    const trackingEnabled = localStorage.getItem('trackingProtection') === 'true';
    
    if (!trackingEnabled) return;
    
    // Inject location privacy script when page loads
    webview.addEventListener('did-finish-load', () => {
        const location = getRandomLocation();
        
        // Override geolocation API
        webview.executeJavaScript(`
            (function() {
                if (navigator.geolocation) {
                    const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition;
                    const originalWatchPosition = navigator.geolocation.watchPosition;
                    
                    navigator.geolocation.getCurrentPosition = function(success, error, options) {
                        if (success) {
                            success({
                                coords: {
                                    latitude: ${location.lat},
                                    longitude: ${location.lng},
                                    accuracy: 100,
                                    altitude: null,
                                    altitudeAccuracy: null,
                                    heading: null,
                                    speed: null
                                },
                                timestamp: Date.now()
                            });
                        }
                    };
                    
                    navigator.geolocation.watchPosition = function(success, error, options) {
                        if (success) {
                            const watchId = setInterval(() => {
                                success({
                                    coords: {
                                        latitude: ${location.lat},
                                        longitude: ${location.lng},
                                        accuracy: 100,
                                        altitude: null,
                                        altitudeAccuracy: null,
                                        heading: null,
                                        speed: null
                                    },
                                    timestamp: Date.now()
                                });
                            }, 1000);
                            return watchId;
                        }
                    };
                }
                
                // Override timezone
                const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
                Date.prototype.getTimezoneOffset = function() {
                    return -120; // UTC+2 (Finland timezone)
                };
            })();
        `).catch(err => console.error('Location privacy injection error:', err));
    });
}

function setupWebviewListeners(webview, tab) {
    try {
        webview.addEventListener('did-start-loading', () => {
            updateTabTitle(tab.id, 'Yükleniyor...');
            if (tab.url) {
                updateAddressBar(tab.url);
            }
        });

        webview.addEventListener('did-stop-loading', () => {
            try {
                const title = webview.getTitle() || 'Yeni Sekme';
                updateTabTitle(tab.id, title);
                tab.title = title;
                let realUrl = webview.getURL();
                if (realUrl) {
                    tab.realUrl = realUrl; // Store real URL
                    // Convert search URLs to cheatglobal.com format for display
                    if (realUrl.includes('google.com/search') || realUrl.includes('bing.com/search') || realUrl.includes('duckduckgo.com/?q=')) {
                        const urlObj = new URL(realUrl);
                        const query = urlObj.searchParams.get('q') || urlObj.searchParams.get('query') || '';
                        if (query) {
                            tab.url = 'https://cheatglobal.com/?q=' + encodeURIComponent(query);
                            updateAddressBar(tab.url);
                        } else {
                            tab.url = realUrl;
                            updateAddressBar(realUrl);
                        }
                    } else {
                        tab.url = realUrl;
                        updateAddressBar(realUrl);
                    }
                    addToHistory(tab.url, title);
                }
            } catch (error) {
                console.error('Error in did-stop-loading:', error);
            }
        });

        webview.addEventListener('page-title-updated', (e) => {
            if (e && e.title) {
                updateTabTitle(tab.id, e.title);
                tab.title = e.title;
            }
        });

        webview.addEventListener('did-navigate', (e) => {
            if (e && e.url) {
                let realUrl = e.url;
                tab.realUrl = realUrl;
                // Convert search URLs to cheatglobal.com format for display
                if (realUrl.includes('google.com/search') || realUrl.includes('bing.com/search') || realUrl.includes('duckduckgo.com/?q=')) {
                    const urlObj = new URL(realUrl);
                    const query = urlObj.searchParams.get('q') || urlObj.searchParams.get('query') || '';
                    if (query) {
                        tab.url = 'https://cheatglobal.com/?q=' + encodeURIComponent(query);
                        updateAddressBar(tab.url);
                    } else {
                        tab.url = realUrl;
                        updateAddressBar(realUrl);
                    }
                } else {
                    tab.url = realUrl;
                    updateAddressBar(realUrl);
                }
            }
        });

        webview.addEventListener('did-navigate-in-page', (e) => {
            if (e && e.url) {
                let realUrl = e.url;
                tab.realUrl = realUrl;
                // Convert search URLs to cheatglobal.com format for display
                if (realUrl.includes('google.com/search') || realUrl.includes('bing.com/search') || realUrl.includes('duckduckgo.com/?q=')) {
                    const urlObj = new URL(realUrl);
                    const query = urlObj.searchParams.get('q') || urlObj.searchParams.get('query') || '';
                    if (query) {
                        tab.url = 'https://cheatglobal.com/?q=' + encodeURIComponent(query);
                        updateAddressBar(tab.url);
                    } else {
                        tab.url = realUrl;
                        updateAddressBar(realUrl);
                    }
                } else {
                    tab.url = realUrl;
                    updateAddressBar(realUrl);
                }
            }
        });

        webview.addEventListener('did-fail-load', (e) => {
            console.error('Failed to load:', e);
            updateTabTitle(tab.id, 'Yükleme Hatası');
        });
    } catch (error) {
        console.error('Error setting up webview listeners:', error);
    }
}

function switchTab(tabId) {
    currentTabId = tabId;

    // Update tab UI
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-tab-id') == tabId) {
            tab.classList.add('active');
        }
    });

    // Update webview containers (hide hidden initial tab)
    const hiddenTab = document.getElementById('hidden-initial-tab');
    if (hiddenTab) {
        hiddenTab.classList.remove('active');
        hiddenTab.style.display = 'none';
    }
    
    document.querySelectorAll('.webview-container').forEach(container => {
        if (container.id !== 'hidden-initial-tab') {
            container.classList.remove('active');
            if (container.getAttribute('data-tab-id') == tabId) {
                container.classList.add('active');
            }
        }
    });

    // Update address bar
    const tab = getCurrentTab();
    if (tab) {
        updateAddressBar(tab.url || 'about:blank');
    }
}

function closeTab(tabId) {
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    // Store which tab to switch to
    let switchToTabId = null;
    if (currentTabId === tabId) {
        // If closing current tab, switch to another
        if (tabIndex > 0) {
            switchToTabId = tabs[tabIndex - 1].id;
        } else if (tabs.length > 1) {
            switchToTabId = tabs[1].id;
        }
    }

    tabs.splice(tabIndex, 1);

    // Remove tab element
    const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    if (tabElement) {
        tabElement.remove();
    }

    // Remove webview container
    const webviewContainer = document.querySelector(`.webview-container[data-tab-id="${tabId}"]`);
    if (webviewContainer) {
        webviewContainer.remove();
    }

    // Switch to another tab or show hidden initial tab
    if (switchToTabId) {
        switchTab(switchToTabId);
    } else if (tabs.length > 0) {
        // Fallback: switch to first available tab
        switchTab(tabs[0].id);
    } else {
        // No tabs left, show hidden initial tab
        const hiddenTab = document.getElementById('hidden-initial-tab');
        if (hiddenTab) {
            hiddenTab.style.display = 'block';
            hiddenTab.classList.add('active');
            updateAddressBar('');
        }
    }
}

function getCurrentTab() {
    return tabs.find(t => t.id === currentTabId);
}

function navigateToUrl(url) {
    if (!url) return;

    // If no tabs exist, create one first
    if (tabs.length === 0) {
        createNewTab();
        // Wait a bit for tab to be created, then navigate
        setTimeout(() => {
            navigateToUrl(url);
        }, 50);
        return;
    }

    let finalUrl = url;

    // Handle about:blank - show start page
    if (url === 'about:blank') {
        const tab = getCurrentTab();
        if (tab) {
            const container = document.querySelector(`.webview-container[data-tab-id="${tab.id}"]`);
            if (container) {
                // Remove webview if exists
                if (tab.webview) {
                    tab.webview = null;
                }
                // Show start page
                container.innerHTML = getStartPageHTML();
                attachStartPageListeners(container);
                tab.url = 'about:blank';
                tab.realUrl = 'about:blank';
                updateAddressBar('');
                return;
            }
        }
    }

    // Handle credits.html specially
    if (url === 'credits.html' || url.includes('credits.html')) {
        finalUrl = 'credits.html';
        const tab = getCurrentTab();
        if (tab) {
            const container = document.querySelector(`.webview-container[data-tab-id="${tab.id}"]`);
            if (container) {
                container.innerHTML = `<iframe src="credits.html" style="width: 100%; height: 100%; border: none;"></iframe>`;
                tab.url = finalUrl;
                updateAddressBar(finalUrl);
                return;
            }
        }
    }

    // Check if it's a URL or search query
    let displayUrl = null; // URL to show in address bar
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://') && !url.startsWith('about:')) {
        if (url.includes('.') && !url.includes(' ') && !url.startsWith('www.')) {
            finalUrl = 'https://' + url;
            displayUrl = finalUrl;
        } else {
            // Get search engine from settings
            const searchEngine = localStorage.getItem('searchEngine') || 'google';
            let searchUrl = 'https://www.google.com/search?q=';
            
            if (searchEngine === 'bing') {
                searchUrl = 'https://www.bing.com/search?q=';
            } else if (searchEngine === 'duckduckgo') {
                searchUrl = 'https://duckduckgo.com/?q=';
            }
            
            // Real URL for webview (actual search)
            finalUrl = searchUrl + encodeURIComponent(url);
            // Display URL for address bar (cheatglobal.com format)
            displayUrl = 'https://cheatglobal.com/?q=' + encodeURIComponent(url);
        }
    }

    const tab = getCurrentTab();
    if (tab) {
        // Store real URL for webview and display URL for address bar
        tab.realUrl = finalUrl; // Actual URL to load
        tab.url = displayUrl || finalUrl; // URL to show in address bar

        // Get container
        const container = document.querySelector(`.webview-container[data-tab-id="${tab.id}"]`);
        if (!container) return;

        // If webview exists, navigate it
        if (tab.webview) {
            try {
                tab.webview.src = tab.realUrl; // Load real URL
            } catch (error) {
                console.error('Error navigating webview:', error);
                // Recreate webview
                container.innerHTML = '';
                const webview = document.createElement('webview');
                webview.src = tab.realUrl; // Load real URL
                webview.setAttribute('allowpopups', 'true');
                webview.setAttribute('nodeintegration', 'false');
                webview.style.width = '100%';
                webview.style.height = '100%';
                container.appendChild(webview);
                tab.webview = webview;
                setupWebviewListeners(webview, tab);
                setupLocationPrivacy(webview);
            }
        } else {
            // Create webview
            container.innerHTML = '';
            const webview = document.createElement('webview');
            webview.src = tab.realUrl; // Load real URL
            webview.setAttribute('allowpopups', 'true');
            webview.setAttribute('nodeintegration', 'false');
            webview.style.width = '100%';
            webview.style.height = '100%';
            container.appendChild(webview);
            tab.webview = webview;
            setupWebviewListeners(webview, tab);
            setupLocationPrivacy(webview);
        }

        // Show display URL in address bar
        updateAddressBar(tab.url);
        addToHistory(tab.url, '');
    }
}

function getStartPageHTML() {
    return `
        <div class="start-page">
            <div class="start-page-content">
                <div class="start-logo">
                    <div class="cg-logo-container">
                        <div class="cg-logo-circle">
                            <span class="cg-letters">CG</span>
                        </div>
                    </div>
                </div>
                <h1 class="start-title">
                    <span class="cheat-text">CHEAT</span>
                    <span class="global-text">GLOBAL</span>
                </h1>
                <p class="start-subtitle">Yenilikçi Web Tarayıcısı</p>
                <div class="search-box-container">
                    <div class="start-search-box">
                        <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <circle cx="11" cy="11" r="8" stroke-width="2"/>
                            <path d="M21 21l-4.35-4.35" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        <input type="text" class="start-search-input" placeholder="Ara veya web adresi girin..." />
                        <button class="search-btn start-search-btn">Ara</button>
                    </div>
                </div>
                <div class="quick-links">
                    <div class="quick-link" data-url="https://www.google.com">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        <span>Google</span>
                    </div>
                    <div class="quick-link" data-url="https://www.youtube.com">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                        <span>YouTube</span>
                    </div>
                    <div class="quick-link" data-url="https://www.github.com">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                        <span>GitHub</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function attachStartPageListeners(container) {
    // Quick links - use event delegation
    container.addEventListener('click', (e) => {
        const quickLink = e.target.closest('.quick-link');
        if (quickLink) {
            e.preventDefault();
            e.stopPropagation();
            const url = quickLink.getAttribute('data-url');
            if (url) {
                // If we're on hidden initial tab, create a new tab for navigation
                if (tabs.length === 0) {
                    createNewTab();
                    setTimeout(() => {
                        navigateToUrl(url);
                    }, 100);
                } else {
                    navigateToUrl(url);
                }
            }
            return false;
        }
        
        // Search button
        const searchBtn = e.target.closest('.start-search-btn, #start-search-btn');
        if (searchBtn) {
            e.preventDefault();
            e.stopPropagation();
            const input = container.querySelector('.start-search-input, #start-search-input');
            const query = input ? input.value.trim() : '';
            if (query) {
                // If we're on hidden initial tab, create a new tab for navigation
                if (tabs.length === 0) {
                    createNewTab();
                    setTimeout(() => {
                        navigateToUrl(query);
                    }, 100);
                } else {
                    navigateToUrl(query);
                }
            }
            return false;
        }
    });
    
    // Search input - direct event listener (for dynamically created pages)
    const searchInput = container.querySelector('.start-search-input, #start-search-input');
    if (searchInput) {
        // Don't clone, just add listener directly
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                const query = searchInput.value.trim();
                if (query) {
                    // If we're on hidden initial tab, create a new tab for navigation
                    if (tabs.length === 0) {
                        createNewTab();
                        setTimeout(() => {
                            navigateToUrl(query);
                        }, 100);
                    } else {
                        navigateToUrl(query);
                    }
                }
                return false;
            }
        }, { once: false });
    }

    // Search button - direct event listener (for dynamically created pages)
    const searchBtn = container.querySelector('.start-search-btn, #start-search-btn, .search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const input = container.querySelector('.start-search-input, #start-search-input');
            const query = input ? input.value.trim() : '';
            if (query) {
                // If we're on hidden initial tab, create a new tab for navigation
                if (tabs.length === 0) {
                    createNewTab();
                    setTimeout(() => {
                        navigateToUrl(query);
                    }, 100);
                } else {
                    navigateToUrl(query);
                }
            }
            return false;
        }, { once: false });
    }
}

function updateAddressBar(url) {
    const addressInput = document.getElementById('address-input');
    if (addressInput) {
        addressInput.value = url === 'about:blank' ? '' : url;
    }
}

function updateTabTitle(tabId, title) {
    const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    if (tabElement) {
        const titleElement = tabElement.querySelector('.tab-title');
        if (titleElement) {
            titleElement.textContent = title || 'Yeni Sekme';
        }
    }
}

function addToHistory(url, title) {
    if (url === 'about:blank' || url.startsWith('file://')) return;

    history.unshift({
        url: url,
        title: title || url,
        timestamp: new Date()
    });

    // Keep only last 1000 items
    if (history.length > 1000) {
        history = history.slice(0, 1000);
    }

    saveHistory();
}

function addBookmark() {
    const tab = getCurrentTab();
    if (!tab || !tab.url || tab.url === 'about:blank') {
        alert('Yer işareti eklemek için bir sayfa açın.');
        return;
    }

    const title = tab.title || tab.url;
    const url = tab.url;

    bookmarks.push({
        title: title,
        url: url,
        timestamp: new Date()
    });

    saveBookmarks();
    alert('Yer işareti eklendi!');
}

function loadBookmarks() {
    const saved = localStorage.getItem('bookmarks');
    if (saved) {
        bookmarks = JSON.parse(saved);
    }
}

function saveBookmarks() {
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
}

function saveHistory() {
    localStorage.setItem('history', JSON.stringify(history));
}

function showSidebar(title, renderFunction) {
    document.getElementById('sidebar-title').textContent = title;
    const content = document.getElementById('sidebar-content');
    content.innerHTML = '';
    renderFunction(content);
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('active');
}

function hideSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
}

function renderBookmarks(container) {
    if (bookmarks.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">Henüz yer işareti yok.</p>';
        return;
    }

    bookmarks.forEach((bookmark, index) => {
        const item = document.createElement('div');
        item.style.cssText = 'padding: 12px; margin-bottom: 8px; background: var(--bg-darker); border-radius: 8px; cursor: pointer; border: 1px solid var(--border-color); transition: all 0.2s; position: relative;';
        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; gap: 8px;">
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">${bookmark.title}</div>
                    <div style="font-size: 12px; color: var(--text-secondary); word-break: break-all;">${bookmark.url}</div>
                </div>
                <button class="bookmark-delete-btn" data-index="${index}" style="width: 24px; height: 24px; border: none; background: transparent; color: var(--text-secondary); cursor: pointer; border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s;" title="Sil">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M18 6L6 18M6 6l12 12" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
        `;
        
        // Click to navigate
        const contentDiv = item.querySelector('div');
        contentDiv.addEventListener('click', (e) => {
            if (!e.target.closest('.bookmark-delete-btn')) {
                navigateToUrl(bookmark.url);
                hideSidebar();
            }
        });
        
        // Delete button
        const deleteBtn = item.querySelector('.bookmark-delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`"${bookmark.title}" yer işaretini silmek istediğinize emin misiniz?`)) {
                bookmarks.splice(index, 1);
                saveBookmarks();
                renderBookmarks(container);
            }
        });
        
        deleteBtn.addEventListener('mouseenter', () => {
            deleteBtn.style.color = 'var(--danger)';
            deleteBtn.style.background = 'rgba(239, 68, 68, 0.1)';
        });
        deleteBtn.addEventListener('mouseleave', () => {
            deleteBtn.style.color = 'var(--text-secondary)';
            deleteBtn.style.background = 'transparent';
        });
        
        item.addEventListener('mouseenter', () => {
            item.style.borderColor = 'var(--primary-color)';
            item.style.background = 'var(--bg-hover)';
        });
        item.addEventListener('mouseleave', () => {
            item.style.borderColor = 'var(--border-color)';
            item.style.background = 'var(--bg-darker)';
        });
        container.appendChild(item);
    });
}

function renderHistory(container) {
    const savedHistory = localStorage.getItem('history');
    const historyData = savedHistory ? JSON.parse(savedHistory) : [];

    if (historyData.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">Henüz geçmiş yok.</p>';
        return;
    }

    historyData.slice(0, 50).forEach((item) => {
        const historyItem = document.createElement('div');
        historyItem.style.cssText = 'padding: 12px; margin-bottom: 8px; background: var(--bg-darker); border-radius: 8px; cursor: pointer; border: 1px solid var(--border-color); transition: all 0.2s;';
        const date = new Date(item.timestamp);
        historyItem.innerHTML = `
            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">${item.title || item.url}</div>
            <div style="font-size: 12px; color: var(--text-secondary);">${item.url}</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">${date.toLocaleString('tr-TR')}</div>
        `;
        historyItem.addEventListener('click', () => {
            navigateToUrl(item.url);
            hideSidebar();
        });
        historyItem.addEventListener('mouseenter', () => {
            historyItem.style.borderColor = 'var(--primary-color)';
            historyItem.style.background = 'var(--bg-hover)';
        });
        historyItem.addEventListener('mouseleave', () => {
            historyItem.style.borderColor = 'var(--border-color)';
            historyItem.style.background = 'var(--bg-darker)';
        });
        container.appendChild(historyItem);
    });
}

function renderDownloads(container) {
    container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">Henüz indirme yok.</p>';
}

function renderSettings(container) {
    container.innerHTML = `
        <div style="padding: 20px;">
            <h3 style="color: var(--text-primary); margin-bottom: 24px; font-size: 20px; font-weight: 700;">Ayarlar</h3>
            <div style="margin-bottom: 20px;">
                <label style="display: block; color: var(--text-secondary); margin-bottom: 8px; font-weight: 600;">Tema</label>
                <select id="theme-select" style="width: 100%; padding: 10px; background: var(--bg-darker); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 14px; cursor: pointer;">
                    <option value="dark">Koyu</option>
                    <option value="light">Açık</option>
                </select>
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: block; color: var(--text-secondary); margin-bottom: 8px; font-weight: 600;">Arama Motoru</label>
                <select id="search-engine" style="width: 100%; padding: 10px; background: var(--bg-darker); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 14px; cursor: pointer;">
                    <option value="google">Google</option>
                    <option value="bing">Bing</option>
                    <option value="duckduckgo">DuckDuckGo</option>
                </select>
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: block; color: var(--text-secondary); margin-bottom: 8px; font-weight: 600;">Gizlilik</label>
                <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-darker); border-radius: 8px;">
                    <input type="checkbox" id="tracking-protection" style="width: 18px; height: 18px; cursor: pointer;">
                    <label for="tracking-protection" style="color: var(--text-primary); cursor: pointer; flex: 1;">İzleme Koruması</label>
                </div>
            </div>
            <button id="clear-history-btn" style="width: 100%; padding: 12px; background: linear-gradient(135deg, var(--danger) 0%, #dc2626 100%); border: none; border-radius: 8px; color: white; cursor: pointer; font-weight: 600; margin-top: 20px; transition: all 0.3s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 20px rgba(239, 68, 68, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                Geçmişi Temizle
            </button>
        </div>
    `;

    const clearHistoryBtn = document.getElementById('clear-history-btn');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', () => {
            if (confirm('Geçmişi temizlemek istediğinize emin misiniz?')) {
                history = [];
                localStorage.removeItem('history');
                alert('Geçmiş temizlendi!');
                renderHistory(document.getElementById('sidebar-content'));
            }
        });
    }

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        // Load saved theme
        const savedTheme = localStorage.getItem('theme') || 'dark';
        themeSelect.value = savedTheme;
        
        themeSelect.addEventListener('change', (e) => {
            localStorage.setItem('theme', e.target.value);
            // Apply theme (for now just show message, full theme switching can be added later)
            const themeNames = {
                'dark': 'Koyu',
                'light': 'Açık'
            };
            const successMsg = document.createElement('div');
            successMsg.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: var(--primary-color); color: white; padding: 12px 24px; border-radius: 8px; z-index: 10000; font-weight: 600; box-shadow: 0 4px 20px var(--green-glow);';
            successMsg.textContent = `Tema: ${themeNames[e.target.value]}`;
            document.body.appendChild(successMsg);
            setTimeout(() => {
                document.body.removeChild(successMsg);
            }, 2000);
        });
    }

    const searchEngine = document.getElementById('search-engine');
    if (searchEngine) {
        // Load saved search engine
        const savedEngine = localStorage.getItem('searchEngine') || 'google';
        searchEngine.value = savedEngine;
        
        searchEngine.addEventListener('change', (e) => {
            localStorage.setItem('searchEngine', e.target.value);
            const engineNames = {
                'google': 'Google',
                'bing': 'Bing',
                'duckduckgo': 'DuckDuckGo'
            };
            // Show success message
            const successMsg = document.createElement('div');
            successMsg.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: var(--primary-color); color: white; padding: 12px 24px; border-radius: 8px; z-index: 10000; font-weight: 600; box-shadow: 0 4px 20px var(--green-glow);';
            successMsg.textContent = `Arama motoru: ${engineNames[e.target.value]}`;
            document.body.appendChild(successMsg);
            setTimeout(() => {
                document.body.removeChild(successMsg);
            }, 2000);
        });
    }

    const trackingProtection = document.getElementById('tracking-protection');
    if (trackingProtection) {
        // Load saved setting
        const saved = localStorage.getItem('trackingProtection') === 'true';
        trackingProtection.checked = saved;
        
        trackingProtection.addEventListener('change', (e) => {
            localStorage.setItem('trackingProtection', e.target.checked);
            const status = e.target.checked ? 'açık' : 'kapalı';
            const successMsg = document.createElement('div');
            successMsg.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: var(--primary-color); color: white; padding: 12px 24px; border-radius: 8px; z-index: 10000; font-weight: 600; box-shadow: 0 4px 20px var(--green-glow);';
            successMsg.textContent = `İzleme koruması: ${status}`;
            document.body.appendChild(successMsg);
            setTimeout(() => {
                document.body.removeChild(successMsg);
            }, 2000);
        });
    }
}

function showImportAccountsDialog() {
    const dialog = document.createElement('div');
    dialog.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); z-index: 10000; display: flex; align-items: center; justify-content: center;';
    
    dialog.innerHTML = `
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 32px; max-width: 500px; width: 90%; box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);">
            <h2 style="color: var(--text-primary); margin-bottom: 8px; font-size: 24px; font-weight: 700;">Hesapları İçe Aktar</h2>
            <p style="color: var(--text-secondary); margin-bottom: 24px; font-size: 14px;">Diğer tarayıcılardan hesaplarınızı ve ayarlarınızı içe aktarın</p>
            
            <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
                <button class="import-browser-btn" data-browser="chrome" style="display: flex; align-items: center; gap: 12px; padding: 16px; background: var(--bg-darker); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); cursor: pointer; transition: all 0.3s; text-align: left;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; margin-bottom: 4px;">Google Chrome</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">Hesaplar, yer işaretleri ve şifreler</div>
                    </div>
                </button>
                
                <button class="import-browser-btn" data-browser="brave" style="display: flex; align-items: center; gap: 12px; padding: 16px; background: var(--bg-darker); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); cursor: pointer; transition: all 0.3s; text-align: left;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; margin-bottom: 4px;">Brave Browser</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">Hesaplar, yer işaretleri ve şifreler</div>
                    </div>
                </button>
                
                <button class="import-browser-btn" data-browser="opera" style="display: flex; align-items: center; gap: 12px; padding: 16px; background: var(--bg-darker); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); cursor: pointer; transition: all 0.3s; text-align: left;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; margin-bottom: 4px;">Opera Browser</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">Hesaplar, yer işaretleri ve şifreler</div>
                    </div>
                </button>
            </div>
            
            <div style="display: flex; gap: 12px;">
                <button id="import-cancel-btn" style="flex: 1; padding: 12px; background: var(--bg-darker); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); cursor: pointer; font-weight: 600; transition: all 0.3s;">
                    İptal
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Hover effects
    dialog.querySelectorAll('.import-browser-btn').forEach(btn => {
        btn.addEventListener('mouseenter', function() {
            this.style.borderColor = 'var(--primary-color)';
            this.style.background = 'var(--bg-hover)';
            this.style.transform = 'translateX(4px)';
        });
        btn.addEventListener('mouseleave', function() {
            this.style.borderColor = 'var(--border-color)';
            this.style.background = 'var(--bg-darker)';
            this.style.transform = 'translateX(0)';
        });
        btn.addEventListener('click', function() {
            const browser = this.getAttribute('data-browser');
            importFromBrowser(browser);
            document.body.removeChild(dialog);
        });
    });
    
    document.getElementById('import-cancel-btn').addEventListener('click', () => {
        document.body.removeChild(dialog);
    });
    
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            document.body.removeChild(dialog);
        }
    });
}

function importFromBrowser(browserName) {
    const browserNames = {
        'chrome': 'Google Chrome',
        'brave': 'Brave Browser',
        'opera': 'Opera Browser'
    };
    
    const browserNameDisplay = browserNames[browserName];
    
    // Show progress dialog
    const progressDialog = document.createElement('div');
    progressDialog.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); z-index: 10001; display: flex; align-items: center; justify-content: center;';
    progressDialog.innerHTML = `
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 32px; max-width: 400px; width: 90%; text-align: center;">
            <div style="width: 60px; height: 60px; border: 4px solid var(--border-color); border-top-color: var(--primary-color); border-radius: 50%; margin: 0 auto 20px; animation: spin 1s linear infinite;"></div>
            <h3 style="color: var(--text-primary); margin-bottom: 12px; font-size: 20px;">İçe Aktarılıyor...</h3>
            <p style="color: var(--text-secondary); margin-bottom: 8px;">${browserNameDisplay} tarayıcısından veriler alınıyor</p>
            <p id="import-status" style="color: var(--primary-color); font-size: 14px; font-weight: 600;">Yer işaretleri kontrol ediliyor...</p>
        </div>
    `;
    
    const style = document.createElement('style');
    style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
    document.head.appendChild(style);
    
    document.body.appendChild(progressDialog);
    const statusText = progressDialog.querySelector('#import-status');
    
    // Simulate import process
    setTimeout(() => {
        if (statusText) statusText.textContent = 'Hesaplar kontrol ediliyor...';
        
        setTimeout(() => {
            if (statusText) statusText.textContent = 'Şifreler kontrol ediliyor...';
            
            setTimeout(() => {
                // Try to read browser data (this would require native modules in production)
                let importedCount = 0;
                let importedItems = [];
                
                // Simulate finding bookmarks
                try {
                    // In a real implementation, you would:
                    // 1. Read browser's bookmarks file (JSON/HTML)
                    // 2. Parse and import bookmarks
                    // 3. Read saved passwords from browser's password manager
                    // 4. Import browser settings
                    
                    // For demo, we'll add some sample bookmarks
                    const sampleBookmarks = [
                        { title: 'Gmail', url: 'https://mail.google.com' },
                        { title: 'YouTube', url: 'https://www.youtube.com' },
                        { title: 'Google', url: 'https://www.google.com' }
                    ];
                    
                    sampleBookmarks.forEach(bookmark => {
                        // Check if already exists
                        const exists = bookmarks.some(b => b.url === bookmark.url);
                        if (!exists) {
                            bookmarks.push({
                                title: bookmark.title,
                                url: bookmark.url,
                                timestamp: new Date(),
                                imported: true
                            });
                            importedCount++;
                            importedItems.push(bookmark.title);
                        }
                    });
                    
                    saveBookmarks();
                } catch (error) {
                    console.error('Import error:', error);
                }
                
                // Show result
                progressDialog.innerHTML = `
                    <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 32px; max-width: 400px; width: 90%; text-align: center;">
                        <div style="width: 60px; height: 60px; background: var(--primary-color); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                                <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <h3 style="color: var(--text-primary); margin-bottom: 12px; font-size: 20px;">İçe Aktarma Tamamlandı!</h3>
                        <p style="color: var(--text-secondary); margin-bottom: 8px;">${importedCount} öğe başarıyla içe aktarıldı</p>
                        ${importedItems.length > 0 ? `<p style="color: var(--primary-color); font-size: 14px; margin-top: 12px;">${importedItems.join(', ')}</p>` : ''}
                        <button id="import-close-btn" style="margin-top: 24px; padding: 12px 32px; background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-light) 100%); border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer; transition: all 0.3s;">
                            Tamam
                        </button>
                    </div>
                `;
                
                document.getElementById('import-close-btn').addEventListener('click', () => {
                    document.body.removeChild(progressDialog);
                    document.head.removeChild(style);
                    // Refresh bookmarks if sidebar is open
                    if (document.getElementById('sidebar').classList.contains('open')) {
                        const sidebarTitle = document.getElementById('sidebar-title').textContent;
                        if (sidebarTitle === 'Yer İşaretleri') {
                            renderBookmarks(document.getElementById('sidebar-content'));
                        }
                    }
                });
            }, 1000);
        }, 1000);
    }, 1000);
}

