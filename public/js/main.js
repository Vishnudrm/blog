document.addEventListener("DOMContentLoaded", () => {
  const root = document.documentElement;
  const body = document.body;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  body.classList.add("ready");

  const applyTheme = (isDark) => {
    root.classList.toggle("dark", isDark);
    root.classList.toggle("theme-dark", isDark);
    root.setAttribute("data-theme", isDark ? "dark" : "light");
  };

  const savedTheme = localStorage.getItem("theme");
  const userSelectedTheme = sessionStorage.getItem("themeUserSelected") === "true";
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const shouldUseDark = userSelectedTheme ? savedTheme === "dark" : systemPrefersDark;

  if (savedTheme === "dark" && !userSelectedTheme) {
    localStorage.removeItem("theme");
  }

  if (!savedTheme || savedTheme === "light" || savedTheme === "dark") {
    sessionStorage.setItem("themeUserSelected", userSelectedTheme ? "true" : "false");
  }

  applyTheme(shouldUseDark);

  const themeToggle = document.querySelector(".theme-toggle");
  if (themeToggle) {
    const syncToggleState = () => {
      const isDark = root.classList.contains("dark");
      themeToggle.setAttribute("aria-pressed", String(isDark));
      themeToggle.title = isDark ? "Switch to light mode" : "Switch to dark mode";
    };

    syncToggleState();

    themeToggle.addEventListener("click", () => {
      const isDark = !root.classList.contains("dark");
      applyTheme(isDark);
      sessionStorage.setItem("themeUserSelected", "true");
      localStorage.setItem("theme", isDark ? "dark" : "light");
      syncToggleState();
    });
  }

  const setActiveNav = () => {
    const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
    const navLinks = document.querySelectorAll(".nav-links a");

    navLinks.forEach((link) => {
      const href = new URL(link.href).pathname.replace(/\/$/, "") || "/";
      if (href === currentPath) {
        link.classList.add("is-active");
      }
    });
  };
  setActiveNav();

  const dropdown = document.querySelector(".nav-dropdown");
  const trigger = document.querySelector(".nav-trigger");

  if (dropdown && trigger) {
    trigger.addEventListener("click", (event) => {
      if (window.innerWidth <= 768) {
        event.preventDefault();
        event.stopPropagation();
        const isOpen = dropdown.classList.toggle("is-open");
        trigger.setAttribute("aria-expanded", String(isOpen));
      }
    });

    document.addEventListener("click", (event) => {
      if (!dropdown.contains(event.target)) {
        dropdown.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
      }
    });
  }

  const loadingScreen = document.querySelector(".loading-screen");
  const shouldShowLoader = !sessionStorage.getItem("vishnuBlogLoaderShown");

  if (loadingScreen) {
    if (shouldShowLoader && !reducedMotion) {
      const word = loadingScreen.querySelector(".loading-screen__word");
      const text = "explore.";
      word.textContent = "";

      [...text].forEach((char, index) => {
        const span = document.createElement("span");
        span.textContent = char;
        span.style.setProperty("--index", index);
        word.appendChild(span);
      });

      const cursor = loadingScreen.querySelector(".loading-screen__cursor");
      if (cursor) {
        cursor.style.left = `${word.offsetWidth + 6}px`;
      }

      setTimeout(() => {
        if (cursor) {
          cursor.style.opacity = "0";
        }
      }, 1220);

      setTimeout(() => {
        document.body.classList.add("loading-complete");
        setTimeout(() => {
          loadingScreen.remove();
          document.body.classList.add("ready");
          sessionStorage.setItem("vishnuBlogLoaderShown", "true");
        }, 300);
      }, 1600);
    } else {
      if (loadingScreen) {
        loadingScreen.remove();
      }
      document.body.classList.add("ready");
      sessionStorage.setItem("vishnuBlogLoaderShown", "true");
    }
  } else {
    document.body.classList.add("ready");
  }

  const revealItems = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          entry.target.style.opacity = "1";
          entry.target.style.transform = "translateY(0)";
        } else {
          entry.target.classList.remove("is-visible");
          entry.target.style.opacity = "0";
          entry.target.style.transform = "translateY(16px)";
        }
      });
    }, { threshold: 0.1 });

    revealItems.forEach((item, index) => {
      if (item.classList.contains("post-article")) {
        item.classList.add("is-visible");
        item.style.opacity = "1";
        item.style.transform = "translateY(0)";
        return;
      }

      item.style.transitionDelay = `${(index % 8) * 60}ms`;
      observer.observe(item);
    });
  } else {
    revealItems.forEach((item) => {
      if (item.classList.contains("post-article")) {
        item.classList.add("is-visible");
        item.style.opacity = "1";
        item.style.transform = "translateY(0)";
        return;
      }
      item.classList.add("is-visible");
    });
  }

});
