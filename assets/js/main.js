(function () {
  "use strict";

  var config = window.EVENT_CONFIG;
  if (!config) {
    console.error("EVENT_CONFIG is not defined. Please load config.js before main.js.");
    document.documentElement.classList.add("is-open", "cover-done");
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("is-visible"); });
    return;
  }

  var arabicDigits = "٠١٢٣٤٥٦٧٨٩";

  function toArabicDigits(value) {
    return String(value).replace(/[0-9]/g, function (d) {
      return arabicDigits.charAt(parseInt(d, 10));
    });
  }

  function pad2(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  /* ---------- Populate content from config ---------- */
  /* Message: word spans for the staggered reveal; the opening phrase
     (up to the first Arabic comma) is set in gold like an illuminated incipit. */
  function renderMessage(text) {
    var el = document.getElementById("invitationMessage");
    if (!el || !text) return;
    var words = String(text).trim().split(/\s+/);
    var leadEnd = -1;
    for (var i = 0; i < words.length; i++) {
      if (words[i].indexOf("،") !== -1) { leadEnd = i; break; }
    }
    if (leadEnd > 4) leadEnd = -1;

    el.textContent = "";
    words.forEach(function (word, index) {
      var span = document.createElement("span");
      span.className = index <= leadEnd ? "w message__lead" : "w";
      span.style.setProperty("--i", index);
      span.textContent = word;
      el.appendChild(span);
      if (index < words.length - 1) el.appendChild(document.createTextNode(" "));
    });
  }

  function buildRsvpMessage() {
    return config.whatsapp.message
      .replace("{groom}", config.groomName)
      .replace("{bride}", config.brideName);
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el && value != null) el.textContent = value;
  }

  function populateContent() {
    var e = config.event;

    setText("groomName", config.groomName);
    setText("brideName", config.brideName);

    setText("heroDate", e.fullDateLabel);
    setText("eventDate", e.fullDateLabel);
    setText("dateDay", toArabicDigits(e.day));
    setText("dateWeekday", e.weekday);
    setText("dateMonth", e.monthLabel + " " + toArabicDigits(e.year));
    setText("eventTime", e.timeLabel);
    setText("eventVenue", config.venue.name);

    renderMessage(config.invitationMessage);

    var footerGroom = document.getElementById("footerGroom");
    var footerBride = document.getElementById("footerBride");
    if (footerGroom) footerGroom.textContent = config.groomName;
    if (footerBride) footerBride.textContent = config.brideName;

    var mapBtn = document.getElementById("mapBtn");
    if (mapBtn && config.venue.mapUrl) {
      mapBtn.href = config.venue.mapUrl;
    }

    setText("rsvpPreview", buildRsvpMessage());
    setText("coverNames", config.groomName + " و " + config.brideName);
    if (config.audio && config.audio.label) setText("musicLabel", config.audio.label);

    document.title = "دعوة زفاف " + config.groomName + " و " + config.brideName;
  }

  /* ---------- Countdown (Africa/Cairo via Intl timezone database) ---------- */
  var CAIRO_TZ = "Africa/Cairo";

  function cairoOffsetAt(utcMs) {
    var fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: CAIRO_TZ,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false
    });
    var parts = fmt.formatToParts(new Date(utcMs));
    function get(type) {
      var p = parts.find(function (x) { return x.type === type; });
      return p ? p.value : "0";
    }
    var cairoWallMs = Date.UTC(
      parseInt(get("year"), 10),
      parseInt(get("month"), 10) - 1,
      parseInt(get("day"), 10),
      parseInt(get("hour"), 10) % 24,
      parseInt(get("minute"), 10),
      parseInt(get("second"), 10)
    );
    return cairoWallMs - utcMs;
  }

  function getTargetTime() {
    var e = config.event;
    var wallAsUtc = Date.UTC(
      e.year,
      e.monthIndex,
      e.day,
      e.hour,
      e.minute || 0,
      0,
      0
    );
    var offsetMs = cairoOffsetAt(wallAsUtc);
    return wallAsUtc - offsetMs;
  }

  var targetTime = getTargetTime();
  var countdownEl = document.getElementById("countdown");
  var countdownDoneEl = document.getElementById("countdownDone");
  var countdownEls = {
    days: document.getElementById("cdDays"),
    hours: document.getElementById("cdHours"),
    minutes: document.getElementById("cdMinutes"),
    seconds: document.getElementById("cdSeconds")
  };
  var prevValues = { days: null, hours: null, minutes: null, seconds: null };

  function flipNum(el) {
    if (!el) return;
    el.classList.remove("is-flip");
    void el.offsetWidth;
    el.classList.add("is-flip");
  }

  function renderCountdown(diff) {
    var totalSeconds = Math.floor(diff / 1000);
    var days = Math.floor(totalSeconds / 86400);
    var hours = Math.floor((totalSeconds % 86400) / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;

    var values = {
      days: toArabicDigits(pad2(days)),
      hours: toArabicDigits(pad2(hours)),
      minutes: toArabicDigits(pad2(minutes)),
      seconds: toArabicDigits(pad2(seconds))
    };

    var keys = ["days", "hours", "minutes", "seconds"];
    keys.forEach(function (key) {
      var el = countdownEls[key];
      if (!el) return;
      if (prevValues[key] !== values[key]) {
        el.textContent = values[key];
        if (prevValues[key] !== null) {
          flipNum(el);
        }
        prevValues[key] = values[key];
      }
    });
  }

  function tick() {
    var now = Date.now();
    var diff = targetTime - now;

    if (diff <= 0) {
      if (countdownEl) countdownEl.style.display = "none";
      if (countdownDoneEl) countdownDoneEl.style.display = "block";
      return;
    }

    renderCountdown(diff);
  }

  function initCountdown() {
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- WhatsApp RSVP ---------- */
  function initRsvp() {
    var btn = document.getElementById("rsvpBtn");
    if (!btn) return;

    btn.addEventListener("click", function (e) {
      if (!config.whatsapp.number) {
        e.preventDefault();
        var note = document.getElementById("rsvpNote");
        if (note) {
          note.hidden = false;
          note.textContent = "رقم واتساب لتأكيد الحضور لم يُضَف بعد، يرجى المحاولة لاحقًا.";
        } else {
          alert("لم يتم تحديد رقم واتساب في ملف الإعدادات.");
        }
        return;
      }

      var message = buildRsvpMessage();

      var url = "https://wa.me/" + config.whatsapp.number.replace(/\D/g, "") +
        "?text=" + encodeURIComponent(message);

      btn.href = url;
    });
  }

  /* ---------- Music control ---------- */
  function initMusic() {
    var btn = document.getElementById("musicToggle");
    if (!btn) return;

    var audio = new Audio(config.audio.src);
    // "metadata" lets a missing file be detected up front so the control can hide itself.
    audio.preload = "metadata";
    audio.loop = true;
    audio.volume = 0.6;

    var isPlaying = false;
    var hasError = false;

    function setPlayingState(playing) {
      isPlaying = playing;
      btn.setAttribute("aria-pressed", String(playing));
      btn.setAttribute("aria-label",
        playing ? "إيقاف " + config.audio.label : "تشغيل " + config.audio.label);
    }

    audio.addEventListener("error", function () {
      hasError = true;
      setPlayingState(false);
      btn.classList.add("is-unavailable");
      console.warn("تعذر تشغيل ملف الصوت:", config.audio.src);
    });

    audio.addEventListener("ended", function () {
      setPlayingState(false);
    });

    // Autoplay (requested): try right away; where the browser blocks sound
    // until the guest interacts, start on the first tap/click/key anywhere
    // (e.g. tapping the opening seal). A manual pause is always respected.
    var userPaused = false;
    var gestureEvents = ["pointerdown", "touchend", "keydown"];

    function disarmGestureStart() {
      gestureEvents.forEach(function (type) {
        window.removeEventListener(type, onFirstGesture, true);
      });
    }

    function autoStart() {
      if (hasError || isPlaying || userPaused) return;
      var promise = audio.play();
      if (promise && typeof promise.then === "function") {
        promise.then(function () {
          setPlayingState(true);
          disarmGestureStart();
        }).catch(function () { /* blocked until a gesture: stay armed */ });
      } else {
        setPlayingState(true);
        disarmGestureStart();
      }
    }

    function onFirstGesture(e) {
      // a press on the music button is handled by its own click handler
      if (btn.contains(e.target)) return;
      autoStart();
    }

    gestureEvents.forEach(function (type) {
      window.addEventListener(type, onFirstGesture, true);
    });

    btn.addEventListener("click", function () {
      if (hasError) {
        btn.classList.add("is-unavailable");
        return;
      }

      disarmGestureStart();

      if (isPlaying) {
        userPaused = true;
        audio.pause();
        setPlayingState(false);
      } else {
        var promise = audio.play();
        if (promise && typeof promise.then === "function") {
          promise.then(function () {
            setPlayingState(true);
          }).catch(function () {
            setPlayingState(false);
            console.warn("تعذر تشغيل الصوت.");
          });
        } else {
          setPlayingState(true);
        }
      }
    });

    setPlayingState(false);
    autoStart();
  }

  /* ---------- Scroll reveal ---------- */
  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -40px 0px" });

    items.forEach(function (el) { observer.observe(el); });
  }

  /* ---------- Inline SVG symbols that need stroke-drawing ----------
     <use> content cannot be animated per element, so these instances get a
     real copy of the symbol. Without JS the <use> fallback still renders. */
  function inlineSymbols() {
    var SVG_NS = "http://www.w3.org/2000/svg";
    document.querySelectorAll("svg.js-inline").forEach(function (svg) {
      var use = svg.querySelector("use");
      if (!use) return;
      var symbol = document.querySelector(use.getAttribute("href"));
      if (!symbol) return;
      var group = document.createElementNS(SVG_NS, "g");
      Array.prototype.forEach.call(symbol.childNodes, function (node) {
        group.appendChild(node.cloneNode(true));
      });
      svg.replaceChild(group, use);
    });
  }

  /* ---------- Opening seal: draws itself, then parts on its own.
     Any tap, key, wheel or swipe skips straight to the invitation. ---------- */
  function initCover() {
    var root = document.documentElement;
    var cover = document.getElementById("cover");

    if (!cover || !root.classList.contains("with-cover")) {
      root.classList.add("is-open", "cover-done");
      return;
    }

    var opened = false;
    var events = ["click", "keydown", "wheel", "touchmove"];
    var autoTimer = setTimeout(open, 1700);

    function open() {
      if (opened) return;
      opened = true;
      clearTimeout(autoTimer);
      events.forEach(function (type) { window.removeEventListener(type, open); });
      try { sessionStorage.setItem("invite-opened", "1"); } catch (e) {}

      cover.classList.add("is-opening");
      root.classList.add("is-open");
      setTimeout(function () { root.classList.add("cover-done"); }, 1100);
    }

    events.forEach(function (type) {
      window.addEventListener(type, open, { passive: true });
    });

    requestAnimationFrame(function () {
      requestAnimationFrame(function () { cover.classList.add("is-drawing"); });
    });
  }

  /* ---------- Light / dark theme ----------
     Follows the browser's setting until the guest chooses; the choice is
     remembered. The head script applies a saved choice before first paint. */
  function initTheme() {
    var btn = document.getElementById("themeToggle");
    if (!btn) return;
    var root = document.documentElement;
    var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    var metas = document.querySelectorAll('meta[name="theme-color"]');

    function effective() {
      var chosen = root.getAttribute("data-theme");
      return chosen || (mq && mq.matches ? "dark" : "light");
    }

    function sync() {
      var dark = effective() === "dark";
      btn.setAttribute("aria-pressed", String(dark));
      Array.prototype.forEach.call(metas, function (m) {
        m.setAttribute("content", dark ? "#0F1626" : "#F7F1E3");
      });
    }

    btn.addEventListener("click", function () {
      var next = effective() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("invite-theme", next); } catch (e) {}
      sync();
    });

    if (mq) {
      if (mq.addEventListener) mq.addEventListener("change", sync);
      else if (mq.addListener) mq.addListener(sync);
    }
    sync();
  }

  /* ---------- Button press ripple from the touch point ---------- */
  function initButtonFeedback() {
    document.querySelectorAll(".btn").forEach(function (btn) {
      btn.addEventListener("pointerdown", function (e) {
        var rect = btn.getBoundingClientRect();
        btn.style.setProperty("--x", (e.clientX - rect.left) + "px");
        btn.style.setProperty("--y", (e.clientY - rect.top) + "px");
        btn.classList.remove("is-pressed");
        void btn.offsetWidth;
        btn.classList.add("is-pressed");
      });
      btn.addEventListener("animationend", function () {
        btn.classList.remove("is-pressed");
      });
    });
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    populateContent();
    inlineSymbols();
    initCover();
    initCountdown();
    initRsvp();
    initMusic();
    initReveal();
    initButtonFeedback();
    initTheme();
    // the couple illustration animates once per session (~7s incl. the hero entrance)
    setTimeout(function () {
      try { sessionStorage.setItem("couple-played", "1"); } catch (e) {}
    }, 7000);
    window.__inviteReady = true;
  });
})();
