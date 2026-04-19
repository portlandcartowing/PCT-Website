(function () {
  "use strict";

  var DEFAULT_PHONE = "(503) 608-7014";
  var DEFAULT_TEL = "+15036087014";
  var ADS_PHONE = "(503) 406-6323";
  var ADS_TEL = "+15034066323";
  var TRACK_ENDPOINT =
    "https://affordable-towing-dashboard.vercel.app/api/track/click";

  // --- Utility ---
  function getParams() {
    var params = {};
    var search = window.location.search.substring(1);
    if (!search) return params;
    var pairs = search.split("&");
    for (var i = 0; i < pairs.length; i++) {
      var kv = pairs[i].split("=");
      if (kv[0]) params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || "");
    }
    return params;
  }

  function getHostname(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return "";
    }
  }

  // --- Source Detection ---
  function detectSource(referrer, params) {
    var ref = (referrer || "").toLowerCase();
    var hasGclid = !!params.gclid;

    if (ref.indexOf("maps.google") !== -1 || params.ludocid || params.lsig) {
      return "google_maps";
    }
    if (hasGclid) return "google_ads";
    if (ref.indexOf("google") !== -1) return "google_organic";
    if (ref.indexOf("yelp") !== -1) return "yelp";
    if (ref.indexOf("facebook") !== -1) return "facebook";
    if (ref.indexOf("instagram") !== -1) return "instagram";
    if (ref.indexOf("bing") !== -1) return "bing";
    if (ref.indexOf("yahoo") !== -1) return "yahoo";

    if (!referrer || referrer === "") return "direct";
    var refHost = getHostname(referrer);
    if (refHost === window.location.hostname) return "direct";

    return refHost || "unknown";
  }

  // --- Session Storage ---
  var STORAGE_KEY = "dni_tracking";

  function loadSession() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveSession(data) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  // --- Init tracking data (first page load in session) ---
  function initTracking() {
    var existing = loadSession();
    if (existing) return existing;

    var params = getParams();
    var referrer = document.referrer || "";

    var data = {
      utm_campaign: params.utm_campaign || "",
      utm_source: params.utm_source || "",
      utm_medium: params.utm_medium || "",
      utm_content: params.utm_content || "",
      utm_term: params.utm_term || "",
      utm_adgroup: params.utm_adgroup || "",
      gclid: params.gclid || "",
      gbraid: params.gbraid || "",
      wbraid: params.wbraid || "",
      referrer: referrer,
      landing_page: window.location.pathname + window.location.search,
      timestamp: new Date().toISOString(),
      source: detectSource(referrer, params),
    };

    saveSession(data);
    return data;
  }

  // --- Phone Number Swap ---
  function swapPhoneNumbers(toAds) {
    if (!toAds) return;

    var displayFrom = DEFAULT_PHONE;
    var displayTo = ADS_PHONE;
    var telFrom = DEFAULT_TEL;
    var telTo = ADS_TEL;

    // Swap tel: hrefs
    var links = document.querySelectorAll('a[href*="5036087014"]');
    for (var i = 0; i < links.length; i++) {
      links[i].href = links[i].href.replace(/5036087014/g, "5034066323");
    }

    // Walk text nodes to swap display numbers
    var walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue.indexOf("608-7014") !== -1) {
        node.nodeValue = node.nodeValue.replace(
          /\(503\)\s*608-7014/g,
          displayTo
        );
        node.nodeValue = node.nodeValue.replace(/608-7014/g, "406-6323");
      }
    }
  }

  // --- Click Tracking ---
  function attachClickTracking(trackingData) {
    document.addEventListener("click", function (e) {
      var link = e.target.closest ? e.target.closest('a[href^="tel:"]') : null;
      if (!link) {
        // Fallback for browsers without closest
        var el = e.target;
        while (el && el !== document) {
          if (el.tagName === "A" && el.href && el.href.indexOf("tel:") === 0) {
            link = el;
            break;
          }
          el = el.parentNode;
        }
      }
      if (!link) return;

      var payload = {
        source: trackingData.source,
        utm_campaign: trackingData.utm_campaign,
        utm_adgroup: trackingData.utm_adgroup,
        utm_source: trackingData.utm_source,
        utm_medium: trackingData.utm_medium,
        utm_term: trackingData.utm_term,
        utm_content: trackingData.utm_content,
        gclid: trackingData.gclid,
        referrer: trackingData.referrer,
        landing_page: trackingData.landing_page,
        phone_clicked: link.href.replace("tel:", ""),
        timestamp: new Date().toISOString(),
      };

      // Use sendBeacon for reliability, fallback to fetch
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(TRACK_ENDPOINT, new Blob([body], { type: "application/json" }));
      } else {
        fetch(TRACK_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body,
          keepalive: true,
        }).catch(function () {});
      }
    });
  }

  // --- Run ---
  function run() {
    var trackingData = initTracking();
    var isAds = trackingData.source === "google_ads";
    swapPhoneNumbers(isAds);
    attachClickTracking(trackingData);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
