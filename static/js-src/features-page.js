const featureListEl = document.querySelector('chromedash-featurelist');
const chromeMetadataEl = document.querySelector('chromedash-metadata');
const searchEl = document.querySelector('.search input');
const legendEl = document.querySelector('chromedash-legend');

/**
 * Simple debouncer to handle text input.  Don't try to hit the server
 * until the user has stopped typing for a few seconds.  E.g.,
 * var debouncedKeyHandler = debounce(keyHandler);
 * el.addEventListener('keyup', debouncedKeyHandler);
 * @param {function} func Function to call after a delay.
 * @param {number} threshold_ms Milliseconds to wait before calling.
 * @return {function} A new function that can be used as an event handler.
 */
function debounce(func, threshold_ms = 300) {
  let timeout;
  return function(...args) {
    let context = this; // eslint-disable-line no-invalid-this
    let later = () => {
      func.apply(context, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, threshold_ms);
  };
}

// Set search box to URL deep link.
if (location.hash) {
  searchEl.value = decodeURIComponent(location.hash.substr(1));
}

chromeMetadataEl.addEventListener('query-changed', (e) => {
  const value = e.detail.version;
  const isMilestone = value.match(/^[0-9]+$/);
  searchEl.value = isMilestone ? 'milestone=' + value :
    'browsers.chrome.status:"' + value + '"';
  featureListEl.filter(searchEl.value);
});

// Clear input when user clicks the 'x' button.
searchEl.addEventListener('search', (e) => {
  if (!e.target.value) {
    featureListEl.filter();
    chromeMetadataEl.selected = null;
  }
});

searchEl.addEventListener('input', debounce((e) => {
  featureListEl.filter(e.target.value);
  chromeMetadataEl.selected = null;
}));

featureListEl.addEventListener('filtered', (e) => {
  document.querySelector('.num-features').textContent = e.detail.count;
});

featureListEl.addEventListener('has-scroll-list', () => {
  const headerEl = document.querySelector('app-header-layout app-header');
  headerEl.fixed = false;
});

featureListEl.addEventListener('filter-category', (e) => {
  e.stopPropagation();
  searchEl.value = 'category: ' + e.detail.val;
  featureListEl.filter(searchEl.value);
});

featureListEl.addEventListener('filter-owner', (e) => {
  e.stopPropagation();
  searchEl.value = 'browsers.chrome.owners: ' + e.detail.val;
  featureListEl.filter(searchEl.value);
});

featureListEl.addEventListener('filter-component', (e) => {
  e.stopPropagation();
  searchEl.value = 'component: ' + e.detail.val;
  featureListEl.filter(searchEl.value);
});

window.addEventListener('popstate', (e) => {
  if (e.state) {
    featureListEl.scrollToId(e.state.id);
  }
});

featureListEl.addEventListener('app-ready', () => {
  document.body.classList.remove('loading');

  // Want "Caching is complete" toast to be slightly delayed after page load.
  // To do that, wait to register SW until features have loaded.
  registerServiceWorker();

  // Lazy load Firebase messaging SDK after features list visible.
  loadFirebaseSDKLibs().then(() => {
    PushNotifications.init(); // init Firebase messaging.

    // If use already granted the notification permission, update state of the
    // push icon for each feature the user is subscribed to.
    if (PushNotifier.GRANTED_ACCESS) {
      PushNotifications.getAllSubscribedFeatures().then((subscribedFeatures) => {
        const iconEl = document.querySelector('#features-subscribe-button').firstElementChild;
        if (subscribedFeatures.includes(PushNotifier.ALL_FEATURES_TOPIC_ID)) {
          iconEl.icon = 'chromestatus:notifications';
        } else {
          iconEl.icon = 'chromestatus:notifications-off';
        }
      });
    }
  });

  StarService.getStars().then((starredFeatureIds) => {
    featureListEl.starredFeatures = new Set(starredFeatureIds);
  });
});

if (PushNotifier.SUPPORTS_NOTIFICATIONS) {
  const subscribeButtonEl = document.querySelector('#features-subscribe-button');
  subscribeButtonEl.removeAttribute('hidden');

  subscribeButtonEl.addEventListener('click', (e) => {
    e.preventDefault();

    if (window.Notification && Notification.permission === 'denied') {
      alert('Notifications were previously denied. Please reset the browser permission.');
      return;
    }

    PushNotifications.getAllSubscribedFeatures().then(subscribedFeatures => {
      const iconEl = document.querySelector('#features-subscribe-button').firstElementChild;
      if (subscribedFeatures.includes(PushNotifier.ALL_FEATURES_TOPIC_ID)) {
        iconEl.icon = 'chromestatus:notifications-off';
        PushNotifications.unsubscribeFromFeature();
      } else {
        iconEl.icon = 'chromestatus:notifications';
        PushNotifications.subscribeToFeature();
      }
    });
  });
}

legendEl.views = VIEWS;

document.querySelector('.legend-button').addEventListener('click', (e) => {
  e.preventDefault();
  legendEl.toggle();
});
