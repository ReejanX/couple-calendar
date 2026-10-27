(function () {
  "use strict";

  var main = document.getElementById("tabPages");
  var pages = ["./pages/home.html", "./pages/calendar.html", "./pages/memories.html"];

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = function () { reject(new Error("Could not load " + src)); };
      document.body.appendChild(script);
    });
  }

  async function start() {
    try {
      var responses = await Promise.all(pages.map(function (path) { return fetch(path); }));
      responses.forEach(function (response) {
        if (!response.ok) throw new Error("Could not load a page section (" + response.status + ")");
      });
      var sections = await Promise.all(responses.map(function (response) { return response.text(); }));
      main.innerHTML = sections.join("\n");
      main.setAttribute("aria-busy", "false");
      await loadScript("./js/data-layer.js");
      await loadScript("./js/pages/home.js");
      await loadScript("./js/pages/calendar.js");
      await loadScript("./js/pages/memories.js");
      await loadScript("./js/app.js");
    } catch (error) {
      main.setAttribute("aria-busy", "false");
      main.innerHTML = '<p role="alert">The app could not load. Check your connection and reload the page.</p>';
      console.error(error);
    }
  }

  start();
})();
